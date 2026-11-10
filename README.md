# Postilla

Editor PDF interno. Si apre un PDF, si aggiungono testo, immagini, forme, disegni, evidenziazioni e commenti, e si salva una copia.

**Il PDF non lascia mai il computer di chi lo modifica.** Non c'è un server: tutto avviene nel browser, e nella versione pubblicata il browser blocca qualsiasi connessione verso altri siti.

## Cosa sa fare

- Testo con tre font (Noto Sans, Serif, Mono), dimensione, colore, grassetto, corsivo, sottolineato, allineamento
- Immagini (PNG, JPG; WebP e GIF convertiti), forme (rettangolo, ellisse, linea), penna, evidenziatore a mano libera
- Evidenziare, sottolineare (anche con l'onda) e barrare il testo del PDF: nel file sono annotazioni vere, modificabili in Acrobat
- Commenti sulla pagina (note PDF)
- Annulla/Ripeti, copia/incolla anche tra PDF diversi, pannello Elementi con l'ordine dei livelli
- PDF protetti da password (il file salvato non è protetto: lo si dice all'utente)
- Funziona anche senza rete, una volta aperta la pagina

Limiti noti: non modifica il testo già presente nel PDF; si annota solo il testo orizzontale; emoji e alcuni simboli non entrano nel PDF (l'editor avvisa); file fino a 100 MB.

## Sviluppo

Serve Node 20 o successivo.

```bash
npm install
npm run dev          # http://localhost:5173 · componenti: /design.html
npm test             # test end-to-end (Playwright avvia da solo il server)
npm run samples      # rigenera i PDF di prova in samples/
npm run tokens       # rigenera src/styles/tokens.css da docs/design/tokens.json
```

## Pubblicazione

```bash
npm run build        # risultato in dist/
```

`dist/` è un insieme di file statici: va bene qualsiasi server web (anche interno). Nessun server applicativo, nessun database.

## Struttura

- `src/pdf/` apertura (pdf.js), esportazione (pdf-lib), font, testo della pagina
- `src/editor/` livello modificabile sulle pagine (Fabric.js), barra delle proprietà
- `src/screens/` le schermate: caricamento, editor, elaborazione, download
- `src/ui/` componenti dell'interfaccia; colori e misure solo dai token
- `e2e/` test Playwright · `samples/` PDF di prova · `docs/` design (token e componenti) e screenshot

## Licenze

Codice dell'app: interno. Librerie: pdf.js (Apache-2.0), @cantoo/pdf-lib e fontkit (MIT), Fabric.js (MIT), React, Radix, Lucide (MIT/ISC). Font Noto e Inter: SIL Open Font License (`public/fonts/OFL.txt`).
