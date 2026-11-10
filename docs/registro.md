# Registro dei lavori

Ramo: `build/editor`. Prova manuale e automatica con i PDF di `samples/` (`npm run samples`).

| ID | data | stato | cosa manca | più difficile del previsto |
| --- | --- | --- | --- | --- |
| S01 Caricamento | 2026-11-09 | fatto | percentuale di lettura (il file è locale: si vede solo "Apertura in corso…") | — |
| S02 Password | 2026-11-09 | fatto | — | **sì**: pdf-lib (fork `@cantoo/pdf-lib`) decifra, ma il file salvato restava "cifrato" per due oggetti residui (vecchio dizionario di cifratura e vecchio indice XRef). Ora vengono rimossi in `pdf/export.ts`. Provato solo con PDF cifrati da pdf-lib (AES-256): **da provare con PDF protetti da Acrobat/Word (AES-128, RC4)** |
| S03 Editor | 2026-11-09 | parziale | annulla/ripristina, modifica del testo esistente, evidenziatore e annotazioni, sottolineato, copia/incolla, strumento mano, vista a pagina singola | **sì**: far coincidere al punto le righe di testo tra editor (Fabric) ed export (pdf-lib). Risolto riproducendo le costanti di Fabric (`pdf/metrics.ts`) e salvando le righe come le dispone l'editor. In Fabric 7 l'origine predefinita è il centro: impostata ovunque in alto a sinistra |
| S03 Editor (2ª tornata) | 2026-11-09 | parziale | modifica del testo esistente, commenti, campi modulo, allegati e segnalibri | **sì**, tre cose: (1) evidenziatore ed evidenziazioni in moltiplicazione coprivano il testo nell'editor, perché Fabric disegna su un canvas separato sopra la pagina: ora la pagina è lo sfondo del canvas di Fabric; (2) uscire dalla scrittura creava un passo vuoto in Annulla: le modifiche che non cambiano nulla ora non entrano nella cronologia; (3) pdf.js non dà la posizione dei singoli caratteri: la si stima misurando i caratteri nella famiglia del font e riportandoli alla larghezza vera |
| S04 Elaborazione | 2026-11-09 | fatto | export in un Web Worker (ora nel thread principale: con file molto grandi la pagina può bloccarsi qualche secondo) | — |
| S05 Download | 2026-11-09 | fatto | — | — |

## Verifiche fatte

- **Posizione degli elementi nel PDF**: testo, rettangolo, ellisse, linea, disegno e immagine (anche ruotati e semitrasparenti) su pagine con rotazione 0/90/180/270, CropBox spostata e formati misti. Lo screenshot dell'editor e quello del PDF esportato e riaperto coincidono al 98,9–99,9% (`imgdiff.py --mode pixel`). La linea di base del testo è esattamente a (40; 54,07) "come si vede" su tutte e 5 le pagine (`node scripts/inspect-text.mjs`).
- **Caratteri**: accenti ed € si conservano; nel PDF finisce solo il sottoinsieme del font usato.
- **Password**: password errata → messaggio; password giusta → si modifica e si salva; PDF con soli permessi → si apre senza password; il nuovo file non è cifrato e la schermata S05 lo dice.
- **Errori**: file non PDF e PDF troncato → messaggi chiari, si resta in S01.
- **Tastiera**: strumento Testo con Invio → testo al centro della pagina corrente, già in modifica; frecce per spostare, Canc per eliminare, Esc per uscire.
- **Larghezze**: 1440 e 390 px senza scorrimento orizzontale; a 390 c'è un avviso chiudibile "Meglio da computer".
- **Build di produzione**: Content Security Policy attiva, 0 violazioni, 0 richieste verso altri siti, 0 errori in console.
- **Sicurezza delle dipendenze**: `npm` aveva installato pdfjs-dist 5.6.205, con una vulnerabilità alta (esecuzione di JavaScript da un PDF malevolo, GHSA-hq66-cqwq-w95j). Fissato a 6.4.299. `npm audit`: 0 vulnerabilità.

## Decisioni prese durante la costruzione

- `@cantoo/pdf-lib` al posto di `pdf-lib` (fermo dal 2022): mantenuto e capace di decifrare. Niente qpdf in WebAssembly.
- La **linea** è un rettangolo sottile senza bordo, sia nell'editor sia nel PDF: più semplice e identica nei due.
- Font del contenuto: solo Noto Sans, Noto Serif, Noto Sans Mono (statici, OFL, in `public/fonts`). Inter resta solo per l'interfaccia. Noto Sans Mono non ha corsivo: il pulsante si disattiva.
- Nessun indirizzo per le schermate: il PDF vive solo in memoria, ricaricare riporta a S01 (con avviso se ci sono modifiche non salvate).
- In sviluppo `window.__editor` espone lo stato per i test automatici; non esiste nella build.

## Seconda tornata (2026-11-09)

Costruiti, con test: annulla/ripristina, strumento mano, evidenziatore a mano libera, evidenziare / sottolineare / barrare il testo (annotazioni PDF vere), sottolineato del testo, copia/incolla. Test: 49, tutti verdi.

Limiti noti delle novità:
- si annota solo il testo orizzontale "come si vede" (non quello ruotato o verticale);
- l'aggancio ai caratteri è una stima (molto buona sui font comuni, può sbagliare di un carattere su font molto particolari);
- le annotazioni restano sempre sopra gli altri elementi, nel PDF come nell'editor;
- annotare richiede il mouse (o il tocco): con la sola tastiera non si seleziona il testo da evidenziare;
- copia/incolla usa appunti interni all'editor, non quelli del sistema.

## Terza tornata (2026-11-10, ramo `build/rapidi`)

Costruiti, con test: avanzamento all'apertura dei PDF lunghi, sottolineatura ondulata (Squiggly), commenti sulla pagina (annotazioni «nota»). Test: 75, tutti verdi.

Più difficile del previsto: dare il focus al campo del commento. Il clic sulla pagina lo toglieva subito dopo averlo dato, e inserendo da tastiera il gruppo di strumenti deselezionava l'elemento appena creato. Il primo tentativo di correzione (rimandare l'inserimento) faceva perdere le prima lettere scritte subito dopo Invio: l'ha scoperto il test F01-E5. Ora, da tastiera, il gruppo di strumenti non cambia strumento e l'inserimento resta immediato. Lo stesso problema riguardava già il Testo inserito da tastiera, che lasciava attivo lo strumento Testo.

## Non ancora fatto (in ordine)

1. Prototipo della modifica del testo esistente (il rischio maggiore, vedi architettura.md)
2. Export nel Web Worker; divisione del bundle (ora un file JS da ~2 MB, più il worker di pdf.js)
3. Annotare il testo ruotato o verticale (oggi l'editor lo riconosce e lo dice, vedi BUG-007)
4. Campi modulo, allegati e segnalibri, vista a pagina singola (facoltativi)
5. Prova con PDF reali del team, soprattutto protetti da Acrobat/Word
