# Marchio di Postilla

## Nome

**Postilla**: la nota scritta a margine di un documento. Dice cosa fa lo strumento (annotare, correggere, commentare un PDF), è italiano, corto, si scrive come si pronuncia.

Candidati considerati, per stile:

| stile | candidati |
| --- | --- |
| descrittivo | Annota, Correttore, Ritocco, Segnapagina |
| composto | PaginaViva, Fogliofacile, Notapagina, Bordopagina |
| inventato | Pagio, Notabè, Fogliolo |
| metafora | **Postilla**, Lapis, Margine, Tratto, Glossa, Chiosa, Penna rossa |
| verbo | Segna, Correggi |

## Logo

Mascotte a forma di foglio con due matite, post-it e segni di spunta; sotto, la scritta «postilla» in blu notte e viola.

| file | uso |
| --- | --- |
| `brand/postilla-logo-sorgente.jpg` | originale, da non modificare |
| `brand/postilla-logo-readme.png` | README (su fondo bianco, leggibile anche col tema scuro di GitHub) |
| `public/brand/postilla-logo.png` | schermata iniziale (480 px, sfondo trasparente) |
| `public/brand/postilla-mascotte.png` | sola mascotte (256 px, trasparente) |
| `public/favicon.ico`, `favicon-16.png`, `favicon-32.png` | icona della scheda: **solo il foglio con la faccia**, perché a 16–48 px la mascotte intera è illeggibile |
| `public/favicon-192.png` | icona grande |
| `public/apple-touch-icon.png` | iPhone/iPad (180 px, sfondo bianco: Apple non accetta trasparenze) |

Tutti tranne il sorgente si rigenerano con `python3 scripts/brand-assets.py` (serve Pillow). Lo sfondo chiaro viene tolto partendo dai bordi, così i bianchi dentro il disegno restano.

## Colori

L'interfaccia usa il primario **blu `#2f5bea`** e una scala di grigi neutri, definiti come ruoli in `docs/design/tokens.json` (21 abbinamenti di testo e sfondo, tutti almeno AA). Il logo usa blu notte, viola, arancio e azzurro: convivono bene; per un'identità più unita basta cambiare il primario nei token e ricontrollare i contrasti.

## Tono

| parola | non vuol dire |
| --- | --- |
| **chiaro** | freddo o tecnico |
| **pratico** | sbrigativo |
| **discreto** | anonimo |

| sì | no |
| --- | --- |
| «Salva il PDF» | «Esporta il documento elaborato» |
| «Il file resta sul tuo computer» | «Massima sicurezza garantita!» |
| «Questo file non è un PDF» | «Errore 415: formato non supportato» |
| «Qui il testo è ruotato: per ora…» (spiega e propone un'alternativa) | «Operazione non riuscita» |
| dare del tu, frasi corte | punti esclamativi, superlativi, gergo |
