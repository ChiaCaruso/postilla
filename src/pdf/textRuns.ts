// Il testo già presente in una pagina, in coordinate "come si vede", per evidenziare, sottolineare e barrare.
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Box } from '../model'

export interface TextRun {
  str: string
  /** riquadro della riga di testo */
  x: number
  y: number
  w: number
  h: number
  /** bordo sinistro di ogni carattere e, in fondo, il bordo destro dell'ultimo (lunghezza = str.length + 1) */
  edges: number[]
  /** linea di base e corpo del testo, nome del font in pdf.js e famiglia (sans-serif, serif, monospace) */
  baseline: number
  size: number
  fontName: string
  family: string
}

let measureCtx: CanvasRenderingContext2D | null = null

/**
 * Posizione di ogni carattere. pdf.js dà solo la larghezza totale del frammento: la si ripartisce
 * in proporzione alla larghezza di ciascun carattere in un font della stessa famiglia
 * (sans-serif, serif, monospace). Molto più preciso di una larghezza media.
 */
function charEdges(str: string, x: number, width: number, family: string): number[] {
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  measureCtx.font = `100px ${family}`
  const ws = [...str].map((ch) => measureCtx!.measureText(ch).width || 1)
  const k = width / ws.reduce((a, b) => a + b, 0)
  const edges = [x]
  for (const w of ws) edges.push(edges[edges.length - 1] + w * k)
  return edges
}

export interface PageText {
  /** testo orizzontale "come si vede": si può annotare */
  runs: TextRun[]
  /** riquadri del testo ruotato o verticale: per ora non si annota, ma si sa dov'è */
  rotated: Box[]
}

const cache = new WeakMap<PDFDocumentProxy, Map<number, Promise<PageText>>>()

export function getTextRuns(pdfjs: PDFDocumentProxy, pageIndex: number): Promise<PageText> {
  let byPage = cache.get(pdfjs)
  if (!byPage) cache.set(pdfjs, (byPage = new Map()))
  let p = byPage.get(pageIndex)
  if (!p) {
    p = load(pdfjs, pageIndex)
    byPage.set(pageIndex, p)
  }
  return p
}

async function load(pdfjs: PDFDocumentProxy, pageIndex: number): Promise<PageText> {
  const page = await pdfjs.getPage(pageIndex + 1)
  const vp = page.getViewport({ scale: 1 })
  const { items, styles } = await page.getTextContent()
  const runs: TextRun[] = []
  const rotated: Box[] = []
  for (const it of items) {
    if (!('str' in it) || !it.str.trim() || !it.width) continue
    const [a, b, , , e, f] = it.transform as number[]
    const [x0, y0] = vp.convertToViewportPoint(e, f)
    const [x1, y1] = vp.convertToViewportPoint(e + a, f + b)
    const size = it.height || Math.hypot(a, b)
    // Solo testo orizzontale come si vede (v1): del testo ruotato o verticale si tiene solo il riquadro.
    if (Math.abs(y1 - y0) > 0.01 * Math.hypot(x1 - x0, y1 - y0) || x1 < x0) {
      const len = Math.hypot(x1 - x0, y1 - y0)
      const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len] // direzione del testo
      const [nx, ny] = [uy, -ux] // verso l'alto delle lettere
      const pts = [
        [x0, y0],
        [x0 + ux * it.width, y0 + uy * it.width],
        [x0 + nx * size, y0 + ny * size],
        [x0 + ux * it.width + nx * size, y0 + uy * it.width + ny * size],
      ]
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      rotated.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) })
      continue
    }
    runs.push({
      str: it.str,
      x: x0,
      y: y0 - size * 0.82, // dalla linea di base alla parte alta delle lettere
      w: it.width,
      h: size * 1.04,
      edges: charEdges(it.str, x0, it.width, styles[it.fontName]?.fontFamily ?? 'sans-serif'),
      baseline: y0,
      size,
      fontName: it.fontName,
      family: styles[it.fontName]?.fontFamily ?? 'sans-serif',
    })
  }
  return { runs, rotated }
}

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + Math.max(a.w, 1) && a.y < b.y + b.h && b.y < a.y + Math.max(a.h, 1)

export interface Selection {
  rects: Box[]
  text: string
}

/**
 * Le parti di testo coperte dal rettangolo trascinato, agganciate ai caratteri.
 * Un clic senza trascinamento seleziona la parola sotto il puntatore.
 */
export function selectRuns(runs: TextRun[], drag: Box): Selection {
  const click = drag.w < 3 && drag.h < 3
  const rects: Box[] = []
  const parts: string[] = []
  for (const r of runs) {
    const vOverlap = Math.min(r.y + r.h, drag.y + Math.max(drag.h, 1)) - Math.max(r.y, drag.y)
    if (vOverlap <= 0) continue
    let i0: number
    let i1: number
    // indice del carattere che contiene la coordinata x
    const charAt = (x: number) => {
      let i = 0
      while (i < r.str.length - 1 && r.edges[i + 1] <= x) i++
      return i
    }
    // bordo di carattere più vicino a x
    const nearestEdge = (x: number) => {
      let best = 0
      for (let i = 1; i < r.edges.length; i++) if (Math.abs(r.edges[i] - x) < Math.abs(r.edges[best] - x)) best = i
      return best
    }
    if (click) {
      if (drag.x < r.x || drag.x > r.x + r.w) continue
      const at = charAt(drag.x)
      if (/\s/.test(r.str[at])) continue
      i0 = at
      i1 = at + 1
      while (i0 > 0 && !/\s/.test(r.str[i0 - 1])) i0--
      while (i1 < r.str.length && !/\s/.test(r.str[i1])) i1++
    } else {
      const from = Math.max(drag.x, r.x)
      const to = Math.min(drag.x + drag.w, r.x + r.w)
      if (to <= from) continue
      i0 = nearestEdge(from)
      i1 = nearestEdge(to)
      // niente spazi ai bordi dell'area
      while (i0 < i1 && /\s/.test(r.str[i0])) i0++
      while (i1 > i0 && /\s/.test(r.str[i1 - 1])) i1--
      if (i1 <= i0) continue
    }
    rects.push({ x: r.edges[i0], y: r.y, w: r.edges[i1] - r.edges[i0], h: r.h })
    parts.push(r.str.slice(i0, i1))
    if (click) break
  }
  return { rects, text: parts.join(' ') }
}

/** Riquadro che contiene tutte le aree, e aree rese relative a quel riquadro. */
export function boundRects(rects: Box[]): { x: number; y: number; rel: Box[] } {
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  return { x, y, rel: rects.map((r) => ({ x: r.x - x, y: r.y - y, w: r.w, h: r.h })) }
}

export type Point = [number, number]

/**
 * Forme disegnate per stile, come poligoni (coordinate "come si vede"):
 * evidenziazione = tutta l'area; sottolineatura e barratura = una barra sottile; onda = una fascia a zigzag.
 */
export function annotationShapes(style: 'highlight' | 'underline' | 'strike' | 'squiggly', r: Box): Point[][] {
  const rect = (b: Box): Point[] => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]
  if (style === 'highlight') return [rect(r)]
  const t = Math.max(0.75, r.h / 14)
  if (style === 'underline') return [rect({ x: r.x, y: r.y + r.h * 0.9 - t, w: r.w, h: t })]
  if (style === 'strike') return [rect({ x: r.x, y: r.y + r.h * 0.55 - t / 2, w: r.w, h: t })]
  // onda: zigzag sotto la riga, ampiezza e passo proporzionati all'altezza del testo
  const amp = r.h * 0.07
  const step = r.h * 0.14
  const mid = r.y + r.h * 0.9 - amp - t / 2
  const top: Point[] = []
  for (let i = 0, x = r.x; ; i++, x += step) {
    const cx = Math.min(x, r.x + r.w)
    top.push([cx, mid + (i % 2 === 0 ? -amp : amp)])
    if (cx >= r.x + r.w) break
  }
  const bottom: Point[] = top.map(([x, y]) => [x, y + t] as Point).reverse()
  return [[...top, ...bottom]]
}
