// Modello dati dell'editor (versione eseguibile di docs/schema.ts).
// Tutto vive in memoria nel browser e sparisce chiudendo la scheda.
//
// Unità: punti PDF (1/72 di pollice).
// Coordinate: origine nell'angolo in alto a sinistra della pagina COSÌ COME SI VEDE
// (rotazione e ritaglio della pagina già applicati), y verso il basso.
// La conversione verso le coordinate interne del PDF avviene solo in pdf/export.ts,
// con la matrice Pagina.toPdf.

export type Id = string
export type Matrix = [number, number, number, number, number, number]

export interface Pagina {
  indice: number
  larghezza: number
  altezza: number
  /** Da coordinate "come si vede" (y in basso) a coordinate utente del PDF. */
  toPdf: Matrix
}

export interface Documento {
  nomeFile: string
  dimensioneByte: number
  bytes: Uint8Array // file originale, mai modificato
  password: string | null // null = non cifrato; '' = cifrato con soli permessi
  pagine: Pagina[]
  haTesto: boolean
}

export type FontFamily = 'NotoSans' | 'NotoSerif' | 'NotoSansMono'

interface Base {
  id: Id
  page: number
  /** Angolo in alto a sinistra del riquadro (bordo compreso), prima della rotazione. */
  x: number
  y: number
  /** Gradi in senso orario, attorno a (x, y). */
  rotation: number
  /** 0..1 */
  opacity: number
  /** Ordine dei livelli nella pagina: più alto = sopra. */
  z: number
}

export interface TextElement extends Base {
  type: 'text'
  text: string
  /** Righe così come le ha disposte l'editor (a capo automatici compresi): l'export le riproduce identiche. */
  lines: string[]
  width: number
  font: FontFamily
  size: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
}

export interface ImageElement extends Base {
  type: 'image'
  src: string // data URL png o jpeg
  format: 'png' | 'jpg'
  /** Dimensioni naturali in punti e scala applicata. */
  w0: number
  h0: number
  scaleX: number
  scaleY: number
}

export interface ShapeElement extends Base {
  type: 'shape'
  shape: 'rect' | 'ellipse' | 'line'
  /** Dimensioni geometriche, bordo escluso. Per la linea: lunghezza (l'altezza è lo spessore). */
  w: number
  h: number
  fill: string | null
  stroke: string | null
  strokeWidth: number
}

export interface DrawingElement extends Base {
  type: 'drawing'
  /** Tracciato SVG relativo al proprio riquadro geometrico, a scala 1. */
  path: string
  w0: number
  h0: number
  scaleX: number
  scaleY: number
  color: string
  strokeWidth: number
  /** Evidenziatore a mano libera: colore in moltiplicazione, il testo sotto resta leggibile. */
  highlighter: boolean
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Evidenziazione, sottolineatura o barratura di testo già presente nel PDF.
 * Nel PDF diventa una vera annotazione (modificabile in Acrobat e simili).
 * x, y = angolo del riquadro che contiene tutte le aree; le aree sono relative a x, y.
 */
export interface AnnotationElement extends Base {
  type: 'annotation'
  style: 'highlight' | 'underline' | 'strike'
  color: string
  /** Un'area per ogni pezzo di riga coperto. */
  rects: Box[]
  /** Testo coperto, per il pannello Elementi. */
  text: string
}

export type Element = TextElement | ImageElement | ShapeElement | DrawingElement | AnnotationElement
export type ElementType = Element['type']

export type ErroreApertura = 'non_pdf' | 'troppo_grande' | 'serve_password' | 'password_errata' | 'danneggiato'

export const MAX_BYTES = 100 * 1024 * 1024
