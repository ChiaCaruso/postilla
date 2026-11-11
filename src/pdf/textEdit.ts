// Testo già presente nel PDF: misure dei font della pagina, analisi e rimozione vera dei caratteri.
// Usato dall'export (togliere il testo sostituito) e dall'editor (capire se una riga si può modificare).
import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFDocument,
} from '@cantoo/pdf-lib'
import { Encodings, Font, type IFontNames } from '@cantoo/pdf-lib/standard-fonts'
import type { Box, Matrix } from '../model'
import { apply, invert } from './geometry'
import { interpretText, parseContent, removeGlyphs, type FontMetrics, type Op, type TextShow } from './contentStream'

const N = (s: string) => PDFName.of(s)

function streamBytes(s: PDFStream): Uint8Array {
  if (s instanceof PDFRawStream) return decodePDFRawStream(s).decode()
  const any = s as unknown as { getUnencodedContents?: () => Uint8Array; getContents: () => Uint8Array }
  return any.getUnencodedContents ? any.getUnencodedContents() : any.getContents()
}

/** Tutti i flussi di contenuto della pagina, uniti come prevede lo standard. */
export function pageContentBytes(pdf: PDFDocument, pageIndex: number): Uint8Array {
  const node = pdf.getPage(pageIndex).node
  const c = node.Contents()
  const parts: Uint8Array[] = []
  if (c instanceof PDFArray) {
    for (let i = 0; i < c.size(); i++) {
      const s = c.lookup(i)
      if (s instanceof PDFStream) parts.push(streamBytes(s))
    }
  } else if (c instanceof PDFStream) parts.push(streamBytes(c))
  const total = parts.reduce((n, p) => n + p.length + 1, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    out[o + p.length] = 10
    o += p.length + 1
  }
  return out
}

// ─── Misure dei font ─────────────────────────────────────────────────────────

const STANDARD = new Set([
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Symbol', 'ZapfDingbats',
])

let winAnsiNames: Map<number, string> | null = null
function winAnsi(): Map<number, string> {
  if (!winAnsiNames) {
    winAnsiNames = new Map()
    for (const cp of Encodings.WinAnsi.supportedCodePoints) {
      const { code, name } = Encodings.WinAnsi.encodeUnicodeCodePoint(cp)
      if (!winAnsiNames.has(code)) winAnsiNames.set(code, name)
    }
  }
  return winAnsiNames
}

const numAt = (a: PDFArray, i: number) => {
  const v = a.lookup(i)
  return v instanceof PDFNumber ? v.asNumber() : undefined
}

function simpleFont(font: PDFDict): FontMetrics {
  const widths = font.lookup(N('Widths'))
  const first = font.lookup(N('FirstChar'))
  const desc = font.lookup(N('FontDescriptor'))
  const missingRaw = desc instanceof PDFDict ? desc.lookup(N('MissingWidth')) : undefined
  const missing = missingRaw instanceof PDFNumber ? missingRaw.asNumber() : 0
  if (widths instanceof PDFArray && first instanceof PDFNumber) {
    const f = first.asNumber()
    const ws = Array.from({ length: widths.size() }, (_, i) => numAt(widths, i) ?? missing)
    return { bytesPerCode: 1, supported: true, width: (code) => ws[code - f] ?? missing }
  }
  // Uno dei 14 font standard senza tabella delle larghezze: si usano le misure ufficiali.
  const base = String(font.lookup(N('BaseFont')) ?? '').replace(/^\//, '').replace(/^[A-Z]{6}\+/, '')
  if (STANDARD.has(base)) {
    const metrics = Font.load(base as IFontNames)
    const names = new Map(winAnsi())
    const enc = font.lookup(N('Encoding'))
    if (enc instanceof PDFDict) {
      const diffs = enc.lookup(N('Differences'))
      if (diffs instanceof PDFArray) {
        let code = 0
        for (let i = 0; i < diffs.size(); i++) {
          const v = diffs.lookup(i)
          if (v instanceof PDFNumber) code = v.asNumber()
          else if (v instanceof PDFName) names.set(code++, v.decodeText())
        }
      }
    }
    return {
      bytesPerCode: 1,
      supported: true,
      width: (code) => {
        const g = names.get(code)
        return (g && metrics.getWidthOfGlyph(g)) || 0
      },
    }
  }
  return { bytesPerCode: 1, supported: false, width: () => 500 }
}

function type0Font(font: PDFDict): FontMetrics {
  const enc = font.lookup(N('Encoding'))
  const identity = enc instanceof PDFName && /^Identity-[HV]$/.test(enc.decodeText())
  const descs = font.lookup(N('DescendantFonts'))
  const desc = descs instanceof PDFArray ? descs.lookup(0) : undefined
  const widths = new Map<number, number>()
  let dw = 1000
  if (desc instanceof PDFDict) {
    const d = desc.lookup(N('DW'))
    if (d instanceof PDFNumber) dw = d.asNumber()
    const w = desc.lookup(N('W'))
    if (w instanceof PDFArray) {
      let i = 0
      while (i < w.size()) {
        const a = numAt(w, i)
        const b = w.lookup(i + 1)
        if (a === undefined) break
        if (b instanceof PDFArray) {
          for (let k = 0; k < b.size(); k++) widths.set(a + k, numAt(b, k) ?? dw)
          i += 2
        } else {
          const last = numAt(w, i + 1)
          const val = numAt(w, i + 2)
          if (last === undefined || val === undefined) break
          for (let c = a; c <= last; c++) widths.set(c, val)
          i += 3
        }
      }
    }
  }
  return { bytesPerCode: 2, supported: identity, width: (code) => widths.get(code) ?? dw }
}

export function fontMetrics(font: PDFDict): FontMetrics {
  const subtype = String(font.lookup(N('Subtype')) ?? '')
  if (subtype === '/Type0') return type0Font(font)
  if (subtype === '/Type3') return { bytesPerCode: 1, supported: false, width: () => 500 }
  return simpleFont(font)
}

// ─── Analisi e rimozione ─────────────────────────────────────────────────────

export interface PageText {
  content: Uint8Array
  ops: Op[]
  shows: TextShow[]
}

export function analyzePage(pdf: PDFDocument, pageIndex: number): PageText {
  const node = pdf.getPage(pageIndex).node
  const fonts = node.Resources()?.lookup(N('Font'))
  const cache = new Map<string, FontMetrics | null>()
  const getFont = (name: string) => {
    if (!cache.has(name)) {
      const f = fonts instanceof PDFDict ? fonts.lookup(N(name)) : undefined
      cache.set(name, f instanceof PDFDict ? fontMetrics(f) : null)
    }
    return cache.get(name)!
  }
  const content = pageContentBytes(pdf, pageIndex)
  const ops = parseContent(content)
  return { content, ops, shows: interpretText(ops, getFont) }
}

const inBoxes = (boxes: Box[], x: number, y: number) => boxes.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)

/** Quanti caratteri della pagina cadono nei riquadri (coordinate "come si vede"), e quanti si possono togliere. */
export function glyphsIn(text: PageText, boxes: Box[], toPdf: Matrix) {
  const fromPdf = invert(toPdf)
  let removable = 0
  let blocked = 0
  for (const s of text.shows) {
    for (const it of s.items) {
      if (it.kind !== 'glyph') continue
      const [x, y] = apply(fromPdf, ...it.center)
      if (inBoxes(boxes, x, y)) {
        if (s.supported) removable++
        else blocked++
      }
    }
  }
  return { removable, blocked }
}

export interface FontStyle {
  /** nome del font senza il prefisso del sottoinsieme, es. "Georgia-Bold" */
  name: string
  serif: boolean
  mono: boolean
  bold: boolean
  italic: boolean
}

/** Il font usato dalla maggior parte dei caratteri nei riquadri, con il suo stile letto dal PDF. */
export function dominantFont(pdf: PDFDocument, pageIndex: number, text: PageText, boxes: Box[], toPdf: Matrix): FontStyle | null {
  const fromPdf = invert(toPdf)
  const count = new Map<string, number>()
  for (const s of text.shows) {
    for (const it of s.items) {
      if (it.kind !== 'glyph') continue
      const [x, y] = apply(fromPdf, ...it.center)
      if (inBoxes(boxes, x, y)) count.set(s.font, (count.get(s.font) ?? 0) + 1)
    }
  }
  const top = [...count].sort((a, b) => b[1] - a[1])[0]
  if (!top) return null
  const fonts = pdf.getPage(pageIndex).node.Resources()?.lookup(N('Font'))
  const font = fonts instanceof PDFDict ? fonts.lookup(N(top[0])) : undefined
  if (!(font instanceof PDFDict)) return null
  const name = String(font.lookup(N('BaseFont')) ?? '').replace(/^\//, '').replace(/^[A-Z]{6}\+/, '')
  let desc = font.lookup(N('FontDescriptor'))
  const descs = font.lookup(N('DescendantFonts'))
  if (!(desc instanceof PDFDict) && descs instanceof PDFArray) {
    const d0 = descs.lookup(0)
    if (d0 instanceof PDFDict) desc = d0.lookup(N('FontDescriptor'))
  }
  const numOf = (k: string) => {
    const v = desc instanceof PDFDict ? desc.lookup(N(k)) : undefined
    return v instanceof PDFNumber ? v.asNumber() : 0
  }
  const flags = numOf('Flags')
  const weight = numOf('FontWeight')
  return {
    name,
    mono: (flags & 1) !== 0 || /courier|mono|consol/i.test(name),
    serif: (flags & 2) !== 0 || /times|georgia|garamond|serif|cambria|roman/i.test(name.replace(/sans/i, '')),
    bold: weight >= 600 || (flags & (1 << 18)) !== 0 || /bold|black|heavy|semibold|demi/i.test(name),
    italic: numOf('ItalicAngle') !== 0 || (flags & (1 << 6)) !== 0 || /italic|oblique/i.test(name),
  }
}

/** Toglie davvero dal PDF i caratteri nei riquadri; il testo intorno resta dov'è. */
export function eraseText(pdf: PDFDocument, pageIndex: number, boxes: Box[], toPdf: Matrix) {
  const text = analyzePage(pdf, pageIndex)
  const fromPdf = invert(toPdf)
  const result = removeGlyphs(text.content, text.ops, text.shows, (g) => {
    const [x, y] = apply(fromPdf, ...g.center)
    return inBoxes(boxes, x, y)
  })
  if (result.removedGlyphs > 0) {
    const stream = pdf.context.flateStream(result.bytes)
    pdf.getPage(pageIndex).node.set(N('Contents'), pdf.context.register(stream))
  }
  return { removed: result.removedGlyphs, skipped: result.skippedGlyphs }
}
