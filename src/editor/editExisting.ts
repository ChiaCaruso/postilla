// Strumento «Modifica testo»: dal clic su una riga del PDF agli elementi che la sostituiscono.
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PDFDocument } from '@cantoo/pdf-lib'
import type { Documento, EraseElement, FontFamily, TextElement } from '../model'
import { getTextRuns, type TextRun } from '../pdf/textRuns'
import { analyzePage, dominantFont, glyphsIn, type PageText } from '../pdf/textEdit'
import { loadPdf } from '../pdf/export'
import { hasItalic, loadFontFace } from '../pdf/fonts'
import { TEXT_METRICS } from '../pdf/metrics'

type New<T> = Omit<T, 'id' | 'z'>

// Il PDF aperto con pdf-lib e l'analisi delle pagine si calcolano una volta per documento.
const docs = new WeakMap<Documento, Promise<PDFDocument>>()
const pages = new WeakMap<PDFDocument, Map<number, PageText>>()

async function pageText(doc: Documento, pageIndex: number): Promise<{ pdf: PDFDocument; text: PageText }> {
  let p = docs.get(doc)
  if (!p) {
    p = loadPdf(doc).then((r) => r.pdf)
    docs.set(doc, p)
  }
  const pdf = await p
  let byPage = pages.get(pdf)
  if (!byPage) pages.set(pdf, (byPage = new Map()))
  if (!byPage.has(pageIndex)) byPage.set(pageIndex, analyzePage(pdf, pageIndex))
  return { pdf, text: byPage.get(pageIndex)! }
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/**
 * Colore dello sfondo (il più frequente) e del testo (il più frequente tra i pixel lontani dallo sfondo)
 * nel riquadro della riga, letti dalla pagina già disegnata.
 */
export function sampleColors(bitmap: HTMLCanvasElement, pageWidth: number, box: { x: number; y: number; w: number; h: number }) {
  const k = bitmap.width / pageWidth
  const x = Math.max(0, Math.floor(box.x * k))
  const y = Math.max(0, Math.floor(box.y * k))
  const w = Math.max(1, Math.min(bitmap.width - x, Math.ceil(box.w * k)))
  const h = Math.max(1, Math.min(bitmap.height - y, Math.ceil(box.h * k)))
  const data = bitmap.getContext('2d')!.getImageData(x, y, w, h).data
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  const key = (r: number, g: number, b: number) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
  for (let i = 0; i < data.length; i += 4) {
    const kk = key(data[i], data[i + 1], data[i + 2])
    const e = buckets.get(kk) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++
    e.r += data[i]
    e.g += data[i + 1]
    e.b += data[i + 2]
    buckets.set(kk, e)
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n)
  const bg = sorted[0]
  const [br, bgG, bb] = [bg.r / bg.n, bg.g / bg.n, bg.b / bg.n]
  const far = sorted.filter((e) => Math.hypot(e.r / e.n - br, e.g / e.n - bgG, e.b / e.n - bb) > 90)
  const fg = far[0]
  return {
    background: hex(br, bgG, bb),
    text: fg ? hex(fg.r / fg.n, fg.g / fg.n, fg.b / fg.n) : '#14171c',
  }
}

/** Font d'ufficio → font incluso con le stesse larghezze dei caratteri. */
const COMPATIBLE: Array<[RegExp, FontFamily]> = [
  [/calibri|carlito/i, 'Carlito'],
  [/cambria|caladea/i, 'Caladea'],
  [/georgia|gelasio/i, 'Gelasio'],
  [/courier|cousine|liberation ?mono/i, 'Cousine'],
  [/times|tinos|liberation ?serif/i, 'Tinos'],
  [/arial|helvetica|arimo|liberation ?sans/i, 'Arimo'],
]

/**
 * Font incluso più simile. Prima il font compatibile scelto dal nome del font originale (stesse larghezze:
 * la riga riscritta occupa lo stesso spazio); poi Noto, scelto in base allo stile letto dal PDF o, in mancanza,
 * alla famiglia che indica pdf.js.
 */
function matchFont(run: TextRun, fromPdf: ReturnType<typeof dominantFont>) {
  const compatible = fromPdf && COMPATIBLE.find(([re]) => re.test(fromPdf.name))?.[1]
  const family: FontFamily =
    compatible ??
    (fromPdf
      ? fromPdf.mono ? 'NotoSansMono' : fromPdf.serif ? 'NotoSerif' : 'NotoSans'
      : run.family === 'serif' ? 'NotoSerif' : run.family === 'monospace' ? 'NotoSansMono' : 'NotoSans')
  const bold = !!fromPdf?.bold
  const italic = !!fromPdf?.italic && hasItalic(family)
  return { font: family, bold, italic }
}

export type EditResult =
  | { ok: true; erase: New<EraseElement>; text: New<TextElement> }
  | { ok: false; reason: string }

export async function startTextEdit(
  doc: Documento,
  pdfjs: PDFDocumentProxy,
  pageIndex: number,
  point: { x: number; y: number },
  bitmap: HTMLCanvasElement | null,
): Promise<EditResult> {
  const { runs } = await getTextRuns(pdfjs, pageIndex)
  const run = runs.find((r) => point.x >= r.x - 1 && point.x <= r.x + r.w + 1 && point.y >= r.y - 1 && point.y <= r.y + r.h + 1)
  if (!run) return { ok: false, reason: 'Clicca su una riga di testo del PDF.' }

  const box = { x: run.x - 0.5, y: run.y - 0.5, w: run.w + 1, h: run.h + 1 }
  const { pdf, text: pt } = await pageText(doc, pageIndex)
  const g = glyphsIn(pt, [box], doc.pagine[pageIndex].toPdf)
  if (g.removable === 0 || g.blocked > 0) {
    return {
      ok: false,
      reason:
        'Questa riga non si può modificare: il testo è dentro un gruppo grafico o usa un font che Postilla non sa misurare. Puoi coprirla con una forma e scrivere sopra.',
    }
  }

  const colors = bitmap ? sampleColors(bitmap, doc.pagine[pageIndex].larghezza, box) : { background: '#ffffff', text: '#14171c' }
  const style = matchFont(run, dominantFont(pdf, pageIndex, pt, [box], doc.pagine[pageIndex].toPdf))
  await loadFontFace(style.font, style.bold, style.italic)
  const size = Math.round(run.size * 10) / 10
  const firstBaseline = size * TEXT_METRICS.sizeMult * (1 - TEXT_METRICS.baselineFraction)
  const text = run.str.replace(/\s+$/, '')

  return {
    ok: true,
    erase: { type: 'erase', page: pageIndex, ...box, rotation: 0, opacity: 1, color: colors.background, text },
    text: {
      type: 'text',
      page: pageIndex,
      x: run.x,
      y: run.baseline - firstBaseline,
      rotation: 0,
      opacity: 1,
      text,
      lines: [text],
      // un po' di margine: il font sostitutivo può essere più largo dell'originale
      width: Math.max(40, run.w * 1.15 + size),
      size,
      color: colors.text,
      underline: false,
      align: 'left',
      ...style,
    },
  }
}
