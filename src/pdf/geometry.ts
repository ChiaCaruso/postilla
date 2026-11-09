import type { Matrix } from '../model'

/** Prodotto di matrici affini nel formato PDF [a b c d e f]: prima si applica `n`, poi `m`. */
export function mul(m: Matrix, n: Matrix): Matrix {
  const [a, b, c, d, e, f] = m
  const [A, B, C, D, E, F] = n
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f]
}

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y]
export const scale = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0]

/** Rotazione oraria di `deg` gradi in uno spazio con y verso il basso. */
export function rotate(deg: number): Matrix {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return [cos, sin, -sin, cos, 0, 0]
}

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/**
 * Matrice per disegnare un elemento: dallo spazio locale dell'elemento
 * (origine nell'angolo in alto a sinistra, y VERSO L'ALTO come nei PDF)
 * alle coordinate utente del PDF.
 */
export function elementToPdf(toPdf: Matrix, x: number, y: number, rotation: number): Matrix {
  return mul(mul(mul(toPdf, translate(x, y)), rotate(rotation)), scale(1, -1))
}
