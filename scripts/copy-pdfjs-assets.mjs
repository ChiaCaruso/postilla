// Copia in public/pdfjs/ le risorse di pdf.js (cmaps, font standard, wasm, profili ICC):
// l'app non scarica nulla da internet, quindi vanno servite dallo stesso sito.
import { cpSync, mkdirSync } from 'node:fs'
const from = new URL('../node_modules/pdfjs-dist/', import.meta.url)
const to = new URL('../public/pdfjs/', import.meta.url)
mkdirSync(to, { recursive: true })
for (const d of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) cpSync(new URL(d, from), new URL(d, to), { recursive: true })
