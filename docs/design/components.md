# Componenti dell'editor PDF interno

Fonte dei valori: `docs/design/tokens.json` → `npm run tokens` → `src/styles/tokens.css` (temi Tailwind v4).
Punti di rottura: solo `md` (768), `lg` (1024), `xl` (1440); `sm:` non esiste.
Nei componenti si usano solo classi dei token (`bg-surface`, `text-text-muted`, `border-border`…). La tavolozza predefinita di Tailwind è disattivata: un colore scritto a mano non compila.

Valori definiti da zero per questo progetto. Struttura: barra strumenti in alto, pagine al centro, pannello Elementi, barra delle proprietà.
Icone: Lucide (licenza ISC). Font dell'interfaccia: Inter Variable (OFL), incluso nell'app: nessuna richiesta a Google Fonts.
Basi accessibili: Radix (Tooltip, Popover, Dialog, Slider, ToggleGroup).
Testi: tutti scritti da zero, in italiano.

Codice: `src/ui/`. Pagina di prova con tutti i componenti e stati: `npm run dev` → http://localhost:5173/design.html

## Disposizione

```
S01 Caricamento     header 56 · contenuto centrato, max 960 · area di caricamento grande
S03 Editor          header 56 · barra strumenti 48 · barra proprietà 44 (solo con elemento selezionato)
                    area "canvas" grigia con pagine bianche (ombra page, distanza 24) · pannello Elementi 288 a destra
                    sotto 1024px il pannello diventa un cassetto apribile; sotto 768px l'editor mostra un avviso "meglio da computer"
S05 Download        come S01, scheda centrata
```

## Button

```
variants  primary, secondary, ghost, danger, danger-ghost (azione distruttiva secondaria)
sizes     sm 32px, md 40px, lg 48px (lg solo per l'azione principale di pagina: "Scegli un PDF", "Salva il PDF")
states    default, hover, active, focus-visible (anello 2px accent, distanza 2px), disabled (opacità 50%), loading
tokens    primary: bg accent → accent-hover, text on-accent · secondary: bg bg, bordo border-input · ghost: hover bg surface
          danger: bg danger, text on-accent · danger-ghost: text danger, hover bg danger-subtle · radius md · testo sm/600 (lg: base/600)
a11y      vero <button>; in caricamento aria-busy, resta disabilitato e mantiene l'etichetta (lo spinner è decorativo)
used on   S01, S02, S03, S04, S05
```

## IconButton

```
variants  normale, attivabile (aria-pressed)
sizes     sm 32px, md 36px (barra strumenti)
states    default, hover (bg surface), premuto/attivo (bg accent-subtle, icona accent), focus-visible, disabled
tokens    icona 18px, radius sm
a11y      etichetta obbligatoria: diventa aria-label e tooltip; il tooltip compare anche con il focus da tastiera
used on   S03 (barra strumenti, zoom, pannello Elementi)
```

## Toolbar (strumenti dell'editor)

```
contenuto Seleziona · Testo · Immagine · Forma · Disegno · Evidenzia | Annulla · Ripeti | Zoom
states    uno strumento attivo alla volta; strumento non disponibile = disabled con motivo nel tooltip
          (es. Evidenzia su PDF scansionato: "Questo PDF non contiene testo selezionabile")
tokens    altezza 48, bg bg, bordo inferiore border, separatori border
a11y      role toolbar; frecce sinistra/destra spostano il focus (ToggleGroup Radix); scorciatoie mostrate nel tooltip
used on   S03
```

## PropertyBar

```
contenuto cambia con l'elemento selezionato:
          testo: font, dimensione, colore, grassetto, corsivo, sottolineato, allineamento
          forma: riempimento, bordo, spessore
          disegno: colore, spessore
          sempre: trasparenza, rotazione, livello (avanti/indietro), elimina
states    nascosta senza selezione; selezione multipla mostra solo le proprietà comuni
tokens    altezza 44, bg surface, bordo inferiore border, gruppi separati da border, gap 8
a11y      role toolbar con aria-label "Proprietà dell'elemento"
used on   S03
```

## ColorPicker

```
variants  colori del contenuto (8), colori evidenziatore (4) — dai token "swatches", non dall'interfaccia
states    chiuso (pulsante con il colore attuale), aperto (popover), colore selezionato (anello accent)
tokens    popover bg bg, shadow pop, radius md; campioni 24px, radius pill, bordo border
a11y      popover Radix (Esc chiude, focus torna al pulsante); campioni come radiogroup con nome del colore ("Rosso")
used on   S03
```

## Slider

```
uso       trasparenza (0–100%), spessore (1–20 pt)
states    default, focus-visible (anello sul cursore), disabled
tokens    binario border, parte piena accent, cursore 16px bg bg con bordo accent
a11y      Radix Slider: frecce ±1, PagSu/PagGiù ±10; etichetta visibile e valore letto (aria-valuetext "40%")
used on   S03
```

## Select

```
uso       font (Noto Sans, Noto Serif, Noto Sans Mono, Inter), dimensione del testo
states    default, hover, focus-visible, disabled
tokens    altezza 32, bordo border-input, radius sm, testo sm
a11y      <select> nativo con <label>: tastiera e lettori di schermo funzionano senza codice in più
used on   S03
```

## TextField

```
uso       password (S02), nome del file in uscita (S05, facoltativo)
states    default, focus-visible, errore (bordo danger, messaggio sotto), disabled
tokens    altezza 40, bordo border-input, radius sm, testo base; errore text danger xs
a11y      <label> collegata; errore con aria-invalid e aria-describedby; type="password" con pulsante mostra/nascondi
used on   S02, S05
```

## Dropzone

```
states    vuota, trascinamento sopra (bordo accent, bg accent-subtle), lettura in corso (ProgressBar), errore (Banner danger sotto)
contenuto icona, frase breve, pulsante lg "Scegli un PDF", nota "Il file resta sul tuo computer"
tokens    bordo 2px tratteggiato border-input, radius lg, padding 48, bg surface
a11y      il pulsante apre il selettore file (input nascosto ma raggiungibile); il trascinamento è un'alternativa, mai l'unico modo
used on   S01
```

## ProgressBar

```
variants  determinata (percentuale), indeterminata (elaborazione)
tokens    altezza 8, radius pill, binario border, riempimento accent
a11y      role progressbar con aria-valuenow (assente se indeterminata) e etichetta ("Lettura del file", "Preparazione del PDF")
used on   S01, S04
```

## Banner

```
variants  info (surface), warning (warning-subtle / warning), danger (danger-subtle / danger), success
contenuto icona, titolo breve, frase, azione facoltativa, chiudi facoltativo
a11y      danger e warning con role alert; gli altri role status
used on   S01 (file non PDF, troppo grande, danneggiato), S03 (PDF scansionato, password rimossa all'export), tutte (nessuna connessione non serve: l'app è locale)
```

## Modal

```
uso       richiesta password (S02), conferme distruttive ("Rimuovere tutti gli elementi?")
states    aperto, invio in corso, errore nel campo
tokens    bg bg, radius lg, shadow pop, larghezza 420, sfondo text al 40%
a11y      Radix Dialog: focus intrappolato, Esc chiude, titolo e descrizione collegati, focus torna al pulsante d'origine
used on   S02, S03
```

## ElementRow (pannello Elementi)

```
contenuto icona del tipo, descrizione ("Testo: Fattura n. 12…", "Immagine", "Rettangolo"), pagina, azioni: su, giù, elimina
states    normale, hover, selezionato (bg accent-subtle, bordo sinistro accent), vuoto (messaggio nel pannello)
a11y      lista; ogni riga è un pulsante per selezionare l'elemento; le azioni hanno etichette proprie
used on   S03
```

## ZoomControl

```
contenuto − · percentuale · + · "Adatta alla larghezza"
range     25%–400%, passi 25/50/75/100/125/150/200/300/400
a11y      gruppo con etichetta; la percentuale è annunciata (aria-live polite); Ctrl + e Ctrl − dalla tastiera
used on   S03
```

## PageFrame e maniglie di selezione

```
pagina    bg page, shadow page, distanza tra pagine 24, numero pagina sotto in xs text-muted
maniglie  quadrati 10px bg bg con bordo selection 1.5px; riquadro di selezione bordo selection 1px; maniglia di rotazione sopra
          (configurazione di Fabric.js, non componenti React: gli stessi token vanno passati a Fabric)
a11y      ogni elemento sulla pagina ha anche la sua riga nel pannello Elementi: da lì si seleziona, si sposta (frecce ±1pt, Maiusc ±10pt) e si elimina senza mouse
used on   S03
```

## DownloadCard

```
contenuto nome del file, dimensione, numero pagine, pulsante primary lg "Scarica il PDF",
          secondary "Modifica ancora", danger-ghost "Chiudi ed elimina dalla memoria"
states    pronto, avviso (PDF in origine protetto: ora non lo è più)
tokens    bg bg, bordo border, radius lg, shadow card, padding 32
a11y      il titolo riceve il focus all'arrivo sulla schermata
used on   S05
```
