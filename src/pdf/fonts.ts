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

/** Carica nel browser la variante richiesta (serve prima di misurare il testo). */
export function loadFontFace(f: FontFamily, bold = false, italic = false): Promise<void> {
  const v = variantOf(f, bold, italic)
  const key = `${f}-${v}`
  let p = loaded.get(key)
  if (!p) {
    const face = new FontFace(cssFamily(f), `url("${fileOf(f, v)}")`, {
      weight: v.startsWith('Bold') ? '700' : '400',
      style: v.endsWith('Italic') ? 'italic' : 'normal',
    })
    p = face.load().then((ff) => {
      document.fonts.add(ff)
    })
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
    bytesCache.set(key, p)
  }
  return p
}
