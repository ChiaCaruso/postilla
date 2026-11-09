// Elementi nuovi, con i valori di stile correnti.
import type { ImageElement, ShapeElement, TextElement } from '../model'
import type { Style } from '../store'

type New<T> = Omit<T, 'id' | 'z'>

export const NEW_TEXT = 'Scrivi qui'

export function newText(page: number, x: number, y: number, s: Style): New<TextElement> {
  return {
    type: 'text', page, x, y, rotation: 0, opacity: s.opacity,
    text: NEW_TEXT, lines: [NEW_TEXT], width: 220,
    font: s.font, size: s.size, color: s.color, bold: s.bold, italic: s.italic, align: s.align,
  }
}

export function newShape(page: number, x: number, y: number, s: Style): New<ShapeElement> {
  const line = s.shape === 'line'
  return {
    type: 'shape', page, x, y, rotation: 0, opacity: s.opacity,
    shape: s.shape,
    w: line ? 160 : 140,
    h: line ? 0 : s.shape === 'ellipse' ? 90 : 80,
    fill: line ? null : s.fill,
    stroke: s.stroke ?? (line ? '#14171c' : null),
    strokeWidth: s.strokeWidth,
  }
}

/** Immagine centrata nella pagina, ridotta per stare in metà pagina. Dimensioni naturali in px → punti a 96 dpi. */
export function newImage(page: number, pageW: number, pageH: number, src: string, format: 'png' | 'jpg', pxW: number, pxH: number): New<ImageElement> {
  const ptW = pxW * 0.75
  const ptH = pxH * 0.75
  const fit = Math.min(1, (pageW * 0.5) / ptW, (pageH * 0.5) / ptH)
  const sx = (ptW * fit) / pxW
  const sy = (ptH * fit) / pxH
  return {
    type: 'image', page, rotation: 0, opacity: 1,
    x: (pageW - ptW * fit) / 2,
    y: (pageH - ptH * fit) / 2,
    src, format, w0: pxW, h0: pxH, scaleX: sx, scaleY: sy,
  }
}

