// Quali caratteri di un testo NON esistono nel font scelto: nel PDF non comparirebbero.
// (Tipicamente emoji e alcuni simboli: i font Noto inclusi coprono le lingue europee.)
import fontkit, { type Font } from '@cantoo/fontkit'
import type { FontFamily } from '../model'
import { fontBytes, variantOf } from './fonts'

const parsed = new Map<string, Promise<Font>>()

function font(f: FontFamily, bold: boolean, italic: boolean) {
  const key = `${f}-${variantOf(f, bold, italic)}`
  let p = parsed.get(key)
  if (!p) {
    p = fontBytes(f, bold, italic).then((b) => fontkit.create(new Uint8Array(b)) as Font)
    parsed.set(key, p)
  }
  return p
}

const segmenter = new Intl.Segmenter('it', { granularity: 'grapheme' })

export async function missingChars(text: string, f: FontFamily, bold: boolean, italic: boolean): Promise<string[]> {
  const fnt = await font(f, bold, italic)
  const out = new Set<string>()
  for (const { segment } of segmenter.segment(text)) {
    if (/^\s+$/.test(segment)) continue
    // Basta il primo carattere del grafema: varianti e unioni (FE0F, ZWJ) seguono il carattere base.
    if (!fnt.hasGlyphForCodePoint(segment.codePointAt(0)!)) out.add(segment)
  }
  return [...out]
}
