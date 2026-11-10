// Stampa i frammenti di testo di un PDF con posizione (coordinate PDF) e dimensione.
// Uso: node scripts/inspect-text.mjs file.pdf [filtro]
import { readFileSync } from 'node:fs'
// pdf.js 6 usa Promise.withResolvers, assente in Node 20.
Promise.withResolvers ??= () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
const [file, filter = ''] = process.argv.slice(2)
const pdf = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 }).promise
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i)
  const vp = page.getViewport({ scale: 1 })
  const { items } = await page.getTextContent()
  for (const it of items) {
    if (!it.str || !it.str.includes(filter)) continue
    const [a, b, , , e, f] = it.transform
    const [vx, vy] = vp.convertToViewportPoint(e, f)
    console.log(JSON.stringify({ page: i, text: it.str, pdf: [+e.toFixed(2), +f.toFixed(2)], visto: [+vx.toFixed(2), +vy.toFixed(2)], size: +Math.hypot(a, b).toFixed(2), rot: page.rotate }))
  }
}
