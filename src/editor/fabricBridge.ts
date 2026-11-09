// Ponte tra il modello (store) e gli oggetti Fabric che l'utente sposta sulla pagina.
// Fabric lavora in punti PDF: lo zoom è solo lo zoom del canvas Fabric.
import { Ellipse, FabricImage, FabricObject, Path, Rect, Textbox } from 'fabric'
import type { DrawingElement, Element, ImageElement, ShapeElement, TextElement } from '../model'
import { cssFamily } from '../pdf/fonts'
import { TEXT_METRICS } from '../pdf/metrics'
import tokens from '../../docs/design/tokens.json'

// Aspetto di maniglie e riquadro di selezione, dai token.
Object.assign(FabricObject.ownDefaults, {
  originX: 'left',
  originY: 'top',
  borderColor: tokens.color.selection,
  cornerColor: tokens.color.bg,
  cornerStrokeColor: tokens.color.selection,
  cornerSize: tokens.layout.handle,
  transparentCorners: false,
  borderScaleFactor: 1.5,
  padding: 0,
  strokeUniform: true,
  lockScalingFlip: true,
  // Pochi oggetti per pagina: disegnarli direttamente li tiene nitidi a ogni zoom.
  objectCaching: false,
})

const ids = new WeakMap<FabricObject, string>()
export const idOf = (o: FabricObject | undefined | null) => (o ? ids.get(o) : undefined)

const common = (el: Element) => ({ left: el.x, top: el.y, angle: el.rotation, opacity: el.opacity, originX: 'left' as const, originY: 'top' as const })

function textProps(el: TextElement) {
  return {
    ...common(el),
    width: el.width,
    fontFamily: cssFamily(el.font),
    fontSize: el.size,
    fontWeight: el.bold ? '700' : '400',
    // Il mono non ha il corsivo: niente corsivo finto nell'editor, l'export non lo avrebbe.
    fontStyle: el.italic && el.font !== 'NotoSansMono' ? ('italic' as const) : ('normal' as const),
    fill: el.color,
    textAlign: el.align,
    lineHeight: TEXT_METRICS.lineHeight,
    scaleX: 1,
    scaleY: 1,
  }
}

function shapeProps(el: ShapeElement) {
  if (el.shape === 'line') {
    return { ...common(el), width: el.w, height: el.strokeWidth, fill: el.stroke ?? tokens.color.text, stroke: null, strokeWidth: 0, scaleX: 1, scaleY: 1 }
  }
  const base = {
    ...common(el),
    fill: el.fill ?? 'transparent',
    stroke: el.stroke,
    strokeWidth: el.stroke ? el.strokeWidth : 0,
    scaleX: 1,
    scaleY: 1,
  }
  return el.shape === 'rect' ? { ...base, width: el.w, height: el.h } : { ...base, rx: el.w / 2, ry: el.h / 2 }
}

const imageProps = (el: ImageElement) => ({ ...common(el), scaleX: el.scaleX, scaleY: el.scaleY })

const drawingProps = (el: DrawingElement) => ({
  ...common(el),
  scaleX: el.scaleX,
  scaleY: el.scaleY,
  stroke: el.color,
  strokeWidth: el.strokeWidth,
  fill: '',
  strokeLineCap: 'round' as const,
  strokeLineJoin: 'round' as const,
})

export async function createObject(el: Element): Promise<FabricObject> {
  let o: FabricObject
  switch (el.type) {
    case 'text':
      o = new Textbox(el.text, textProps(el))
      break
    case 'image':
      o = await FabricImage.fromURL(el.src, {}, imageProps(el))
      break
    case 'shape':
      o = el.shape === 'ellipse' ? new Ellipse(shapeProps(el)) : new Rect(shapeProps(el))
      if (el.shape === 'line') {
        o.set({ lockScalingY: true })
        o.setControlsVisibility({ tl: false, tr: false, bl: false, br: false, mt: false, mb: false })
      }
      break
    case 'drawing':
      o = new Path(el.path, drawingProps(el))
      // Il tracciato parte da (0, 0): riportiamo l'oggetto nella posizione salvata.
      o.set({ left: el.x, top: el.y })
      break
  }
  ids.set(o, el.id)
  o.setCoords()
  return o
}

/** Allinea l'oggetto Fabric all'elemento (dopo una modifica fatta fuori dall'editor: pannello, proprietà, tastiera). */
export function applyToObject(el: Element, o: FabricObject) {
  switch (el.type) {
    case 'text': {
      const t = o as Textbox
      const props = textProps(el)
      if (t.isEditing) {
        // Durante la scrittura non si tocca il testo: solo stile e posizione.
        t.set({ ...props })
      } else {
        t.set({ ...props, text: el.text })
      }
      t.initDimensions()
      break
    }
    case 'image':
      o.set(imageProps(el))
      break
    case 'shape':
      o.set(shapeProps(el))
      break
    case 'drawing':
      o.set(drawingProps(el))
      break
  }
  o.setCoords()
}

/** Legge dall'oggetto Fabric le modifiche fatte con il mouse (spostamento, ridimensionamento, rotazione, testo). */
export function readFromObject(o: FabricObject, el: Element): Partial<Element> {
  const base = { x: round(o.left), y: round(o.top), rotation: round(normalizeAngle(o.angle)) }
  switch (el.type) {
    case 'text': {
      const t = o as Textbox
      if (t.scaleX !== 1 || t.scaleY !== 1) {
        // Ridimensionato dagli angoli: diventa una dimensione del font, non una scala.
        const size = Math.max(4, Math.round(el.size * t.scaleY * 10) / 10)
        t.set({ fontSize: size, width: t.width * t.scaleX, scaleX: 1, scaleY: 1 })
        t.initDimensions()
        t.setCoords()
        return { ...base, size, width: round(t.width), text: t.text, lines: t.textLines.slice() }
      }
      return { ...base, width: round(t.width), text: t.text, lines: t.textLines.slice() }
    }
    case 'image':
      return { ...base, scaleX: o.scaleX, scaleY: o.scaleY }
    case 'drawing':
      return { ...base, scaleX: o.scaleX, scaleY: o.scaleY }
    case 'shape': {
      if (el.shape === 'ellipse') {
        const e = o as Ellipse
        const w = e.rx * 2 * e.scaleX
        const h = e.ry * 2 * e.scaleY
        e.set({ rx: w / 2, ry: h / 2, scaleX: 1, scaleY: 1 })
        e.setCoords()
        return { ...base, w: round(w), h: round(h) }
      }
      const w = o.width * o.scaleX
      const h = el.shape === 'line' ? 0 : o.height * o.scaleY
      o.set({ width: w, height: el.shape === 'line' ? el.strokeWidth : h, scaleX: 1, scaleY: 1 })
      o.setCoords()
      return { ...base, w: round(w), h: round(h) }
    }
  }
}

const round = (n: number) => Math.round(n * 100) / 100
const normalizeAngle = (a: number) => ((a % 360) + 360) % 360

/**
 * Converte un tracciato appena disegnato con la penna in un elemento:
 * tracciato relativo al proprio riquadro e posizione del riquadro (bordo compreso).
 */
export function drawingFromPath(p: Path, page: number, color: string, strokeWidth: number): Omit<DrawingElement, 'id' | 'z'> {
  const left = p.pathOffset.x - p.width / 2
  const top = p.pathOffset.y - p.height / 2
  const d = p.path
    .map((cmd) => {
      const [op, ...nums] = cmd as [string, ...number[]]
      const rel = nums.map((n, i) => round(i % 2 === 0 ? n - left : n - top))
      return `${op} ${rel.join(' ')}`
    })
    .join(' ')
  return {
    type: 'drawing',
    page,
    x: round(left - strokeWidth / 2),
    y: round(top - strokeWidth / 2),
    rotation: 0,
    opacity: 1,
    path: d,
    w0: p.width,
    h0: p.height,
    scaleX: 1,
    scaleY: 1,
    color,
    strokeWidth,
  }
}
