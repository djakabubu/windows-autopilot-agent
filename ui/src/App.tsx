import { FormEvent, useEffect, useRef, useState } from "react";
import mascot from "../../mascot-organic-demo.svg";

type MascotState = "idle" | "thinking" | "acting" | "approval" | "success" | "error";
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

const stateLabels: Record<MascotState, string> = {
  idle: "Ci sono. Cosa vuoi fare?",
  thinking: "Sto controllando la tua richiesta…",
  acting: "Sto lavorando sul computer…",
  approval: "Prima di procedere, decidi tu.",
  success: "Fatto. Vuoi fare altro?",
  error: "C'è stato un problema.",
};

function App() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, kind: "assistant", text: "Ciao. Cosa vuoi fare?" },
  ]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [model, setModel] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Connessione al motore…");
  const nextId = useRef(2);
  const messagesRef = useRef<HTMLDivElement>(null);

  const addMessage = (message: NewMessage) => {
    const nextMessage: Message = { ...message, id: nextId.current++ };
    setMessages((current) => [...current, nextMessage]);
  };

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const poll = async () => {
      const api = window.pywebview?.api;
      if (!api || inFlight) return;
      inFlight = true;
      try {
        if (!connected) {
          const status = await api.get_status();
          if (!active) return;
          setConnected(true);
          setConfigured(status.configured);
          setBusy(status.busy);
          setModel(status.model);
          setConnectionMessage(
            status.configured ? "Motore collegato" : "Configura la chiave API",
          );
        }
        const events = await api.poll_events();
        if (!active) return;
        events.forEach((event) => {
          if (event.type === "status") {
            if (
              event.status === "thinking"
              || event.status === "acting"
              || event.status === "success"
              || event.status === "idle"
            ) {
              setMascotState(event.status);
            }
          } else if (event.type === "message" && event.text) {
            addMessage({ kind: "assistant", text: event.text });
            setMascotState("success");
          } else if (event.type === "approval") {
            const approval: Approval = {
              id: event.id ?? "",
              command: event.command ?? "",
              reason: event.reason ?? "",
              risk: event.risk ?? "CAUTION",
              reasons: event.reasons ?? [],
            };
            setApprovals((current) => [...current, approval]);
            setMascotState("approval");
          } else if (event.type === "command_result") {
            addMessage({
              kind: "result",
              command: event.command ?? "",
              stdout: event.stdout ?? "",
              stderr: event.stderr ?? "",
              code: event.code ?? 1,
              duration: event.duration ?? 0,
            });
            setMascotState(event.code === 0 ? "acting" : "error");
          } else if (event.type === "notice" && event.text) {
            addMessage({ kind: "notice", text: event.text });
          } else if (event.type === "error" && event.text) {
            addMessage({ kind: "error", text: event.text });
            setMascotState("error");
          } else if (event.type === "task_finished") {
            setBusy(false);
            setApprovals([]);
          }
        });
      } catch (error) {
        if (active) {
          setConnectionMessage(`Errore di comunicazione: ${String(error)}`);
          setMascotState("error");
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => void poll(), 250);
    window.addEventListener("pywebviewready", poll);
    void poll();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("pywebviewready", poll);
    };
  }, [connected]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, approvals]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || busy) return;
    const api = window.pywebview?.api;
    if (!api) {
      addMessage({ kind: "error", text: "L'interfaccia non è collegata al backend desktop." });
      return;
    }
    addMessage({ kind: "user", text: prompt });
    setDraft("");
    setBusy(true);
    setMascotState("thinking");
    const result = await api.start_task(prompt);
    if (!result.ok) {
      addMessage({ kind: "error", text: result.error ?? "Impossibile avviare la richiesta." });
      setBusy(false);
      setMascotState("error");
    }
  };

  const decide = async (approval: Approval, approved: boolean) => {
    const result = await window.pywebview?.api.respond_to_approval(approval.id, approved);
    if (!result?.ok) {
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
    setMascotState(approved ? "acting" : "thinking");
  };

  const resetConversation = async () => {
    if (busy) return;
    const result = await window.pywebview?.api.new_conversation();
    if (!result?.ok) {
      addMessage({ kind: "error", text: result?.error ?? "Impossibile iniziare una nuova chat." });
      return;
    }
    nextId.current = 2;
    setMessages([{ id: 1, kind: "assistant", text: "Ciao. Cosa vuoi fare?" }]);
    setApprovals([]);
    setMascotState("idle");
  };

  return (
    <main className="window" data-theme={theme}>
      <header className="titlebar">
        <span className="brand-mark" aria-hidden="true" />
        <strong>Assistente Windows</strong>
        <span className={`connection ${configured ? "online" : "offline"}`} role="status">
          <span className="connection-dot" />
          {connected ? connectionMessage : "Connessione al motore…"}
        </span>
        <button
          className="quiet-button theme-toggle"
          type="button"
          onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
          aria-label={`Attiva tema ${theme === "light" ? "scuro" : "chiaro"}`}
        >
          {theme === "light" ? "Tema scuro" : "Tema chiaro"}
        </button>
      </header>

      <div className="app-body">
        <aside className="mascot-panel">
          <h1>Ci sono.</h1>
          <p className="subhead">Un passo alla volta, insieme.</p>
          <div className="mascot-stage" data-state={mascotState}>
            <img className="mascot-art" src={mascot} alt="Mascotte organica ambrata" />
          </div>
          <p className="state-caption" aria-live="polite">{stateLabels[mascotState]}</p>
          <p className="model-label">{model ? `Modello · ${model}` : "Assistente locale"}</p>
        </aside>

        <section className="chat-panel" aria-label="Conversazione con l'assistente">
          <header className="chat-header">
            <div>
              <h2>Conversazione</h2>
              <p>Le operazioni sensibili chiedono sempre la tua conferma.</p>
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
              <article className={`message ${message.kind}`} key={message.id}>
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
                      {message.kind === "user" ? "Tu" : message.kind === "assistant" ? "Assistente" : "Nota"}
                    </span>
                    <p>{message.text}</p>
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

          <form className="composer" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="prompt">Scrivi una richiesta</label>
            <input
              id="prompt"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Scrivi una richiesta…"
              autoComplete="off"
              disabled={busy || !connected || !configured}
            />
            <button className="primary-button send-button" type="submit" disabled={busy || !draft.trim() || !configured}>
              Invia
            </button>
          </form>
          <footer className="chat-footer">
            Verifica sempre i comandi proposti. La classificazione del rischio non è una sandbox.
          </footer>
        </section>
      </div>
    </main>
  );
}

export default App;
