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
- Non attivare la modalità autopilot per impostazione predefinita e non nasconderla dietro un'interfaccia giocosa.
- Non riscrivere i prompt del modello/sistema durante l'implementazione iniziale della GUI. Migliorare semplicità e cordialità dei prompt sarà una fase successiva e verificabile separatamente.
- La GUI iniziale non aggiunge lettura dello schermo, automazione di mouse/tastiera, interazione vocale o nuove capacità del sistema: espone tramite una nuova interfaccia le funzionalità già presenti.
- Direzione consigliata per la UI: React + TypeScript ospitati in una finestra desktop WebView2, con Python come backend tramite un bridge locale come pywebview. Questo consente animazioni CSS/SVG e mantiene il motore esistente in Python. Confrontare questa opzione con PySide6/QML in una prova pratica prima della scelta definitiva; non esporre PowerShell direttamente al frontend.

## Attività

- [x] Esaminare la CLI esistente, l'esecuzione PowerShell, il ciclo del modello e il flusso di conferma dei comandi.
- [x] Definire il pubblico della prima versione, il ruolo della mascotte, lo stile d'interazione e i limiti di ambito.
- [x] Creare un primo concept visivo della finestra e della mascotte.
- [x] Creare un secondo concept visivo ispirato al riferimento fornito dall'utente, senza sovrascrivere il primo.
- [x] Creare concept aggiornati senza cielo stellato e con una mascotte antropomorfa più astratta.
- [x] Concordare uno stile d'animazione moderno e organico, senza estetica pixel/CRT anni '80.
- [x] Creare un primo prototipo SVG animato, con movimento ridotto rispettato.
- [ ] Scegliere il toolkit grafico e verificare una modalità minima di distribuzione per Windows.
- [ ] Definire un confine tra motore e interfaccia, indipendente dalla UI, mantenendo la CLI esistente.
- [ ] Realizzare la prima finestra grafica con conversazione, richieste in linguaggio naturale, avanzamento e approvazioni esplicite.
- [ ] Aggiungere illustrazione o segnaposto della mascotte e transizioni animate legate alle sue attività.
- [ ] Verificare sicurezza, reattività, accessibilità, compatibilità Windows e documentazione.
- [ ] In una fase successiva, rendere prompt e risposte più cordiali e semplici per chi è alle prime armi.

## Stato attuale

- Repository: `djakabubu/windows-autopilot-agent`; branch: `UserInterfaceAnimated`; ultimo commit: `416c6c9` (`Prepare Windows Autopilot Agent for public release`).
- Il repository era pulito prima dell'aggiornamento di questo piano.
- L'applicazione attuale è una CLI Python per Windows. Il ciclo modello/attività, la valutazione del rischio dei comandi, le richieste di conferma e l'esecuzione di processi PowerShell sono implementati in `windows_autopilot.py`.
- La CLI usa direttamente `print()` e `input()` bloccanti; le operazioni sul modello e su PowerShell sono sincrone. Sono i principali punti da affrontare per evitare che la GUI si blocchi.
- Sono supportati Python 3.9 o superiore e Windows PowerShell 5.1 o PowerShell 7. Attualmente il progetto non ha dipendenze Python di terze parti.
- Non è ancora stata avviata alcuna implementazione grafica. Sono disponibili diversi concept generati, non definitivi e non integrati: [primo](./openrouter-image-2026-11-25T10-07-39-623Z-db90b1c9-1.png), [secondo](./openrouter-image-2026-11-25T10-10-52-027Z-acb2ce0c-1.png), [variante ambrata](./openrouter-image-2026-11-25T10-16-24-348Z-510658e2-1.png) e [variante astratta più recente](./openrouter-image-2026-11-25T10-16-52-884Z-bd4cc666-1.png).
- Il concept più recente abbandona il cielo stellato e la sfera sopra la testa, usando una forma ambrata fluida e indefinita con pochi tratti antropomorfi su un pannello uniforme. È il riferimento visivo corrente, ma resta modificabile.
- I mockup mostrano una chat e una conferma esplicita di un comando PowerShell. Non sono asset finali: la mascotte andrà ridisegnata o ricostruita in forma vettoriale prima di animarla.
- È stato creato un prototipo autonomo SVG animato: [mascot-organic-demo.svg](./mascot-organic-demo.svg). Usa movimenti morbidi, un battito di ciglia discreto e rispetta l'impostazione di movimento ridotto del sistema; non è ancora integrato nella GUI.
- Proposta tecnica corrente: React + TypeScript per la UI e bridge WebView2/pywebview verso Python; da validare con una prova pratica rispetto a PySide6/QML.
- Questo documento registra la direzione concordata e la sequenza di lavoro; non avvia da solo la codifica.

## Piano di implementazione

### 1. Scegliere toolkit grafico e distribuzione

- Confrontare React + TypeScript in WebView2 tramite pywebview con PySide6/QML. Creare una prova pratica con finestra, mascotte segnaposto, messaggio chat e indicatore aggiornato da un'attività in background.
- Verificare comportamento su Windows 10/11, compatibilità con Python 3.9, disponibilità di WebView2, dimensioni del pacchetto, installazione delle dipendenze e se la prima versione debba includere un eseguibile distribuibile.
- Scegliere il toolkit più semplice che soddisfa l'UX concordata. Annotare nel README le implicazioni per dipendenze e distribuzione.
- Se si sceglie React, mantenere il motore Python come autorità per modello, classificazione del rischio e PowerShell; esporre al frontend solo operazioni/eventi applicativi strettamente necessari tramite il bridge.

**Criterio di completamento:** toolkit e modalità di avvio/distribuzione sono scelti sulla base di una prova funzionante su Windows, non solo dell'aspetto.

### 2. Separare gli eventi del motore dalla presentazione terminale

- Individuare le operazioni del ciclo di attività attualmente legate all'output e all'input del terminale.
- Introdurre un'interfaccia indipendente dalla UI per inviare richieste e ricevere eventi strutturati e tipizzati, per esempio testo dell'assistente, avanzamento, comando proposto, richiesta di approvazione, risultato del comando, errore e fine dell'attività.
- Inviare le decisioni di approvazione dall'interfaccia al flusso di sicurezza locale esistente. Comando esatto e dettagli del rischio devono restare disponibili all'utente.
- Eseguire le operazioni sul modello e su PowerShell fuori dal thread della GUI. Inoltrare gli aggiornamenti in modo sicuro al thread della UI e supportare l'annullamento dove consentito dall'operazione sottostante.
- Mantenere funzionante la CLI attuale tramite un adattatore per il terminale e non modificare in questa fase il contenuto dei prompt.

**Criterio di completamento:** CLI e un piccolo test automatico possono usare lo stesso percorso del motore; il confine indipendente dalla UI segnala esplicitamente errori e richieste di approvazione.

### 3. Realizzare la prima conversazione grafica

- Creare una finestra ridimensionabile con vista della conversazione, campo di testo, comando di invio e modo chiaro per iniziare una nuova conversazione.
- Visualizzare i messaggi dell'utente e dell'assistente in fumetti leggibili. Gestire messaggi lunghi, testo selezionabile e scorrimento.
- Mostrare attività e avanzamento senza bloccare la finestra.
- Presentare le richieste di approvazione in una scheda o finestra inequivocabile con comando PowerShell esatto, livello di rischio, breve motivazione e azioni per eseguirlo o rifiutarlo. È necessaria un'azione deliberata; chiudere o ignorare la richiesta non deve eseguire il comando.
- Mostrare risultati e problemi dei comandi nel contesto. Rendere disponibili i dettagli tecnici utili senza sovraccaricare i principianti con lo stile del terminale.
- Conservare il comportamento esistente di permessi e valutazione del rischio; non nascondere errori e non attivare l'autopilot come ripiego silenzioso.

**Criterio di completamento:** l'utente può inviare una richiesta, osservare l'attività, approvare o rifiutare un comando e leggere il risultato senza usare il terminale.

### 4. Aggiungere mascotte e animazioni

- Iniziare con un asset segnaposto sostituibile, così il lavoro sulla UI e sul motore non dipende dall'illustrazione definitiva.
- Ricostruire la mascotte come SVG a livelli o percorsi vettoriali modificabili, non animare direttamente il mockup raster.
- Definire poche espressioni o animazioni coerenti, associate agli stati elencati sopra. In React, preferire CSS/SVG per movimenti leggeri e stati semplici; valutare animazioni più articolate solo se realmente necessarie.
- Mantenere i movimenti brevi, discreti e non bloccanti. Prevedere una modalità statica o a movimento ridotto; nessuna informazione essenziale deve dipendere solo dall'animazione.
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

- [ ] Realizzare una prova pratica per toolkit grafico e distribuzione.
- [ ] Dopo aver scelto il toolkit, implementare il confine motore/controller e la prima GUI.
- [ ] Lasciare la revisione dei prompt e della personalità a una fase successiva, dopo aver validato il flusso d'interazione grafico.
