// Font del contenuto del PDF: gli stessi file servono all'editor (per misurare e mostrare il testo)
// e all'export (vengono incorporati nel PDF), così le righe vanno a capo negli stessi punti.
import type { FontFamily } from '../model'

export const FONT_FAMILIES: Array<{ value: FontFamily; label: string }> = [
  { value: 'NotoSans', label: 'Noto Sans' },
  { value: 'NotoSerif', label: 'Noto Serif' },
  { value: 'NotoSansMono', label: 'Noto Sans Mono' },
]

/** Nome CSS usato dall'editor. */
export const cssFamily = (f: FontFamily) => `pdf-${f}`

type Variant = 'Regular' | 'Bold' | 'Italic' | 'BoldItalic'

export function variantOf(f: FontFamily, bold: boolean, italic: boolean): Variant {
  if (f === 'NotoSansMono') return bold ? 'Bold' : 'Regular' // il mono non ha corsivo
  if (bold && italic) return 'BoldItalic'
  return bold ? 'Bold' : italic ? 'Italic' : 'Regular'
}

const fileOf = (f: FontFamily, v: Variant) => `${import.meta.env.BASE_URL}fonts/${f}-${v}.ttf`

const loaded = new Map<string, Promise<void>>()
const ready = new Set<string>()

export const isFontLoaded = (f: FontFamily, bold = false, italic = false) => ready.has(`${f}-${variantOf(f, bold, italic)}`)

/** Carica nel browser la variante richiesta (serve prima di misurare il testo). */
export function loadFontFace(f: FontFamily, bold = false, italic = false): Promise<void> {
  const v = variantOf(f, bold, italic)
  const key = `${f}-${v}`
  let p = loaded.get(key)
  if (!p) {
    // Dai byte già in memoria (gli stessi dell'export): niente seconda richiesta, funziona anche offline.
    p = fontBytes(f, bold, italic)
      .then((bytes) =>
        new FontFace(cssFamily(f), bytes, {
          weight: v.startsWith('Bold') ? '700' : '400',
          style: v.endsWith('Italic') ? 'italic' : 'normal',
        }).load(),
      )
      .then((ff) => {
        document.fonts.add(ff)
        ready.add(key)
      })
    p.catch(() => loaded.delete(key))
    loaded.set(key, p)
  }
  return p
}

const bytesCache = new Map<string, Promise<ArrayBuffer>>()

export function fontBytes(f: FontFamily, bold: boolean, italic: boolean): Promise<ArrayBuffer> {
  const v = variantOf(f, bold, italic)
  const key = `${f}-${v}`
  let p = bytesCache.get(key)
  if (!p) {
    p = fetch(fileOf(f, v)).then((r) => {
      if (!r.ok) throw new Error(`Font ${key} non trovato`)
      return r.arrayBuffer()
    })
    // Se il download fallisce (es. rete assente) si riproverà la volta dopo.
    p.catch(() => bytesCache.delete(key))
    bytesCache.set(key, p)
  }
  return p
}

/** Scarica in memoria tutte le varianti, quando il browser è libero: dopo, editor ed export non hanno più bisogno della rete. */
export function prefetchAllFonts() {
  const run = () => {
    for (const { value } of FONT_FAMILIES) {
      for (const bold of [false, true]) for (const italic of [false, true]) void fontBytes(value, bold, italic).catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1000)
}
