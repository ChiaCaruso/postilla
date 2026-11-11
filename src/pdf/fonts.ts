// Font del contenuto del PDF: gli stessi file servono all'editor (per misurare e mostrare il testo)
// e all'export (vengono incorporati nel PDF), così le righe vanno a capo negli stessi punti.
import type { FontFamily } from '../model'

export interface FontInfo {
  value: FontFamily
  label: string
  /** font di base: precaricati all'avvio. Gli altri si scaricano quando servono. */
  base: boolean
  italic: boolean
}

/**
 * Noto: copertura ampia di lingue e simboli. Gli altri: stesse larghezze dei font d'ufficio più comuni
 * (Google Fonts, licenza OFL), così una riga riscritta con «Modifica testo» occupa lo stesso spazio.
 */
export const FONTS: FontInfo[] = [
  { value: 'NotoSans', label: 'Noto Sans', base: true, italic: true },
  { value: 'NotoSerif', label: 'Noto Serif', base: true, italic: true },
  { value: 'NotoSansMono', label: 'Noto Sans Mono', base: true, italic: false },
  { value: 'Arimo', label: 'Arimo (come Arial, Helvetica)', base: false, italic: true },
  { value: 'Tinos', label: 'Tinos (come Times New Roman)', base: false, italic: true },
  { value: 'Cousine', label: 'Cousine (come Courier New)', base: false, italic: true },
  { value: 'Carlito', label: 'Carlito (come Calibri)', base: false, italic: true },
  { value: 'Caladea', label: 'Caladea (come Cambria)', base: false, italic: true },
  { value: 'Gelasio', label: 'Gelasio (come Georgia)', base: false, italic: true },
]

/** Per i menu: valore ed etichetta. */
export const FONT_FAMILIES = FONTS.map(({ value, label }) => ({ value, label }))

export const hasItalic = (f: FontFamily) => FONTS.find((x) => x.value === f)?.italic ?? false

/** Nome CSS usato dall'editor. */
export const cssFamily = (f: FontFamily) => `pdf-${f}`

type Variant = 'Regular' | 'Bold' | 'Italic' | 'BoldItalic'

export function variantOf(f: FontFamily, bold: boolean, italic: boolean): Variant {
  if (!hasItalic(f)) return bold ? 'Bold' : 'Regular' // senza corsivo (es. Noto Sans Mono)
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

/**
 * Scarica in memoria tutte le varianti dei font di base, quando il browser è libero: dopo, editor ed export
 * non hanno più bisogno della rete. Gli altri font si scaricano la prima volta che servono.
 */
export function prefetchAllFonts() {
  const run = () => {
    for (const { value } of FONTS.filter((f) => f.base)) {
      for (const bold of [false, true]) for (const italic of [false, true]) void fontBytes(value, bold, italic).catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1000)
}
