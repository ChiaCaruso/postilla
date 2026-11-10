# Architettura di Postilla

Documento di progetto scritto all'inizio (2026-11-09). Lo stato attuale e le scelte cambiate strada facendo sono nel [registro](registro.md).

## La scelta di fondo: tutto nel browser

Il valore più grande è la riservatezza: **il PDF non lascia mai il computer di chi lo modifica.** Non c'è nessun server che lo riceva.

Conseguenze:
- niente database, autenticazione, pagamenti, email né job in background;
- l'app è un insieme di file statici: si pubblica ovunque, anche sulla intranet;
- il limite è la memoria del computer, non un server (vedi "Le parti difficili").

La tabella di default della skill (Next.js, Postgres, Stripe…) presuppone un servizio con utenti e dati: qui sarebbe tutto peso inutile.

## Stack

| livello | scelta | perché |
| --- | --- | --- |
| web | Vite + React + TypeScript | app a pagina singola senza server: Vite produce file statici e ha un ciclo di sviluppo rapido; Next.js qui non aggiungerebbe nulla |
| stile | Tailwind con i token di `docs/design` | niente colori o misure scritti a mano nei componenti |
| visualizzazione PDF | pdf.js (`pdfjs-dist` 6.4.299, Apache-2.0; non usare versioni < 6.2.108, vulnerabili) | lo standard per mostrare le pagine e leggere il testo (serve per evidenziare e per modificare il testo esistente); supporta PDF con password |
| scrittura PDF | `@cantoo/pdf-lib` (MIT, fork mantenuto di pdf-lib) + `@cantoo/fontkit` | aggiunge testo, immagini, tracciati, annotazioni e campi modulo a un PDF esistente, nel browser |
| editor sulla pagina | Fabric.js 7 (MIT) | oggetti con maniglie per spostare, ridimensionare e ruotare, disegno a mano libera, testo modificabile, ordine dei livelli: è metà dell'editor già pronta |
| stato e annulla/ripristina | Zustand (MIT) con cronologia degli stati | un unico stato del documento, facile da salvare come istantanee per annulla/ripristina |
| font | Noto Sans, Noto Serif, Noto Sans Mono (SIL OFL) inclusi nell'app; Inter solo per l'interfaccia | i 14 font standard dei PDF non coprono bene tutti i caratteri; quelli inclusi si incorporano nel PDF, così accenti e simboli escono sempre corretti |
| lavoro pesante | Web Worker | il salvataggio di PDF grandi non blocca l'interfaccia |
| database, auth, pagamenti, email, job | nessuno | non servono: nessun dato esce dal browser |
| pubblicazione | file statici su un server interno, oppure Netlify/Vercel con accesso protetto (SSO o password) | basta un hosting di file; la protezione serve solo a non rendere pubblico lo strumento, non a proteggere i documenti, che restano sul PC |

Licenze: tutte permissive (MIT, Apache-2.0, OFL). Da evitare MuPDF.js e simili sotto AGPL, salvo decisione esplicita.

## Il "modello dati" (al posto dello schema SQL)

Non c'è database, quindi niente SQL. Il modello dei dati è un insieme di tipi TypeScript in memoria: `src/model.ts`.

Entità: Documento, Pagina, Elemento (testo, immagine, forma, disegno, annotazione, commento).

Regole che il modello deve rispettare (i "vincoli" di questo progetto):
- **Coordinate in punti PDF, origine in alto a sinistra della pagina come la si vede.** La conversione verso le coordinate del PDF (origine in basso a sinistra, pagina eventualmente ruotata, CropBox diversa da MediaBox) avviene in **un solo punto**, all'esportazione. Mai conversioni sparse nei componenti.
- Ogni elemento appartiene a una sola pagina; `z` è unico all'interno della pagina.
- Il file originale non si modifica mai in memoria: si tiene il buffer di partenza e una lista di elementi. Il PDF finale si genera solo all'esportazione. Così annulla/ripristina è banale e niente si corrompe a metà.
- Opacità tra 0 e 1, rotazione tra 0 e 360, dimensioni maggiori di zero: verificate in un'unica funzione di validazione.

## "API": le funzioni interne

Non ci sono rotte HTTP né webhook. Al loro posto, le funzioni del livello dati, con firme stabili (così l'interfaccia non cambia se in futuro si aggiunge un server):

| funzione | cosa fa | input | output | flusso |
| --- | --- | --- | --- | --- |
| `openPdf(file, password?)` | legge il file, controlla tipo e dimensione, apre con pdf.js | `File`, password opzionale | `Documento` oppure errore tipizzato (`not_pdf`, `too_large`, `needs_password`, `wrong_password`, `damaged`) | F01, F06 |
| `renderPage(doc, index, scale)` | disegna una pagina su canvas | documento, indice, zoom | canvas | tutti |
| `getTextRuns(doc, index)` | testo della pagina con posizioni | documento, indice | frammenti di testo con riquadri | F03, F04 |
| `addElement(pageIndex, el)` | aggiunge un elemento | pagina, elemento | id | F01, F02, F03, F07 |
| `updateElement(id, patch)` | sposta, ridimensiona, cambia stile | id, modifiche | — | F05 |
| `removeElement(id)` / `removeAll()` | elimina | id | — | F05 |
| `reorder(id, 'front' or 'back' or 'up' or 'down')` | ordine dei livelli | id, direzione | — | F05 |
| `undo()` / `redo()` | cronologia | — | — | F05 |
| `editExistingText(pageIndex, runId, nuovo)` | registra una modifica di testo esistente | pagina, frammento, testo e stile | id | F04 |
| `exportPdf(doc)` | nel Worker: carica l'originale con pdf-lib, applica elementi e modifiche, incorpora i font, salva | documento | `Blob` del PDF | F01 → S05 |
| `download(blob, nome)` | scarica con nome `<originale>-modificato.pdf` | blob, nome | — | S05 |

Webhook in e out: nessuno. Job in background: nessuno. Cancellazione dei file: avviene da sola chiudendo la scheda; il pulsante "Elimina" in S05 svuota la memoria e torna a S01.

## Le parti difficili

- **Modificare il testo esistente (F04): il rischio più grande.** Nei PDF il testo è spezzato in frammenti con font spesso incorporati parzialmente (mancano i caratteri non usati). Piano in due tempi: v1 "copri e riscrivi" (si rimuove il frammento originale dal contenuto della pagina, non basta coprirlo di bianco, poi si scrive il nuovo testo con il font incluso più simile, alla stessa posizione e dimensione); una vera modifica dentro il flusso di contenuto solo se la v1 non basta. Da prototipare **per primo** tra le funzioni "should", con 10 PDF reali del team.
- **PDF con password.** Risolto in M1 con `@cantoo/pdf-lib`, che decifra (vedi registro.md). Il PDF risultante non è protetto e S05 lo dice. Da provare con PDF cifrati da altri programmi.
- **Coordinate.** Pagine ruotate, CropBox diversa da MediaBox, pagine di formati diversi nello stesso file. Una sola funzione di conversione, con test su un PDF di prova per ogni caso.
- **Font e caratteri.** Accenti, €, virgolette tipografiche: sempre font incorporati (subset), mai i 14 standard. Emoji: fuori supporto in v1, con un messaggio.
- **Evidenziare/sottolineare/barrare (F03).** Servono le posizioni del testo da pdf.js e annotazioni PDF vere (Highlight, Underline, StrikeOut, Squiggly) scritte a basso livello con pdf-lib. Sui PDF scansionati non c'è testo: il pulsante si disattiva con una spiegazione.
- **Dimensione dei file.** Limite 100 MB. Nel browser va bene su un PC normale; si mostrano solo le pagine visibili (rendering pigro) e il salvataggio avviene nel Worker. Limite iniziale 100 MB, con messaggio chiaro oltre.
- **Moduli (F07).** pdf-lib crea campi testo, checkbox, scelta ed elenco; il "campo firma" vero non è supportato bene: in v1 diventa un'area per firmare a mano libera o con immagine.
- **Privacy verificabile.** Una Content Security Policy con `connect-src 'self'` impedisce all'app qualsiasi chiamata esterna: la promessa "il file non esce dal PC" la garantisce il browser, non solo il codice.
- **Funzionamento offline.** Facoltativo: come PWA l'app funziona anche senza rete. Utile, non indispensabile.
- Non si applicano: fusi orari, idempotenza, webhook, limiti di richieste, email, multi-utente, cancellazione GDPR (nessun dato salvato).

## Ordine di costruzione

1. **Fetta verticale (M0)**: S01 → S03 → S05.
   Selezione file con pulsante, visualizzazione di tutte le pagine, aggiunta di una casella di testo, esportazione e download.
   Funzioni: `openPdf`, `renderPage`, `addElement`, `exportPdf`, `download`. Moduli: documento, pagina, elemento testo, esportazione.
   Scopo: dimostrare che pdf.js + Fabric + pdf-lib stanno insieme e che il testo esce **nella posizione giusta** nel PDF, anche su una pagina ruotata.

2. **Indispensabili (M1)**, per area (S01, S02, S03, S04, S05):
   - caricamento: trascinamento, errori chiari (non PDF, oltre 100 MB, danneggiato), apertura con password (S02)
   - editor: zoom, testo con font/dimensione/colore, immagini, forme (rettangolo, ellisse, linea), disegno a mano libera, opacità e rotazione, selezione/spostamento/ridimensionamento/eliminazione
   - download: indicatore di elaborazione (S04), download, pulsante Elimina, CSP senza connessioni esterne

3. **Importanti (M2)**:
   - annulla/ripristina (prima di tutto il resto: ogni funzione dopo ci si appoggia)
   - prototipo della modifica del testo esistente (v1 "copri e riscrivi")
   - stile del testo (grassetto, corsivo, sottolineato, allineamento), strumento mano, scorciatoie (Ctrl+C, Ctrl+V, Canc, Ctrl+Z)
   - pannello Elementi con ordine dei livelli
   - evidenziare/sottolineare/barrare il testo, evidenziatore a mano libera
   - indicatore di avanzamento per file grandi

4. **Facoltative (M3)**: vista a pagina singola o multipla, sottolineatura ondulata, commenti, "Rimuovi tutto", campi modulo, allegati e segnalibri, Google Drive/Dropbox se davvero richiesti.

