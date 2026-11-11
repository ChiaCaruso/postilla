// Motore per togliere testo esistente (src/pdf/contentStream.ts, src/pdf/textEdit.ts), senza browser.
import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument } from '@cantoo/pdf-lib'
import { sample, pdfTexts, pdfToPdfMatrices, type TextItem } from './helpers'
import { eraseText, analyzePage, glyphsIn } from '../src/pdf/textEdit'
import { parseContent } from '../src/pdf/contentStream'

/** Riquadro "come si vede" di un pezzo di testo letto da pdf.js (solo testo dritto). */
const boxOf = (t: TextItem, from = 0, to = t.text.length) => {
  const k = t.width / t.text.length // stima, basta per i test: il riquadro taglia a metà dei caratteri
  return { x: t.x + k * from + k * 0.3, y: t.y - t.size * 0.8, w: k * (to - from) - k * 0.6, h: t.size * 1.0 }
}

async function erase(file: string, page: number, boxes: Array<{ x: number; y: number; w: number; h: number }>, out: string) {
  const mats = await pdfToPdfMatrices(file)
  const pdf = await PDFDocument.load(readFileSync(file))
  const r = eraseText(pdf, page, boxes, mats[page])
  writeFileSync(out, await pdf.save())
  return r
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

test.describe('motore: togliere testo esistente', () => {
  test('lettore dei comandi: stringhe, numeri, array, immagini in linea', () => {
    const src = '1 0 0 1 10 20 cm BT /F1 12 Tf (a\\(b\\)c \\101) Tj [<0041> -250 (x)] TJ ET BI /W 2 /H 1 ID \x00\xffEI\n EI Q'
    const ops = parseContent(new TextEncoder().encode(src))
    expect(ops.map((o) => o.op)).toEqual(['cm', 'BT', 'Tf', 'Tj', 'TJ', 'ET', 'BI', 'Q'])
    const tj = ops[3].args[0]
    expect(tj.t === 'str' && new TextDecoder().decode(tj.v)).toBe('a(b)c A')
  })

  for (const [file, target] of [
    ['documento.pdf', 'Verbale della riunione del 4 novembre 2026.'],
    ['stampato-da-chrome.pdf', 'Gentile cliente, le confermiamo la fornitura descritta qui sotto.'],
  ] as const) {
    test(`${file}: una riga tolta sparisce, il resto della pagina non si muove`, async ({}, info) => {
      const before = await pdfTexts(sample(file))
      const t = before.find((x) => x.text === target)!
      expect(t, 'riga di prova presente').toBeTruthy()
      const out = info.outputPath('tolto.pdf')
      const r = await erase(sample(file), t.page - 1, [boxOf(t)], out)
      expect(r.removed).toBe(target.length)
      expect(r.skipped).toBe(0)
      const after = await pdfTexts(out)
      expect(after.filter((x) => x.page === t.page).map((x) => x.text).join(' ')).not.toContain(target.slice(0, 12))
      // ogni altro pezzo di testo della pagina è ancora lì, nello stesso punto
      for (const o of before.filter((x) => x !== t && x.text.trim())) {
        const same = after.find((a) => a.page === o.page && a.text === o.text)
        expect(same, `«${o.text}» c'è ancora`).toBeTruthy()
        expect(near(same!.x, o.x) && near(same!.y, o.y), `«${o.text}» non si è spostato`).toBe(true)
      }
    })
  }

  test('stampato-da-chrome.pdf: togliendo una parola, il resto della riga resta al suo posto', async ({}, info) => {
    const file = sample('stampato-da-chrome.pdf')
    const before = await pdfTexts(file)
    const line = before.find((x) => x.text.startsWith('Gentile cliente,'))!
    const out = info.outputPath('parola.pdf')
    // "cliente," = caratteri 8..16
    const r = await erase(file, 0, [boxOf(line, 8, 16)], out)
    expect(r.removed).toBeGreaterThanOrEqual(7)
    const after = (await pdfTexts(out)).filter((a) => near(a.y, line.y))
    const joined = after.map((a) => a.text).join('|')
    expect(joined).toContain('Gentile')
    expect(joined).not.toContain('cliente')
    // la parte finale della riga finisce esattamente dove finiva prima
    const last = after.sort((a, b) => a.x - b.x).at(-1)!
    expect(last.x + last.width).toBeCloseTo(line.x + line.width, 1)
  })

  test('pagine ruotate: il testo si toglie anche lì', async ({}, info) => {
    const file = sample('pagine-difficili.pdf')
    const before = await pdfTexts(file)
    const t = before.find((x) => x.page === 2 && x.text.startsWith('Verbale'))! // pagina 2: Letter orizzontale, testo dritto
    const out = info.outputPath('ruotata.pdf')
    const r = await erase(file, 1, [boxOf(t)], out)
    expect(r.removed).toBeGreaterThan(10)
    expect((await pdfTexts(out)).filter((a) => a.page === 2).map((a) => a.text)).not.toContain(t.text)
  })

  test('analisi: i caratteri di una riga si trovano e risultano modificabili', async () => {
    const file = sample('stampato-da-chrome.pdf')
    const t = (await pdfTexts(file)).find((x) => x.text.startsWith('Totale da pagare'))!
    const mats = await pdfToPdfMatrices(file)
    const pdf = await PDFDocument.load(readFileSync(file))
    const g = glyphsIn(analyzePage(pdf, 0), [boxOf(t)], mats[0])
    expect(g.removable).toBeGreaterThan(10)
    expect(g.blocked).toBe(0)
  })
})
