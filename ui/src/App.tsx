import { FormEvent, useEffect, useRef, useState } from "react";
import Mascot from "./Mascot";
import MarkdownMessage from "./MarkdownMessage";
import type { MascotState, MascotVariant } from "./mascotState";
import { desktopApi } from "./api";
type Message =
  | { id: number; kind: "user" | "assistant" | "error" | "notice"; text: string }
  | {
      id: number;
      kind: "result";
      command: string;
      stdout: string;
      stderr: string;
      code: number;
      duration: number;
    };
type NewMessage =
  | { kind: "user" | "assistant" | "error" | "notice"; text: string }
  | {
      kind: "result";
      command: string;
      stdout: string;
      stderr: string;
      code: number;
      duration: number;
    };

interface Approval {
  id: string;
  command: string;
  reason: string;
  risk: string;
  reasons: string[];
}

type ActivityStatus = "completed" | "failed" | "not-executed";

interface ActivityStep {
  id: number;
  title: string;
  resultMessageId: number;
  descriptionMessageId: number | null;
  status: ActivityStatus;
}

interface SavedConversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  activitySteps?: ActivityStep[];
}

function getActivityTitle(description: string | null, command: string, status: ActivityStatus) {
  const cleanDescription = (description ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleanDescription) {
    const firstSentence = cleanDescription.match(/^.{1,100}?[.!?](?:\s|$)/)?.[0]?.trim();
    const title = firstSentence || cleanDescription;
    return title.length > 100 ? `${title.slice(0, 97).trimEnd()}…` : title;
  }
  if (status === "not-executed") return "Comando rifiutato: non è stato eseguito";
  if (status === "failed") return "Comando non riuscito";
  const conciseCommand = command.replace(/\s+/g, " ").trim();
  return `Comando completato: ${conciseCommand.slice(0, 74)}${conciseCommand.length > 74 ? "…" : ""}`;
}

function getActivitySteps(messages: Message[]): ActivityStep[] {
  let latestAssistant: Message | null = null;
  const steps: ActivityStep[] = [];
  for (const message of messages) {
    if (message.kind === "assistant") {
      latestAssistant = message;
    } else if (message.kind === "user") {
      latestAssistant = null;
    } else if (message.kind === "result") {
      const status: ActivityStatus = message.code === 125
        ? "not-executed"
        : message.code === 0 ? "completed" : "failed";
      steps.push({
        id: message.id,
        title: getActivityTitle(latestAssistant?.kind === "assistant" ? latestAssistant.text : null, message.command, status),
        resultMessageId: message.id,
        descriptionMessageId: latestAssistant?.kind === "assistant" ? latestAssistant.id : null,
        status,
      });
      latestAssistant = null;
    }
  }
  return steps;
}

const HISTORY_KEY = "winzi.conversations.v1";
const SETTINGS_KEY = "winzi.settings.v1";
const modelSuggestions = [
  "openrouter/free",
  "openrouter/auto",
  "openrouter/auto-code",
  "openai/GPT-6-Luna",
  "deepseek/deepseek-v4-flash-0731",
  "anthropic/claude-haiku-5.5",
];
const greeting: Message = { id: 1, kind: "assistant", text: "Ciao, sono Winzi! Cosa vuoi fare?" };
const suggestedPrompts = [
  {
    title: "Controllare lo spazio libero",
    prompt: "Quanto spazio libero c'è sul disco C:? Controlla e spiegami il risultato, senza modificare file.",
  },
  {
    title: "Capire un messaggio di errore",
    prompt: "Aiutami a capire questo messaggio di errore: [incolla qui il testo]",
  },
  {
    title: "Trovare un'impostazione di Windows",
    prompt: "Guidami per trovare l'impostazione di Windows che controlla gli aggiornamenti, senza installare nulla.",
  },
  {
    title: "Controllare la versione di Windows",
    prompt: "Controlla quale versione di Windows uso e spiegami dove riceve supporto e aggiornamenti, senza cambiare impostazioni.",
  },
  {
    title: "Verificare la batteria",
    prompt: "Se questo PC ha una batteria, controllane lo stato e spiegami il risultato senza cambiare nulla.",
  },
  {
    title: "Controllare la connessione Wi-Fi",
    prompt: "Controlla se il Wi-Fi è connesso e mostrami solo il nome della rete e lo stato, senza rivelare password o altri dettagli.",
  },
  {
    title: "Vedere cosa parte all'avvio",
    prompt: "Aiutami a vedere quali app sono configurate per partire con Windows. Non disattivare né modificare nulla.",
  },
  {
    title: "Controllare gli aggiornamenti",
    prompt: "Controlla se Windows segnala aggiornamenti in sospeso e spiegami dove verificarli. Non scaricare né installare nulla.",
  },
  {
    title: "Verificare una stampante",
    prompt: "Controlla quali stampanti risultano installate e qual è quella predefinita, senza stampare o cambiare impostazioni.",
  },
  {
    title: "Fare ordine nei file",
    prompt: "Suggeriscimi un modo sicuro per liberare spazio sul PC, prima controllando cosa occupa spazio e senza eliminare nulla.",
  },
];

function pickSuggestedPrompts() {
  const shuffled = [...suggestedPrompts];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 3);
}

function loadConversations(): SavedConversation[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => item && Array.isArray(item.messages)) : [];
  } catch {
    return [];
  }
}

function loadSettings(): { theme: "light" | "dark"; approvalLevels: string[] } {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      theme: value.theme === "dark" ? "dark" : "light",
      approvalLevels: Array.isArray(value.approvalLevels)
        ? value.approvalLevels.filter((level: string) => ["SAFE", "CAUTION", "DANGEROUS"].includes(level))
        : ["SAFE", "CAUTION", "DANGEROUS"],
    };
  } catch {
    return { theme: "light", approvalLevels: ["SAFE", "CAUTION", "DANGEROUS"] };
  }
}

const stateLabels: Record<MascotState, string> = {
  idle: "Ci sono. Cosa vuoi fare?",
  thinking: "Sto controllando la tua richiesta…",
  speaking: "Ti sto spiegando cosa fare…",
  acting: "Sto lavorando sul computer…",
  approval: "Prima di procedere, decidi tu.",
  success: "Fatto. Vuoi fare altro?",
  error: "C'è stato un problema.",
};

function getWelcomeCopy(state: MascotState, hour = new Date().getHours()) {
  if (state !== "idle") {
    const statusCopy: Record<Exclude<MascotState, "idle">, { title: string; subtitle: string }> = {
      thinking: { title: "Ci sto pensando.", subtitle: "Controllo la richiesta con calma." },
      speaking: { title: "Ecco cosa ho trovato.", subtitle: "Ti spiego tutto, un passo alla volta." },
      acting: { title: "Me ne occupo.", subtitle: "Sto eseguendo ciò che hai richiesto." },
      approval: { title: "Mi fermo qui.", subtitle: "Prima di procedere, aspetto la tua conferma." },
      success: { title: "Fatto!", subtitle: "Se vuoi, possiamo fare altro." },
      error: { title: "Qualcosa non è andato.", subtitle: "Vediamo insieme come risolvere." },
    };
    return statusCopy[state];
  }

  if (hour >= 5 && hour < 12) return { title: "Buongiorno!", subtitle: "Ci sono, un passo alla volta." };
  if (hour >= 12 && hour < 18) return { title: "Buon pomeriggio!", subtitle: "Ci sono, un passo alla volta." };
  if (hour >= 18 && hour < 23) return { title: "Buonasera!", subtitle: "Ci sono, un passo alla volta." };
  return { title: "Buonanotte!", subtitle: "Se hai bisogno, sono qui." };
}

function App() {
  const initialSettings = useRef(loadSettings());
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [visibleSuggestions, setVisibleSuggestions] = useState(pickSuggestedPrompts);
  const activitySteps = getActivitySteps(messages);
  const activityRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<SavedConversation[]>(loadConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => crypto.randomUUID());
  const [readOnly, setReadOnly] = useState(false);
  const [openPanel, setOpenPanel] = useState<"history" | "settings" | null>(null);
  const [approvalLevels, setApprovalLevels] = useState<string[]>(initialSettings.current.approvalLevels);
  const [settingsReady, setSettingsReady] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancellingRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [model, setModel] = useState("");
  const [modelDraft, setModelDraft] = useState("");
  const [modelSaving, setModelSaving] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(initialSettings.current.theme);
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [welcomeCopy, setWelcomeCopy] = useState(() => getWelcomeCopy("idle"));
  const [mascotVariant, setMascotVariant] = useState<MascotVariant | null>(null);
  const previousVariants = useRef<Partial<Record<"thinking" | "acting", MascotVariant>>>({});
  const [connectionMessage, setConnectionMessage] = useState("Connessione al motore…");
  const nextId = useRef(2);
  const messagesRef = useRef<HTMLDivElement>(null);

  const addMessage = (message: NewMessage) => {
    const nextMessage: Message = { ...message, id: nextId.current++ };
    setMessages((current) => [...current, nextMessage]);
  };

  const setStateWithVariant = (state: MascotState) => {
    setMascotState(state);
    setWelcomeCopy(getWelcomeCopy(state));
    const options: Partial<Record<"thinking" | "acting", MascotVariant[]>> = {
      thinking: ["think-scan", "think-tilt", "think-pulse"],
      acting: ["act-document", "act-folder", "act-search"],
    };
    const variants = state === "thinking" || state === "acting" ? options[state] : undefined;
    if (!variants) {
      setMascotVariant(null);
      return;
    }
    const variantState = state as "thinking" | "acting";
    const previous = previousVariants.current[variantState];
    const candidates = variants.filter((candidate) => candidate !== previous);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    previousVariants.current[variantState] = selected;
    setMascotVariant(selected);
  };

  useEffect(() => {
    let active = true;
    void desktopApi.set_approval_levels(initialSettings.current.approvalLevels).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setConnectionMessage(result.error ?? "Impossibile applicare le impostazioni di conferma.");
        return;
      }
      setSettingsReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const status = await desktopApi.get_status();
        if (!active) return;
        if (!connected || !status.configured) {
          setConnected(true);
          setConfigured(status.configured);
          setModel(status.model);
          setModelDraft((current) => current || status.model);
          setConnectionMessage(
            status.configured ? "Motore collegato" : "Configura la chiave API",
          );
        }
        setBusy(status.busy);
        setConnectionError("");
        const events = await desktopApi.poll_events();
        if (!active) return;
        events.forEach((event) => {
          if (event.type === "status") {
            if (
              event.status === "thinking"
              || event.status === "acting"
              || event.status === "success"
              || event.status === "idle"
            ) {
              setStateWithVariant(event.status);
            }
          } else if (event.type === "message" && event.text) {
            addMessage({ kind: "assistant", text: event.text });
            setStateWithVariant("speaking");
          } else if (event.type === "approval") {
            const approval: Approval = {
              id: event.id ?? "",
              command: event.command ?? "",
              reason: event.reason ?? "",
              risk: event.risk ?? "CAUTION",
              reasons: event.reasons ?? [],
            };
            setApprovals((current) => [...current, approval]);
            setStateWithVariant("approval");
          } else if (event.type === "command_result") {
            addMessage({
              kind: "result",
              command: event.command ?? "",
              stdout: event.stdout ?? "",
              stderr: event.stderr ?? "",
              code: event.code ?? 1,
              duration: event.duration ?? 0,
            });
            setStateWithVariant(event.code === 0 ? "acting" : "error");
          } else if (event.type === "notice" && event.text) {
            addMessage({ kind: "notice", text: event.text });
          } else if (event.type === "error" && event.text) {
            addMessage({ kind: "error", text: event.text });
            setStateWithVariant("error");
          } else if (event.type === "task_finished") {
            setBusy(false);
            if (cancellingRef.current) addMessage({ kind: "notice", text: "Attività fermata." });
            cancellingRef.current = false;
            setCancelling(false);
            setApprovals([]);
          }
        });
      } catch (error) {
        if (active) {
          setConnectionMessage(`Errore di comunicazione: ${String(error)}`);
          setConnectionError(String(error));
          setConnected(false);
          setStateWithVariant("error");
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => void poll(), 2000);
    const presence = new EventSource("/api/presence");
    const notifyShutdown = () => {
      navigator.sendBeacon("/api/shutdown");
    };
    window.addEventListener("pagehide", notifyShutdown);
    void poll();
    return () => {
      active = false;
      window.clearInterval(timer);
      presence.close();
      window.removeEventListener("pagehide", notifyShutdown);
    };
  }, [connected]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, approvalLevels }));
  }, [theme, approvalLevels]);

  useEffect(() => {
    if (messages.length <= 1 && messages[0]?.id === greeting.id) return;
    const firstUserMessage = messages.find((message) => message.kind === "user");
    const title = firstUserMessage?.kind === "user"
      ? firstUserMessage.text.slice(0, 72)
      : "Nuova conversazione";
    const conversation: SavedConversation = {
      id: activeConversationId,
      title,
      updatedAt: Date.now(),
      messages,
      activitySteps: getActivitySteps(messages),
    };
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)].slice(0, 100));
  }, [messages, activeConversationId]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
    } catch {
      setConnectionMessage("Spazio locale esaurito: elimina alcune chat dalla cronologia.");
    }
  }, [conversations]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, approvals]);

  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight;
    }
  }, [activitySteps.length, activeConversationId, readOnly]);

  const selectConversation = (conversation: SavedConversation) => {
    setMessages(conversation.messages);
    setVisibleSuggestions(pickSuggestedPrompts());
    setActiveConversationId(conversation.id);
    setReadOnly(true);
    setOpenPanel(null);
    setApprovals([]);
  };

  const updateModel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextModel = modelDraft.trim();
    if (!nextModel || busy || modelSaving || nextModel === model) return;
    setModelSaving(true);
    const result = await desktopApi.set_model(nextModel);
    setModelSaving(false);
    if (!result.ok) {
      addMessage({ kind: "error", text: result.error ?? "Impossibile aggiornare il modello." });
      return;
    }
    setModel(nextModel);
    setModelDraft(nextModel);
  };

  const updateApprovalLevel = async (level: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...approvalLevels, level])]
      : approvalLevels.filter((item) => item !== level);
    const result = await desktopApi.set_approval_levels(next);
    if (!result.ok) {
      addMessage({ kind: "error", text: result.error ?? "Impossibile aggiornare le conferme." });
      return;
    }
    setApprovalLevels(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || busy || readOnly) return;
    addMessage({ kind: "user", text: prompt });
    setDraft("");
    setBusy(true);
    setStateWithVariant("thinking");
    const result = await desktopApi.start_task(prompt);
    if (!result.ok) {
      addMessage({ kind: "error", text: result.error ?? "Impossibile avviare la richiesta." });
      setBusy(false);
      setStateWithVariant("error");
    }
  };

  const cancelTask = async () => {
    if (!busy || cancelling) return;
    cancellingRef.current = true;
    setCancelling(true);
    const result = await desktopApi.cancel_task();
    if (!result.ok) {
      cancellingRef.current = false;
      setCancelling(false);
      addMessage({ kind: "error", text: result.error ?? "Impossibile fermare l'attività." });
    }
  };

  const decide = async (approval: Approval, approved: boolean) => {
    const result = await desktopApi.respond_to_approval(approval.id, approved);
    if (!result.ok) {
      addMessage({
        kind: "error",
        text: result?.error ?? "Non è stato possibile inviare la decisione.",
      });
      return;
    }
    setApprovals((current) => current.filter((item) => item.id !== approval.id));
    addMessage({
      kind: "notice",
      text: approved ? "Hai approvato il comando." : "Comando rifiutato. Non è stato eseguito.",
    });
    setStateWithVariant(approved ? "acting" : "thinking");
  };

  const resetConversation = async () => {
    if (busy) return;
    const result = await desktopApi.new_conversation();
    if (!result.ok) {
      addMessage({ kind: "error", text: result?.error ?? "Impossibile iniziare una nuova chat." });
      return;
    }
    nextId.current = 2;
    setMessages([greeting]);
    setVisibleSuggestions(pickSuggestedPrompts());
    setActiveConversationId(crypto.randomUUID());
    setReadOnly(false);
    setApprovals([]);
    setOpenPanel(null);
    setStateWithVariant("idle");
  };

  return (
    <main className="window" data-theme={theme}>
      <header className="titlebar">
        <img className="brand-mark" src="/winzi.svg" alt="" />
        <strong>Winzi</strong>
        <span className={`connection ${configured ? "online" : "offline"}`} role="status">
          <span className="connection-dot" />
          {connected ? connectionMessage : "Connessione al motore…"}
        </span>
      </header>

      <div className="app-body">
        <aside className="mascot-panel">
          <nav className="mascot-nav" aria-label="Navigazione Winzi">
            <button className="nav-button" type="button" onClick={() => setOpenPanel("history")} aria-label="Apri cronologia">
              <span aria-hidden="true">◷</span><span>Cronologia</span>
            </button>
            <button className="nav-button" type="button" onClick={() => setOpenPanel("settings")} aria-label="Apri impostazioni">
              <span aria-hidden="true">⚙</span><span>Impostazioni</span>
            </button>
          </nav>
          <h1 aria-live="polite">{welcomeCopy.title}</h1>
          <p className="subhead">{welcomeCopy.subtitle}</p>
          {activitySteps.length > 0 ? (
            <section className="activity-list" aria-label="Operazioni di questa chat">
              <h2>Operazioni in questa chat</h2>
              <div className="activity-scroll" ref={activityRef}>
                <ol>
                  {activitySteps.map((step) => (
                    <li key={step.id}>
                      <button
                        className={`activity-link activity-${step.status}`}
                        type="button"
                        title="Vai al passaggio nella chat"
                        onClick={() => {
                          const target = document.getElementById(`message-${step.descriptionMessageId ?? step.resultMessageId}`);
                          target?.scrollIntoView({ behavior: "smooth", block: "center" });
                          target?.focus({ preventScroll: true });
                        }}
                      >
                        <span className="activity-status" aria-hidden="true">
                          {step.status === "completed" ? "✓" : step.status === "failed" ? "!" : "–"}
                        </span>
                        <span>{step.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="activity-note">Seleziona un’operazione per ritrovare il relativo passaggio nella chat.</p>
            </section>
          ) : messages.length === 1 && messages[0]?.id === greeting.id ? (
            <section className="quick-start" aria-label="Idee per iniziare">
              <h2>Non sai da dove iniziare?</h2>
              <p>Scegli un esempio: lo inserirò nella casella, senza inviarlo.</p>
              <div className="suggested-prompts">
                {visibleSuggestions.map(({ title, prompt }) => (
                  <button
                    className="suggested-prompt"
                    type="button"
                    key={title}
                    disabled={!connected || !configured || !settingsReady}
                    onClick={() => {
                      setDraft(prompt);
                      document.getElementById("prompt")?.focus();
                    }}
                  >
                    <span aria-hidden="true">›</span>{title}
                  </button>
                ))}
              </div>
              <p className="quick-start-note">Winzi non controlla né modifica il PC da sola. Prima di inviare, puoi adattare la richiesta; i comandi proposti restano visibili e soggetti alle impostazioni di conferma.</p>
            </section>
          ) : null}
          <div className="mascot-stage" data-state={mascotState} data-variant={mascotVariant ?? undefined}>
            <Mascot state={mascotState} variant={mascotVariant} />
          </div>
          <p className="state-caption" aria-live="polite">
            {connectionError ? "Non riesco a raggiungere il motore." : stateLabels[mascotState]}
          </p>
          <p className="model-label">{model ? `Modello · ${model}` : "Assistente locale"}</p>
        </aside>

        <section className="chat-panel" aria-label="Conversazione con Winzi">
          <header className="chat-header">
            <div>
              <h2>Chat con Winzi</h2>
              <p>{approvalLevels.length === 3 ? "Winzi chiede conferma per ogni livello di rischio." : "I livelli di rischio non selezionati vengono approvati automaticamente."}</p>
            </div>
            <button className="quiet-button" type="button" onClick={resetConversation} disabled={busy}>
              Nuova chat
            </button>
          </header>

          {!configured && connected && (
            <div className="setup-notice" role="status">
              <strong>Configura OpenRouter per iniziare</strong>
              <span>
                Imposta <code>OPENROUTER_API_KEY</code> nelle variabili d'ambiente di Windows,
                poi chiudi e riapri l'app.
              </span>
            </div>
          )}

          <div className="messages" ref={messagesRef} aria-live="polite" aria-relevant="additions">
            {messages.map((message) => (
              <article
                className={`message ${message.kind}`}
                id={`message-${message.id}`}
                key={message.id}
                tabIndex={-1}
              >
                {message.kind === "result" ? (
                  <>
                    <div className="result-heading">
                      <strong>{message.code === 0 ? "Comando completato" : "Risultato del comando"}</strong>
                      <span className={message.code === 0 ? "exit-ok" : "exit-error"}>
                        Codice {message.code} · {message.duration.toFixed(1)} s
                      </span>
                    </div>
                    <code className="command-line">{message.command}</code>
                    {message.stdout && <pre>{message.stdout}</pre>}
                    {message.stderr && <pre className="stderr">{message.stderr}</pre>}
                  </>
                ) : (
                  <>
                    <span className="message-label">
                      {message.kind === "user" ? "Tu" : message.kind === "assistant" ? "Winzi" : "Nota"}
                    </span>
                    <MarkdownMessage text={message.text} />
                  </>
                )}
              </article>
            ))}

            {approvals.map((approval) => (
              <article className="approval-card" key={approval.id} aria-label="Conferma richiesta">
                <div className="approval-title">
                  <span className="approval-icon" aria-hidden="true">!</span>
                  <div>
                    <strong>Prima di procedere, serve la tua conferma</strong>
                    <span className={`risk risk-${approval.risk.toLowerCase()}`}>
                      Rischio {approval.risk}
                    </span>
                  </div>
                </div>
                {approval.reason && <p className="approval-reason">{approval.reason}</p>}
                {approval.reasons.length > 0 && (
                  <ul className="risk-reasons">
                    {approval.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                )}
                <pre className="command-line">{approval.command}</pre>
                <div className="approval-actions">
                  <button className="quiet-button" type="button" onClick={() => void decide(approval, false)}>
                    Rifiuta
                  </button>
                  <button className="primary-button" type="button" onClick={() => void decide(approval, true)}>
                    Approva ed esegui
                  </button>
                </div>
              </article>
            ))}
            {busy && approvals.length === 0 && (
              <div className="working-indicator" role="status">
                <span className="spinner" />
                {mascotState === "acting" ? "Operazione in corso…" : "Sto preparando una risposta…"}
              </div>
            )}
          </div>

          {readOnly && <p className="readonly-notice">Stai consultando una chat archiviata. Avvia una nuova chat per continuare.</p>}
          <form className="composer" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="prompt">Scrivi una richiesta</label>
            <input
              id="prompt"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Scrivi una richiesta…"
              autoComplete="off"
              disabled={busy || readOnly || !settingsReady || !connected || !configured}
            />
            {busy ? (
              <button className="quiet-button stop-button" type="button" onClick={() => void cancelTask()} disabled={cancelling}>
                {cancelling ? "Interruzione…" : "Stop"}
              </button>
            ) : (
              <button className="primary-button send-button" type="submit" disabled={readOnly || !settingsReady || !draft.trim() || !configured}>
                Invia
              </button>
            )}
          </form>
          <footer className="chat-footer">
            Verifica sempre i comandi proposti: la classificazione del rischio non è una sandbox.
            {approvalLevels.length < 3 && " I livelli non selezionati possono eseguire comandi senza conferma."}
          </footer>
        </section>
      </div>

      {openPanel && (
        <div className="panel-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpenPanel(null);
        }}>
          <section className="utility-panel" role="dialog" aria-modal="true" aria-labelledby="utility-title">
            <header className="utility-header">
              <div>
                <p>Winzi</p>
                <h2 id="utility-title">{openPanel === "history" ? "Cronologia" : "Impostazioni"}</h2>
              </div>
              <button className="quiet-button" type="button" onClick={() => setOpenPanel(null)} aria-label="Chiudi">×</button>
            </header>
            {openPanel === "history" ? (
              <div className="history-list">
                <p className="panel-hint">Le conversazioni restano salvate su questo dispositivo.</p>
                {conversations.length === 0 ? <p className="empty-history">Le tue chat appariranno qui.</p> : conversations.map((conversation) => (
                  <button className="history-item" type="button" key={conversation.id} onClick={() => selectConversation(conversation)}>
                    <strong>{conversation.title}</strong>
                    <span>{new Date(conversation.updatedAt).toLocaleString("it-IT")}</span>
                  </button>
                ))}
                {conversations.length > 0 && <button className="clear-history" type="button" onClick={() => {
                  if (window.confirm("Eliminare tutta la cronologia salvata su questo dispositivo?")) {
                    setConversations([]);
                    setMessages([greeting]);
                    setActiveConversationId(crypto.randomUUID());
                    setReadOnly(false);
                  }
                }}>Elimina cronologia</button>}
              </div>
            ) : (
              <div className="settings-content">
                <section className="settings-group">
                  <h3>Aspetto</h3>
                  <button className="quiet-button" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>
                    {theme === "light" ? "Passa al tema scuro" : "Passa al tema chiaro"}
                  </button>
                </section>
                <section className="settings-group">
                  <h3>Motore</h3>
                  <p>Stato: {connected ? (configured ? "Collegato" : "Chiave API non configurata") : "Non collegato"}</p>
                  <p>La chiave API si configura nelle variabili d'ambiente di Windows e non viene letta né mostrata qui.</p>
                  <form className="model-settings" onSubmit={(event) => void updateModel(event)}>
                    <label htmlFor="model-name">Modello attivo</label>
                    <input
                      id="model-name"
                      type="text"
                      list="model-suggestions"
                      value={modelDraft}
                      onChange={(event) => setModelDraft(event.target.value)}
                      maxLength={200}
                      autoComplete="off"
                      disabled={busy || modelSaving}
                    />
                    <datalist id="model-suggestions">
                      {modelSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
                    </datalist>
                    <button className="quiet-button" type="submit" disabled={busy || modelSaving || !modelDraft.trim() || modelDraft.trim() === model}>
                      {modelSaving ? "Salvataggio…" : "Salva modello"}
                    </button>
                    <small>Il modello resta salvato su questo dispositivo fino a una nuova modifica.</small>
                  </form>
                </section>
                <section className="settings-group approval-settings">
                  <h3>Richiedi approvazione per</h3>
                  {(["SAFE", "CAUTION", "DANGEROUS"] as const).map((level) => (
                    <label className="approval-option" key={level}>
                      <input type="checkbox" checked={approvalLevels.includes(level)} onChange={(event) => void updateApprovalLevel(level, event.target.checked)}                       disabled={busy || !settingsReady} />
                      <span><strong>{level === "SAFE" ? "Sicuro" : level === "CAUTION" ? "Attenzione" : "Pericoloso"}</strong><small>{level}</small></span>
                    </label>
                  ))}
                  {approvalLevels.length > 0 && !approvalLevels.includes("DANGEROUS") && <p className="danger-notice" role="alert">I comandi classificati come pericolosi verranno eseguiti senza chiedere conferma.</p>}
                  {approvalLevels.length === 0 && <p className="danger-notice" role="alert">Nessuna conferma: Winzi eseguirà automaticamente tutti i comandi.</p>}
                  {approvalLevels.length > 0 && approvalLevels.length < 3 && approvalLevels.includes("DANGEROUS") && <p className="warning-notice">I livelli non selezionati verranno eseguiti senza chiedere conferma.</p>}
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
