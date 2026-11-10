# Difetti

Build di partenza: `da7705f`. Browser: Chromium 158 (Playwright), 1440×900 salvo dove indicato.
Ogni difetto ha un test in `e2e/` che fallisce finché non è corretto.

| ID | gravità | titolo | stato |
| --- | --- | --- | --- |
| BUG-001 | S2 | Le emoji spariscono dal PDF senza avviso | risolto in `0493a50` (avviso) |
| BUG-002 | S3 | Senza rete non si apre nessun PDF, anche con l'app già caricata | risolto in `ee1f68f` (con un limite, vedi sotto) |
| BUG-003 | S3 | Con un elemento selezionato, lo strumento Forma non mostra i tipi di forma | risolto in `ee1f68f` |
| BUG-004 | S3 | I cursori (Opacità, Spessore) non hanno un nome per i lettori di schermo | risolto in `ee1f68f` |
| BUG-005 | S3 | Editor senza punti di riferimento (landmark); area delle pagine non raggiungibile da tastiera | risolto in `ee1f68f` |
| BUG-006 | S4 | Togliendo bordo e riempimento una forma diventa invisibile sulla pagina | risolto in `ee1f68f` |
| BUG-007 | S3 | Sulle pagine ruotate «Evidenzia testo» non fa nulla e non lo dice | risolto in `03fe219` (avviso; annotare il testo ruotato resta da fare) |
| BUG-008 | S3 | Dopo Incolla (o inserendo con un altro elemento selezionato) la selezione si perde | risolto in `03fe219` |
| BUG-009 | S4 | Un avviso resta visibile anche dopo aver aperto un altro documento | risolto in `03fe219` |

Aperti: nessuno.

---

### BUG-001: le emoji spariscono dal PDF senza avviso

- Severity: S2
- Flow / case: F01 / F01-E3
- Screen: S03, S05

Steps
1. Apri `samples/documento.pdf`.
2. Strumento Testo, clic sulla pagina, scrivi «Ok 👍», Esc.
3. Salva e scarica.

Expected: l'emoji compare nel PDF, oppure l'editor avvisa che non è supportata.
Actual: nell'editor l'emoji si vede (il browser usa un suo font), nel PDF scaricato c'è solo «Ok ». Nessun avviso.
Evidence: test `F01-E3 le emoji non spariscono in silenzio`.
Suspected cause: i font Noto Sans/Serif/Mono non contengono emoji; pdf-lib salta i caratteri mancanti.
Status: risolto in `0493a50`: l'editor controlla i caratteri con il font scelto e mostra «Alcuni caratteri non finiranno nel PDF», elencandoli. Le emoji restano non supportate nel PDF (servirebbe un font a colori, che pdf-lib non gestisce).

### BUG-002: senza rete non si apre nessun PDF

- Severity: S3 (si aggira tornando online)
- Flow / case: trasversale / X-E3
- Screen: S01

Steps
1. Apri l'app.
2. Togli la rete.
3. Scegli `samples/documento.pdf`.

Expected: il PDF si apre: dopo il caricamento della pagina l'app non dovrebbe aver bisogno della rete.
Actual: l'editor non compare; in console `net::ERR_INTERNET_DISCONNECTED`.
Evidence: test `X-E3 senza rete si apre, si modifica e si salva`.
Suspected cause: il worker di pdf.js e i font vengono scaricati solo quando servono.
Status: risolto in `ee1f68f`: il worker parte all'avvio, i font vengono scaricati in memoria quando il browser è libero (~6,5 MB, una volta per sessione) e usati sia dall'editor sia dall'export. Verificato anche sulla build di produzione senza rete. **Limite:** pdf.js carica al bisogno altre risorse (font standard per PDF senza font incorporati, mappe per lingue asiatiche, decoder JPEG 2000): senza rete quei PDF si aprono, ma possono comparire con un font sostitutivo. La soluzione completa è un service worker (app installabile).

### BUG-003: con un elemento selezionato, lo strumento Forma non mostra i tipi di forma

- Severity: S3 (si aggira cliccando prima sullo sfondo)
- Flow / case: F03 / F03-H1, F05-H5, F05-H6
- Screen: S03

Steps
1. Apri `documento.pdf`, inserisci un rettangolo (resta selezionato).
2. Clicca di nuovo «Forma».

Expected: la barra mostra Rettangolo / Ellisse / Linea per scegliere la prossima forma.
Actual: la barra continua a mostrare le proprietà del rettangolo selezionato; non si può cambiare tipo di forma.
Evidence: test `F03-H1` (timeout sul pulsante «Ellisse»).
Status: risolto in `ee1f68f`: scegliere Testo, Forma o Penna deseleziona l'elemento corrente.

### BUG-004: i cursori non hanno un nome accessibile

- Severity: S3
- Flow / case: F05 / F05-H7, F05-E1, X-A1
- Screen: S03

Steps
1. Seleziona un elemento.
2. Con un lettore di schermo (o axe) raggiungi il cursore dell'opacità.

Expected: il cursore si chiama «Opacità».
Actual: nessun nome (axe: `aria-input-field-name`, serio). L'etichetta è collegata al contenitore, non al cursore.
Evidence: test `F05-H7`, `X-A1 accessibilità dell'editor`.
Status: risolto in `ee1f68f`.

### BUG-005: editor senza landmark; area delle pagine non raggiungibile da tastiera

- Severity: S3
- Flow / case: X-A1
- Screen: S03

Expected: un `main`, regioni con nome per strumenti e pagine; l'area delle pagine scorre anche da tastiera.
Actual: axe: `landmark-one-main`, `region`, `scrollable-region-focusable` (serio).
Evidence: test `X-A1 accessibilità dell'editor con un elemento selezionato`.
Status: risolto in `ee1f68f`: `main` «Pagine del documento» (raggiungibile con Tab), regione «Strumenti di modifica». axe: 0 violazioni su S01, S02, S03, S05.

### BUG-006: togliendo bordo e riempimento una forma diventa invisibile

- Severity: S4
- Flow / case: F03 / F03-E1
- Screen: S03

Steps
1. Inserisci un rettangolo (per default ha solo il bordo).
2. Bordo → «Nessuno».

Expected: non si può arrivare a una forma senza niente di visibile.
Actual: la forma resta nel pannello Elementi ma sulla pagina non si vede e non si può più cliccare.
Evidence: `samples/out/forma-invisibile.png`; test `F03-E1`.
Status: risolto in `ee1f68f`: «Nessuno» compare solo se l'altro (bordo o riempimento) è presente.

### BUG-007: sulle pagine ruotate «Evidenzia testo» non fa nulla e non lo dice

- Severity: S3 (si aggira con l'evidenziatore a mano libera)
- Flow / case: F08 / A-E3
- Screen: S03
- Build: `dba4dfb`

Steps
1. Apri `samples/pagine-difficili.pdf` (pagina 1 ruotata di 90°).
2. Strumento «Evidenzia, sottolinea o barra il testo», trascina sopra il titolo verticale.

Expected: il testo viene annotato, oppure l'utente capisce che lì non si può.
Actual: non succede nulla, nessun messaggio.
Evidence: test `A-E3`.
Suspected cause: in v1 si annota solo il testo orizzontale "come si vede"; il resto viene scartato in silenzio.
Status: risolto in `03fe219`: l'editor riconosce il testo ruotato sotto il trascinamento e mostra «Qui il testo è ruotato: per ora si può evidenziare solo il testo orizzontale. Puoi usare l'evidenziatore a mano libera.» Annotare davvero il testo ruotato è una funzione da costruire (vedi build-log).

### BUG-008: dopo Incolla la selezione si perde

- Severity: S3 (si aggira cliccando l'elemento)
- Flow / case: F05 / C-E2
- Screen: S03
- Build: `dba4dfb`

Steps
1. Inserisci un testo e selezionalo.
2. Ctrl C, Ctrl V.

Expected: la copia resta selezionata e la barra mostra le sue proprietà.
Actual: nessun elemento selezionato; la barra mostra «Seleziona un elemento…».
Evidence: test `C-E2` (il cursore «Opacità» non c'è).
Suspected cause: l'oggetto grafico della copia nasce un istante dopo; nel frattempo l'editor deseleziona l'originale e quella deselezione cancella anche la selezione nuova. Capita anche inserendo un'immagine con un altro elemento selezionato.
Status: risolto in `03fe219`: i cambi di selezione fatti dall'editor non vengono più scambiati per scelte dell'utente. Test `C-E2`, `C-E4`.

### BUG-009: un avviso resta visibile aprendo un altro documento

- Severity: S4
- Flow / case: trasversale / X-E5
- Screen: S03
- Build: `dba4dfb`

Steps
1. Apri `pagine-difficili.pdf`, prova ad annotare il testo ruotato (compare l'avviso).
2. Chiudi il PDF e aprine un altro.

Expected: il nuovo documento si apre senza avvisi.
Actual: l'avviso del documento precedente è ancora lì; quando sparisce (al cambio di strumento) la pagina si sposta verso l'alto.
Evidence: trovato nel giro a mano (`samples/out/manuale-zoom-50.png`: i tratti finiscono più in basso del previsto); test `X-E5`.
Status: risolto in `03fe219`.

## Da verificare (non riprodotti)

- PDF protetti da Acrobat o Word (AES-128, RC4): provati solo quelli cifrati con pdf-lib.
- PDF di 80–100 MB: l'export avviene nel thread principale, la pagina potrebbe bloccarsi.
