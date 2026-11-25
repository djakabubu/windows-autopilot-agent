# Assistente grafico con mascotte - Piano di implementazione

## Obiettivo

Aggiungere a Windows Autopilot Agent un'interfaccia grafica giocosa e accogliente, in cui anche chi è alle prime armi con Windows possa chiedere aiuto in linguaggio naturale e capire cosa sta facendo l'assistente. La mascotte è l'interlocutore dell'utente; il motore esistente in Python, il modello, PowerShell e i controlli locali sul rischio restano responsabili dell'esecuzione delle attività.

La prima versione è pensata per adulti, anche non tecnici. Il tono visivo deve essere caldo e divertente senza sembrare un giocattolo per bambini. Una presentazione o un comportamento progettati specificamente per i bambini non rientrano nella prima versione.

## Decisioni di prodotto e UX

- Iniziare con una normale finestra ridimensionabile, non con una mascotte fluttuante sul desktop o un overlay sempre in primo piano.
- Riservare alla mascotte un'area persistente accanto o sopra la conversazione. La mascotte può reagire con pochi stati chiari: inattiva, in ascolto, sta pensando, sta spiegando, attende approvazione, sta lavorando, completato ed errore.
- Usare fumetti per la conversazione, mantenendoli sobri e leggibili: le risposte della mascotte appaiono come messaggi dell'assistente, le richieste come messaggi dell'utente. Stato e informazioni importanti non devono essere comunicati solo tramite fumetti o animazioni.
- Mantenere visibili un campo di testo e un comando per inviare la richiesta. Voce, animazioni o conoscenze preliminari di Windows non devono essere necessarie.
- Mostrare avanzamento ed errori nella finestra o nella conversazione. Le animazioni non devono mai coprire comandi, risultati, approvazioni o controlli.
- Conservare la classificazione locale del rischio e il flusso di approvazione esplicita. Prima di eseguire un comando che richiede approvazione, mostrare il comando PowerShell esatto, il livello e il motivo del rischio, e scelte chiare per eseguirlo o rifiutarlo.
- Nella versione grafica, avviare PowerShell senza una finestra di console visibile, continuando a catturare output, errori, timeout e risultato da mostrare nella chat. Nascondere la console non deve nascondere il comando né sostituire la conferma dell'utente.
- Non attivare la modalità autopilot per impostazione predefinita e non nasconderla dietro un'interfaccia giocosa.
- Non riscrivere i prompt del modello/sistema durante l'implementazione iniziale della GUI. Migliorare semplicità e cordialità dei prompt sarà una fase successiva e verificabile separatamente.
- La GUI iniziale non aggiunge lettura dello schermo, automazione di mouse/tastiera, interazione vocale o nuove capacità del sistema: espone tramite una nuova interfaccia le funzionalità già presenti.
- Direzione aggiornata: React + TypeScript compilati localmente, serviti da un server Python loopback e mostrati in una finestra Microsoft Edge in modalità app. Il server espone solo operazioni/eventi applicativi; non espone PowerShell direttamente al frontend. Nessuna dipendenza WebView/Electron e nessun nuovo pacchetto Python. La distribuzione con installer resta da verificare.

## Attività

- [x] Esaminare la CLI esistente, l'esecuzione PowerShell, il ciclo del modello e il flusso di conferma dei comandi.
- [x] Definire il pubblico della prima versione, il ruolo della mascotte, lo stile d'interazione e i limiti di ambito.
- [x] Creare un primo concept visivo della finestra e della mascotte.
- [x] Creare un secondo concept visivo ispirato al riferimento fornito dall'utente, senza sovrascrivere il primo.
- [x] Creare concept aggiornati senza cielo stellato e con una mascotte antropomorfa più astratta.
- [x] Concordare uno stile d'animazione moderno e organico, senza estetica pixel/CRT anni '80.
- [x] Creare un primo prototipo SVG animato, con movimento ridotto rispettato.
- [x] Creare una finestra demo con chat e controlli per provare gli stati della mascotte.
- [x] Impostare il tema chiaro come predefinito e aggiungere la selezione del tema scuro nella demo.
- [x] Rendere più distinti pensiero, azione e parlato con indicatori, oggetto animato e bocca mobile.
- [x] Aggiungere battiti di palpebre e piccoli movimenti degli occhi in tutti gli stati.
- [x] Aggiungere tre varianti non ripetute consecutivamente per pensiero e azione.
- [x] Dare alla mascotte un'espressione dispiaciuta e un movimento di assestamento nello stato di errore.
- [x] Valutare come avviare PowerShell senza una finestra di console visibile, mantenendo output e codici di uscita acquisibili.
- [x] Scegliere React + TypeScript/Vite e il server Python locale con finestra Edge app per la GUI desktop.
- [x] Definire un flusso di eventi del motore indipendente dalla UI e mantenere la CLI come adattatore.
- [x] Realizzare la prima finestra grafica con conversazione, richieste in linguaggio naturale, stato dell'attività e approvazioni esplicite.
- [x] Collegare gli stati della mascotte agli eventi del motore.
- [x] Integrare nella mascotte React le animazioni SVG (movimento, sguardo, parlato, attesa, successo ed errore) e le espressioni per stato.
- [x] Mantenere animazioni rispettose di `prefers-reduced-motion`.
- [x] Implementare launcher nascosto, server loopback, finestra Edge app e spegnimento guidato dalla presenza.
- [ ] Verificare manualmente l'apertura/chiusura su Windows e decidere se/come distribuire un installer.
- [ ] Verificare sicurezza, reattività, accessibilità, compatibilità Windows e documentazione.
- [ ] In una fase successiva, rendere prompt e risposte più cordiali e semplici per chi è alle prime armi.

## Stato attuale

- Repository: `djakabubu/windows-autopilot-agent`; branch: `UserInterfaceAnimated`; ultimo commit: `c6f754b` (`prima versione, non mi piace webview, cerco di copiare lo stile di MyFinalTodo`).
- Il repository aveva modifiche locali a `plan.md` prima dell'integrazione della GUI; le modifiche preesistenti sono state mantenute e aggiornate in questo piano. La GUI e il frontend sono attualmente modifiche locali non ancora committate.
- L'applicazione attuale è una CLI Python per Windows. Il ciclo modello/attività, la valutazione del rischio dei comandi, le richieste di conferma e l'esecuzione di processi PowerShell sono implementati in `windows_autopilot.py`.
- La CLI mantiene `print()` e `input()` tramite un adattatore; il ciclo condiviso ora produce eventi strutturati. Modello e PowerShell girano in un worker quando chiamati dalla GUI, senza bloccare la finestra.
- Sono supportati Python 3.9 o superiore e Windows PowerShell 5.1 o PowerShell 7. Il motore/CLI e il server GUI usano la standard library; Node.js 20.19+ oppure 22.12+ serve solo quando occorre compilare il frontend.
- La UI React + TypeScript in `ui/` è servita dal server Python in `desktop_server.py`; `run_gui.cmd` avvia in modo nascosto il launcher, che verifica la build, controlla `/api/health`, avvia un server indipendente se necessario e apre Edge in modalità app con profilo dedicato. Il bridge Python conserva gli eventi strutturati e le approvazioni esplicite; la CLI continua a usare lo stesso motore.
- Il server ascolta solo su `127.0.0.1:43127`, verifica Host/Origin per le richieste locali, serve gli asset compilati e mantiene una connessione SSE di presenza. Con il launcher attivo, termina dopo la chiusura dell'ultima finestra oppure se nessuna finestra si collega entro 30 secondi; in avvio diretto con `--server` non si spegne automaticamente.
- La UI riempie ora l'intero viewport della finestra/browser: rimossi margini, dimensioni massime e cornice arrotondata che davano l'effetto finestra annidata. Build/type-check React superata. Verificata la risposta HTTP dell'entry Vite in sviluppo e, con i processi attivi, health/status del server Python e proxy Vite verso `/api/status`; la UI mostra motore collegato e modello configurato. La UI web richiede l'avvio da `ui/` (`npm run dev`), mentre dalla root non c'è un `package.json`. Non è stata inviata una richiesta all'agente, quindi il flusso completo di lavoro/approvazione non è stato esercitato in questa verifica.
- La mascotte React integrata è stata allineata alle animazioni della demo: battito di palpebre casuale in tutti gli stati e sguardo laterale continuo; puntini animati durante pensiero/attesa di approvazione; varianti non ripetute per pensiero e lavoro, con oggetti contestuali, parlato, approvazione, successo ed errore. Le espressioni seguono gli eventi reali del motore; `prefers-reduced-motion` resta rispettato.
- La mascotte React integrata ora segue anche in idle il battito e lo sguardo laterale della demo; puntini del pensiero visibili durante pensiero e attesa di approvazione, varianti e oggetti contestuali durante il lavoro. La demo grafica autonoma resta disponibile come riferimento visivo; i concept visivi generati restano non definitivi: [primo](./openrouter-image-2026-11-25T10-07-39-623Z-db90b1c9-1.png), [secondo](./openrouter-image-2026-11-25T10-10-52-027Z-acb2ce0c-1.png), [variante ambrata](./openrouter-image-2026-11-25T10-16-24-348Z-510658e2-1.png) e [variante astratta più recente](./openrouter-image-2026-11-25T10-16-52-884Z-bd4cc666-1.png).
- Il concept più recente abbandona il cielo stellato e la sfera sopra la testa, usando una forma ambrata fluida e indefinita con pochi tratti antropomorfi su un pannello uniforme. È il riferimento visivo corrente, ma resta modificabile.
- I mockup mostrano una chat e una conferma esplicita di un comando PowerShell. Non sono asset finali; la GUI usa una mascotte SVG React con animazioni CSS dedicate, riallineate alla demo.
- È stato creato un prototipo SVG animato: [mascot-organic-demo.svg](./mascot-organic-demo.svg). La UI React lo riusa come asset e pilota le transizioni di stato; le animazioni dettagliate della demo non sono ancora state portate tutte nella UI integrata.
- È disponibile una finestra demo locale e interattiva: [mascot-chat-demo.html](./mascot-chat-demo.html). Usa tema chiaro per impostazione predefinita con selettore scuro. Gli occhi si muovono e sbattono le palpebre indipendentemente dallo stato; pensiero e azione scelgono tra tre varianti, evitando di ripetere subito quella precedente. L'azione mostra un documento, una cartella o una lente; il parlato anima la bocca. In caso di errore la mascotte assume un'espressione dispiaciuta e si assesta con un movimento delicato. Il flusso di approvazione è simulato: il motore non è collegato e non vengono eseguiti comandi.
- Architettura attuale: React + TypeScript/Vite, UI statica servita via HTTP solo su loopback, API Python a operazioni limitate e motore Windows esistente.
- La funzione `execute_shell_command` in `windows_autopilot.py` avvia PowerShell con stdout/stderr catturati e timeout; nella GUI usa `subprocess.CREATE_NO_WINDOW`, mantenendo output e codice di uscita. `run_gui.pyw` avvia l'host senza console quando lanciato tramite l'associazione Windows per i file `.pyw`.
- `CREATE_NO_WINDOW` nasconde la console di PowerShell, non eventuali finestre che un comando avvia autonomamente e non limita i privilegi del processo. Il comando e le richieste di conferma devono quindi restare visibili nella UI.
- `run_gui.cmd` usa `launch_gui.vbs` per non lasciare una finestra di comando; il processo Python separato non ha console. Gli errori e le eccezioni non gestite sono scritti in `%LOCALAPPDATA%\WindowsAutopilotAgent\error.log`.
- Questo documento registra la direzione concordata, il lavoro integrato finora e le verifiche ancora da fare.

## Piano di implementazione

### 1. Toolkit grafico e distribuzione

- Scelta iniziale pywebview sostituita su richiesta: React + TypeScript/Vite, server Python su loopback e finestra Edge `--app` con `--user-data-dir`.
- Il launcher rigenera la UI se manca o è più vecchia dei sorgenti e installa i pacchetti npm solo quando mancano. Il server gestisce `/api/health`, API operative, SSE `/api/presence`, `/api/shutdown`, Host locale ed error log.
- README documenta launcher, runtime, modalità sviluppo e log. Il packaging/installer non è incluso nella preview.
- Da completare: verifica manuale su Windows (Edge, browser predefinito, reload, chiusura) e decisione sulla distribuzione.

**Criterio di completamento:** toolkit scelto e UI compilabile; il criterio di avvio nativo/distribuzione resta aperto fino alla prova manuale su Windows.

### 2. Separare gli eventi del motore dalla presentazione terminale

- Completato in `iter_task_events`: eventi di stato, risposta, classificazione locale, approvazione, risultato, errore e completamento.
- La CLI usa un adattatore terminale; la GUI consuma lo stesso flusso su un worker in background.
- Il bridge invia la decisione esplicita di approvazione alla valutazione del motore; la UI non può inviare comandi shell arbitrari.
- PowerShell usa `CREATE_NO_WINDOW` nella GUI e continua a restituire output, errori, timeout e codice di uscita. Non è stato aggiunto supporto all'annullamento.
- I prompt esistenti non sono stati modificati.

**Criterio di completamento:** raggiunto per il flusso condiviso; i test automatici verificano completamento e rifiuto di un comando.

### 3. Realizzare la prima conversazione grafica

- Implementati nella UI React: finestra ridimensionabile, conversazione, nuovo chat, input, indicatore attività, risultati e scheda di approvazione con comando esatto/rischio/motivo. Le chiamate passano dall'API HTTP locale anziché dal bridge WebView.
- Le richieste restano in attesa finché l'utente non approva o rifiuta; la chiusura del server rifiuta l'approvazione pendente.
- L'autopilot non è esposto dalla GUI. Build TypeScript/Vite superata; restano verifiche manuali di accessibilità e dimensioni su Windows.

**Criterio di completamento:** l'utente può inviare una richiesta, osservare l'attività, approvare o rifiutare un comando e leggere il risultato senza usare il terminale.

### 4. Aggiungere mascotte e animazioni

- Mascotte ricostruita come SVG React inline a livelli e percorsi vettoriali modificabili, non come mockup raster.
- Riutilizzare una sola mascotte SVG con varianti di stato, invece di duplicare un SVG per ogni animazione. Associare a ogni stato transizioni CSS/SVG coerenti; riservare elementi o percorsi sovrapposti alle variazioni d'espressione e agli oggetti contestuali.
- In React lo stato viene pilotato tramite `data-state`; un componente SVG React inline rende espressioni e parti animate accessibili ai selettori CSS. Pensiero/azione accelerano il movimento, il parlato anima la bocca, approvazione pulsa, successo fa un piccolo salto e l'errore si assesta con espressione dispiaciuta; idle mantiene il movimento organico e il battito di ciglia.
- La UI usa gli eventi strutturati del backend per alternare gli stati thinking, speaking, approval, acting, success, idle ed error; il recupero della connessione aggiorna nuovamente lo stato di collegamento.
- La demo conserva le sue varianti indipendenti; il componente integrato dà priorità alla rappresentazione dell'evento reale e non dipende dalla demo.
- Mantenere i movimenti brevi, discreti e non bloccanti. `prefers-reduced-motion` è rispettato e nessuna informazione essenziale dipende solo dall'animazione.
- Scegliere uno stile visivo divertente e accogliente per adulti e principianti, senza presumere che l'utente sia un bambino.
- La mascotte deve essere un'interlocutrice, non un sostituto di messaggi leggibili, controlli o approvazioni dei comandi.
- Se servono asset originali, valutare in questa fase la generazione tramite MCP OpenRouter Images; controllare prima le opzioni del modello scelto. Se l'immagine richiede uno sfondo trasparente, usare MCP Remove Background e verificarne il risultato prima di integrarla. Non generare asset se un segnaposto o un'illustrazione già disponibile sono sufficienti.

**Criterio di completamento:** i cambi di stato sono comprensibili con animazioni attive o disattivate e l'interfaccia resta leggibile alle dimensioni supportate.

### 5. Verifiche di sicurezza, usabilità e compatibilità Windows

- Verificare che i comandi SAFE mantengano il comportamento attuale e che quelli non sicuri continuino a richiedere la conferma locale.
- Verificare approvazione, rifiuto, chiusura della conferma, errori API, errori PowerShell, timeout, annullamento e richieste ripetute.
- Assicurarsi che le operazioni lunghe del modello o della shell non blocchino la finestra e che gli aggiornamenti UI avvengano nel thread corretto.
- Verificare uso da tastiera, ordine di navigazione, contrasto leggibile, ridimensionamento del testo e comportamento a movimento ridotto.
- Convalidare sulle versioni Windows supportate e documentare configurazione, gestione della chiave API, avvio e limiti noti.

**Criterio di completamento:** i test automatici mirati e le verifiche manuali su Windows passano e la CLI resta utilizzabile.

### 6. Successiva revisione dei prompt e del pubblico

- Rivedere separatamente i prompt di sistema/utente e la presentazione delle risposte per usare un linguaggio semplice e cordiale, comprensibile ai principianti.
- Dare priorità a precisione dei comandi, trasparenza e approvazioni esplicite rispetto alla personalità o all'umorismo.
- Considerare un design specifico per bambini solo come decisione di prodotto e sicurezza distinta; non presumere che la prima versione per adulti sia adatta all'uso non supervisionato da parte di bambini.

## Prossimi passi

- [x] Collegare la UI desktop al motore Python e implementare il flusso end-to-end con eventi, risultati e conferme esplicite.
- [x] Avviare PowerShell dalla GUI con `CREATE_NO_WINDOW`, mantenendo output, errori, timeout e codice di uscita.
- [x] Mantenere la CLI e condividere il percorso strutturato del motore tra CLI e GUI.
- [ ] Verificare manualmente launcher nascosto, Edge `--app`, browser di fallback, reload, chiusura e spegnimento del server, oltre ad approvazione/rifiuto, ridimensionamento e animazioni/espressioni sugli eventi veri.
- [ ] Decidere e documentare il packaging/installer; lasciare revisione dei prompt/persona a una fase successiva.
