# Piano di test di Postilla

Build: `ee1f68f` (ramo `build/editor`; piano scritto su `da7705f`)  Data: 2026-11-09  Ambiente: locale (`npm run dev`), PDF di prova in `samples/`

Legenda colonna "auto": **e2e** = test Playwright in `e2e/`, **manuale** = provato a mano, **n/a** = non si applica.
Esecuzione: `npm test` (Playwright avvia da solo il server di sviluppo). Esito finale: **90 test, 90 passati** (39 della prima tornata, 10 della seconda, 19 dei casi limite, 7 della terza tornata, 15 per la modifica del testo esistente e i font compatibili).

Casi della lista standard che **non si applicano** a questa app, e perché:
- utente di un altro account, sessione scaduta: non ci sono account né server;
- fusi orari e ora legale: nessuna data o ora nel prodotto;
- rete lenta: dopo il caricamento della pagina non c'è traffico di rete, salvo i font (vedi X-E3, offline).

Schermate: **S01** caricamento · **S02** password · **S03** editor · **S04** elaborazione · **S05** download.
Flussi: **F01** testo · **F02** immagine · **F03** forme e penna · **F04** testo esistente · **F05** gestione degli elementi · **F06** PDF protetto · **F07** campi modulo (non costruito) · **F08** annotare il testo · **F09** commenti.

## F01 Aggiungere testo e scaricare

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| F01-H1 | felice | apri documento.pdf → Testo → clic sulla pagina → scrivi → Esc → Salva → Scarica | il PDF scaricato contiene il testo, linea di base nel punto in cui era nell'editor (±0,5 pt) | e2e || ✅ passa |
| F01-E1 | testo lungo | 300 caratteri in una casella larga 220 pt | va a capo su più righe; nel PDF le stesse righe, nello stesso ordine | e2e || ✅ passa |
| F01-E2 | accenti e simboli | «È già l’ora: 1.250,00 € – così» | i caratteri escono identici nel PDF | e2e || ✅ passa |
| F01-E3 | emoji | scrivi «Ok 👍» | o compaiono, o l'utente viene avvisato che non sono supportate; mai spariscono in silenzio | e2e || ✅ passa (falliva: BUG-001) |
| F01-E4 | testo vuoto | cancella tutto il testo ed esci dalla modifica | l'elemento sparisce (niente caselle vuote invisibili) | e2e || ✅ passa |
| F01-E5 | solo tastiera | Tab fino a «Testo», Invio, scrivi, Esc, Tab fino a «Salva il PDF», Invio | il testo è al centro della pagina corrente e finisce nel PDF | e2e || ✅ passa |
| F01-E6 | doppio clic su Salva | doppio clic su «Salva il PDF» | un solo PDF, nessun errore | e2e || ✅ passa |
| F01-E7 | pagine difficili | testo su pagine ruotate 0/90/180/270, ritagliata, Letter orizzontale | su ogni pagina il testo è dritto e nella stessa posizione «come si vede» | e2e || ✅ passa |
| F01-E8 | stile | grassetto, corsivo, centrato, 24 pt, Noto Serif | nel PDF il font incorporato è quello scelto, la riga è centrata | e2e || ✅ passa |
| F01-E9 | larghezza mobile | 390 px | nessuno scorrimento orizzontale; avviso «Meglio da computer» chiudibile | e2e || ✅ passa |

## F02 Inserire un'immagine

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| F02-H1 | felice | Inserisci immagine → timbro.png → Salva | immagine nel PDF, centrata nella pagina corrente, trasparenza conservata | e2e || ✅ passa |
| F02-E1 | formato WebP | inserisci un WebP | convertito, inserito, presente nel PDF | e2e || ✅ passa |
| F02-E2 | immagine grande | PNG 4000×3000 | ridotta a metà pagina, PDF salvato | e2e || ✅ passa |
| F02-N1 | file non immagine | un .txt rinominato .png | messaggio chiaro, nessun elemento aggiunto | e2e || ✅ passa |

## F03 Forme, penna

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| F03-H1 | felice | Forma → rettangolo / ellisse / linea → clic | tre elementi del tipo giusto, con lo stile corrente | e2e || ✅ passa (falliva: BUG-003) |
| F03-H2 | penna | Penna → trascina sulla pagina | un elemento «Disegno a mano» | e2e || ✅ passa |
| F03-H3 | export fedele | tutti i tipi, ruotati e semitrasparenti, su pagine difficili | pagina dell'editor e pagina del PDF riaperto: ≥ 95% dei pixel disegnati coincide (il bianco non conta) | e2e || ✅ passa |
| F03-E1 | forma senza riempimento né bordo | togli bordo e riempimento | non deve restare un elemento invisibile e impossibile da trovare | e2e | ✅ dopo BUG-006 |

## F05 Gestire gli elementi

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| F05-H1 | trascina | trascina un rettangolo di 40×20 pt | posizione aggiornata di 40×20 pt | e2e || ✅ passa |
| F05-H2 | ridimensiona | trascina l'angolo | larghezza e altezza crescono, il bordo resta dello stesso spessore | e2e || ✅ passa |
| F05-H3 | elimina | seleziona, Canc | elemento rimosso, pannello aggiornato | e2e || ✅ passa |
| F05-H4 | frecce | seleziona, → e Maiusc+↓ | x +1, y +10 | e2e || ✅ passa |
| F05-H5 | livelli | «Porta avanti» nel pannello | l'ordine cambia anche nel PDF (sovrapposizione) | e2e || ✅ passa (falliva: BUG-003) |
| F05-H6 | rimuovi tutti | «Rimuovi tutti» → conferma | nessun elemento; «Annulla» nella conferma non rimuove nulla | e2e || ✅ passa (falliva: BUG-003) |
| F05-H7 | opacità | cursore al 50% | opacità 0,5 nell'elemento | e2e || ✅ passa (falliva: BUG-004) |
| F05-E1 | selezione dal pannello | clic su una riga del pannello di un elemento a pagina 3 | elemento selezionato, pagina 3 visibile | e2e || ✅ passa (falliva: BUG-004) |

## F06 PDF protetto

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| F06-H1 | felice | protetto-prova.pdf → «prova» → modifica → salva | PDF salvato, si apre senza password, testo originale leggibile, avviso in S05 | e2e || ✅ passa |
| F06-N1 | password errata | «sbagliata» | «Password errata. Riprova.», resta nella finestra | e2e || ✅ passa |
| F06-E1 | annulla | Annulla nella finestra | torna a S01 senza errori | e2e || ✅ passa |
| F06-E2 | soli permessi | solo-permessi.pdf | si apre senza password, si salva, avviso in S05 | e2e || ✅ passa |

## S01 Errori di apertura

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| S01-N1 | non PDF | non-sono-un-pdf.pdf | «Questo file non è un PDF» | e2e || ✅ passa |
| S01-N2 | danneggiato | danneggiato.pdf | «Non riesco ad aprire questo PDF» | e2e || ✅ passa |
| S01-N3 | troppo grande | file da 101 MB | «Il file supera i 100 MB», nessun blocco della pagina | e2e || ✅ passa |
| S01-E1 | trascinamento | trascina documento.pdf sul riquadro | si apre l'editor | e2e || ✅ passa |

## Trasversali (tutte le schermate)

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| X-E1 | ricarica a metà | modifiche non salvate, ricarica | il browser chiede conferma; dopo, si torna a S01 | e2e || ✅ passa |
| X-E2 | indietro | modifiche non salvate, chiudi con la X | conferma «Chiudere senza salvare?»; Continua non perde nulla | e2e || ✅ passa |
| X-E3 | offline | carica l'app, vai offline, apri un PDF, aggiungi testo, salva | funziona: il PDF non deve mai dipendere dalla rete | e2e || ✅ passa (falliva: BUG-002) |
| X-E4 | due schede | due schede con PDF diversi | indipendenti | manuale | ✅ provato: elementi e file separati |
| X-A1 | accessibilità | scansione axe su S01, S02, S03, S05 | nessuna violazione | e2e || ✅ passa (falliva: BUG-004, BUG-005) |
| X-A2 | console | in tutti i test | nessun errore in console, nessuna risposta 5xx | e2e || ✅ passa |

## Seconda tornata: annotazioni, annulla, mano, copia

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| F08-H1 | felice | Evidenzia testo → trascina sopra una riga → Salva | annotazione Highlight nel PDF sulla riga giusta, con il testo coperto; editor e PDF coincidono ≥ 95% | e2e | ✅ passa |
| F08-H2 | clic | clic su una parola | evidenziata la parola intera | e2e | ✅ passa (il test ha fatto scoprire l'aggancio impreciso ai caratteri, corretto) |
| F08-H3 | stili | Sottolinea e Barra | annotazioni Underline e StrikeOut; editor e PDF coincidono | e2e | ✅ passa |
| F08-N1 | PDF senza testo | apri scansione.pdf | strumento disattivato con il motivo; la scorciatoia A non lo attiva | e2e | ✅ passa |
| F03-H4 | evidenziatore | tratto sopra una riga | il testo sotto resta leggibile nell'editor e nel PDF (moltiplicazione) | e2e | ✅ passa (falliva: copriva il testo nell'editor, corretto) |
| F05-H8 | annulla | rettangolo, Maiusc+→ ×2, Ctrl Z, Annulla, Ripeti, Ctrl Maiusc Z | due frecce ravvicinate = un passo; stati e pulsanti corretti | e2e | ✅ passa |
| F05-H9 | annulla scrittura | scrivi una parola, Esc, Ctrl Z ×2 | un passo per la parola, uno per la casella | e2e | ✅ passa (falliva: passo vuoto in uscita dalla scrittura, corretto) |
| F05-H10 | copia | Ctrl C, Ctrl V | copia spostata di 12 pt, nuovo elemento | e2e | ✅ passa |
| F05-H11 | mano | trascina con la mano | il documento scorre, nessun elemento creato | e2e | ✅ passa |
| F01-E10 | sottolineato | testo sottolineato → Salva | editor e PDF coincidono | e2e | ✅ passa |

## Terza passata: casi limite delle novità

Lista standard applicata ad annulla, copia/incolla, annotazioni, evidenziatore, mano.
Non si applicano: rete lenta, sessioni, altri utenti, fusi orari (come sopra).

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| U-E1 | annulla poi salva | aggiungi due elementi, Ctrl Z, Salva | nel PDF c'è solo il primo | e2e || ✅ passa |
| U-E2 | annulla «Rimuovi tutti» | tre elementi, Rimuovi tutti, Ctrl Z | tornano tutti e tre | e2e || ✅ passa |
| U-E3 | Ctrl Z mentre si scrive | scrivi in una casella e premi Ctrl Z senza uscire | nessun errore; il testo resta coerente tra editor e stato | e2e || ✅ passa |
| U-E4 | annulla un'annotazione | evidenzia, Ctrl Z | annotazione rimossa dalla pagina e dal pannello | e2e || ✅ passa |
| C-E1 | incolla su un'altra pagina | copia a pagina 1, scorri a pagina 3, Ctrl V | la copia è a pagina 3, stessa posizione | e2e || ✅ passa |
| C-E2 | copia indipendente | copia un testo, incolla, modifica la copia | l'originale non cambia | e2e || ✅ passa (falliva: BUG-008) |
| C-E3 | Ctrl C mentre si scrive | seleziona parte del testo in modifica, Ctrl C, Esc, Ctrl V | non si incolla un elemento: Ctrl C in scrittura copia il testo, non l'elemento | e2e || ✅ passa |
| C-N1 | copiare un'annotazione | seleziona un'evidenziazione, Ctrl C, Ctrl V | non si crea nulla | e2e || ✅ passa |
| A-E1 | più righe | trascina su tre righe | una sola annotazione con tre aree; nel PDF tre QuadPoints | e2e || ✅ passa |
| A-E2 | trascinare dove non c'è testo | trascina su un'area vuota | nessuna annotazione | e2e || ✅ passa |
| A-E3 | pagina ruotata | trascina sul testo di una pagina ruotata di 90° | o si annota, o l'utente capisce che lì non si può | e2e || ✅ passa (falliva: BUG-007) |
| A-E4 | annotazioni ferme | seleziona un'evidenziazione, frecce e trascinamento | non si sposta | e2e || ✅ passa |
| A-E5 | PDF protetto | annota protetto-prova.pdf, salva | annotazione nel PDF, file non cifrato | e2e || ✅ passa |
| A-E6 | elimina | seleziona un'evidenziazione, Canc | rimossa | e2e || ✅ passa |
| M-E1 | larghezza mobile | 390 px con la barra completa | nessuno scorrimento orizzontale della pagina; strumenti raggiungibili scorrendo la barra | e2e || ✅ passa |
| C-E4 | inserire con un elemento selezionato | rettangolo selezionato → Inserisci immagine | l'immagine resta selezionata | e2e | ✅ passa (falliva: BUG-008) |
| C-E5 | copiare tra due PDF | copia un'immagine, chiudi, apri un altro PDF, incolla | l'immagine arriva nel secondo PDF | e2e | ✅ passa |
| X-E5 | avvisi tra documenti | avviso sul primo PDF, apri un altro PDF | nessun avviso residuo | e2e | ✅ passa (falliva: BUG-009) |
| V-M1 | zoom con annotazioni | 50% e 200% con evidenziazioni e tratti | nessuna pagina bianca durante lo zoom, annotazioni allineate al testo | manuale | ✅ provato |
| X-A2 | accessibilità strumenti nuovi | axe con Evidenzia testo, Evidenziatore, Mano attivi | nessuna violazione | e2e || ✅ passa |

## Terza tornata: avanzamento, onda, commenti

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| S01-E2 | PDF lungo | 500 pagine con CPU rallentata | barra «Apertura del PDF» con percentuale, poi l'editor | e2e | ✅ passa |
| S01-E3 | PDF piccolo | documento.pdf | nessuna barra che lampeggia | e2e | ✅ passa (falliva con soglia 250 ms: la prima apertura dura ~280 ms) |
| F08-H4 | onda | Sottolinea con onda su una riga | annotazione Squiggly; editor e PDF coincidono | e2e | ✅ passa |
| F09-H1 | commento | Commento → clic → scrivi → Salva | nota (Text) nel PDF con il testo; nessun cursore Opacità senza effetto | e2e | ✅ passa (falliva: focus tolto dal clic) |
| F09-E1 | commento vuoto | clic senza scrivere, Salva | nessuna annotazione nel PDF | e2e | ✅ passa |
| F09-E2 | sposta, accenti, emoji | trascina il commento; testo «Sì, è così 👍» | si sposta; il testo arriva intero nel PDF | e2e | ✅ passa (falliva: prima lettera persa) |
| F09-E3 | solo tastiera | Invio su Commento | commento al centro, campo già attivo | e2e | ✅ passa (falliva: selezione persa) |

## F04 Modificare il testo esistente

| caso | tipo | passi | atteso | auto | esito |
| --- | --- | --- | --- | --- | --- |
| M-U1 | motore | stringhe, numeri, array, immagini in linea | comandi letti tutti, nell'ordine | unit | ✅ passa |
| M-U2 | motore | togliere una riga da documento.pdf (font standard) e da un PDF stampato da Chrome (font a due byte) | il testo sparisce; ogni altro pezzo di testo resta nello stesso punto (±0,01 pt) | unit | ✅ passa |
| M-U3 | motore | togliere una parola in mezzo alla riga | il resto della riga finisce dove finiva | unit | ✅ passa |
| M-U4 | motore | pagina Letter orizzontale | il testo si toglie | unit | ✅ passa |
| F04-H1 | felice | M → clic su una riga → scrivi → Salva | nel PDF solo il testo nuovo, stessa linea di base (±0,6 pt), altre righe ferme | e2e | ✅ passa |
| F04-H2 | stile | importo in grassetto rosso su sfondo giallo | Noto Serif grassetto, colore rosso, sfondo giallo; nel PDF il nuovo importo e il resto della riga | e2e | ✅ passa (falliva: grassetto non riconosciuto) |
| F04-H3 | fedeltà | modifica e Salva | editor e PDF riaperto coincidono ≥ 95% | e2e | ✅ passa |
| F04-E1 | annulla | un Ctrl Z | spariscono testo nuovo e riquadro insieme | e2e | ✅ passa |
| F04-E2 | clic a vuoto | clic dove non c'è testo | avviso «Clicca su una riga di testo del PDF.» | e2e | ✅ passa |
| F04-N1 | senza testo | scansione.pdf | strumento disattivato | e2e | ✅ passa |
| F04-H4 | larghezza | riscrivere la stessa riga (Helvetica → Arimo, Georgia → Gelasio) | stessa larghezza dell'originale, scarto < 1 % | e2e | ✅ passa |

## Non costruiti (nessun test finché non esistono)

F07 campi modulo · allegati e segnalibri · vista a pagina singola · annotare il testo ruotato.
