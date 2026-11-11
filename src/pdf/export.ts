// Crea il PDF finale: carica l'originale con pdf-lib e ci disegna sopra gli elementi.
// L'unico punto in cui le coordinate "come si vede" diventano coordinate PDF.
import {
  PDFDocument,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFInvalidObject,
  EncryptedPDFError,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  rgb,
  LineCapStyle,
  BlendMode,
  moveTo,
  lineTo,
  closePath,
  fill,
  setFillingRgbColor,
  setGraphicsState,
  setStrokingRgbColor,
  setLineWidth,
  setLineJoin,
  LineJoinStyle,
  fillAndStroke,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from '@cantoo/pdf-lib'
import fontkit from '@cantoo/fontkit'
import { COMMENT_ICON, type AnnotationElement, type CommentElement, type Documento, type DrawingElement, type Element, type ImageElement, type Matrix, type ShapeElement, type TextElement } from '../model'
import { apply, elementToPdf } from './geometry'
import { annotationShapes } from './textRuns'
import { eraseText } from './textEdit'
import { fontBytes, variantOf } from './fonts'
import { TEXT_METRICS, scalePath } from './metrics'

export interface ExportResult {
  bytes: Uint8Array
  /** Il PDF di partenza era cifrato: quello nuovo non lo è più. */
  wasEncrypted: boolean
}

function color(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function bytesOf(obj: PDFInvalidObject) {
  const buf = new Uint8Array(obj.sizeInBytes())
  obj.copyBytesInto(buf, 0)
  return buf
}

/** Dopo la decifratura restano il vecchio dizionario di cifratura e il vecchio indice: vanno tolti. */
function stripEncryptionLeftovers(pdf: PDFDocument) {
  const latin1 = new TextDecoder('latin1')
  for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
    const isEncryptDict =
      obj instanceof PDFDict && ['O', 'U', 'P', 'Filter'].every((k) => obj.has(PDFName.of(k)))
    const isOldXref = obj instanceof PDFInvalidObject && /\/Type\s*\/XRef|\/Encrypt\s/.test(latin1.decode(bytesOf(obj)))
    if (isEncryptDict || isOldXref) pdf.context.delete(ref)
  }
}

export async function loadPdf(doc: Documento): Promise<{ pdf: PDFDocument; wasEncrypted: boolean }> {
  try {
    return { pdf: await PDFDocument.load(doc.bytes, { updateMetadata: false }), wasEncrypted: false }
  } catch (e) {
    if (!(e instanceof EncryptedPDFError)) throw e
    // Cifrato: con la password inserita, oppure vuota se il PDF ha solo restrizioni sui permessi.
    const pdf = await PDFDocument.load(doc.bytes, { updateMetadata: false, password: doc.password ?? '' })
    stripEncryptionLeftovers(pdf)
    return { pdf, wasEncrypted: true }
  }
}

/** Isola il contenuto originale della pagina (q … Q), così le sue trasformazioni non spostano i nostri elementi. */
function isolateOriginalContent(pdf: PDFDocument, page: PDFPage) {
  const start = pdf.context.register(pdf.context.contentStream([pushGraphicsState()]))
  const end = pdf.context.register(pdf.context.contentStream([popGraphicsState()]))
  page.node.wrapContentStreams(start, end)
}

export async function exportPdf(doc: Documento, elements: Element[]): Promise<ExportResult> {
  const { pdf, wasEncrypted } = await loadPdf(doc)
  if (elements.length === 0 && !wasEncrypted) return { bytes: doc.bytes, wasEncrypted }
  pdf.registerFontkit(fontkit)

  const fonts = new Map<string, Promise<PDFFont>>()
  const getFont = (el: TextElement) => {
    const key = `${el.font}-${variantOf(el.font, el.bold, el.italic)}`
    let f = fonts.get(key)
    if (!f) {
      f = fontBytes(el.font, el.bold, el.italic).then((b) => pdf.embedFont(b, { subset: true }))
      fonts.set(key, f)
    }
    return f
  }
  const images = new Map<string, Promise<PDFImage>>()
  const getImage = (el: ImageElement) => {
    let i = images.get(el.src)
    if (!i) {
      const bytes = Uint8Array.from(atob(el.src.split(',')[1]), (c) => c.charCodeAt(0))
      i = el.format === 'png' ? pdf.embedPng(bytes) : pdf.embedJpg(bytes)
      images.set(el.src, i)
    }
    return i
  }

  // Testo originale sostituito: i caratteri vengono tolti dal contenuto della pagina, prima di tutto il resto.
  const erasures = new Map<number, Array<{ x: number; y: number; w: number; h: number }>>()
  for (const el of elements) if (el.type === 'erase') erasures.set(el.page, [...(erasures.get(el.page) ?? []), { x: el.x, y: el.y, w: el.w, h: el.h }])
  for (const [page, boxes] of erasures) eraseText(pdf, page, boxes, doc.pagine[page].toPdf)

  const isolated = new Set<number>()
  const sorted = [...elements].sort((a, b) => a.page - b.page || a.z - b.z)
  // Le annotazioni non sono contenuto della pagina: diventano oggetti annotazione del PDF.
  for (const el of sorted) {
    if (el.type === 'annotation') addAnnotation(pdf, pdf.getPage(el.page), el, doc.pagine[el.page].toPdf)
    // un commento senza testo non serve a nessuno: non finisce nel PDF
    if (el.type === 'comment' && el.text.trim()) addComment(pdf, pdf.getPage(el.page), el, doc.pagine[el.page].toPdf)
  }
  for (const el of sorted) {
    if (el.type === 'annotation' || el.type === 'comment' || el.type === 'erase') continue
    const page = pdf.getPage(el.page)
    if (!isolated.has(el.page)) {
      isolateOriginalContent(pdf, page)
      isolated.add(el.page)
    }
    const m = elementToPdf(doc.pagine[el.page].toPdf, el.x, el.y, el.rotation)
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m))
    switch (el.type) {
      case 'text':
        drawText(page, el, await getFont(el))
        break
      case 'image':
        drawImage(page, el, await getImage(el))
        break
      case 'shape':
        drawShape(page, el)
        break
      case 'drawing':
        drawDrawing(page, el)
        break
    }
    page.pushOperators(popGraphicsState())
  }

  return { bytes: await pdf.save(), wasEncrypted }
}

// Spazio locale degli elementi: origine nell'angolo in alto a sinistra del riquadro, y verso l'alto.

function drawText(page: PDFPage, el: TextElement, font: PDFFont) {
  const lineStep = el.size * TEXT_METRICS.sizeMult * TEXT_METRICS.lineHeight
  const firstBaseline = el.size * TEXT_METRICS.sizeMult * (1 - TEXT_METRICS.baselineFraction)
  el.lines.forEach((line, i) => {
    const lineWidth = font.widthOfTextAtSize(line, el.size)
    const dx = el.align === 'center' ? (el.width - lineWidth) / 2 : el.align === 'right' ? el.width - lineWidth : 0
    if (line.length === 0) return
    const baseline = firstBaseline + i * lineStep
    page.drawText(line, { x: dx, y: -baseline, size: el.size, font, color: color(el.color), opacity: el.opacity })
    if (el.underline) {
      // stessa barra dell'editor: spessa 1/15 del font, 0,1 del font sotto la linea di base
      const t = el.size * TEXT_METRICS.decorationThickness
      page.drawRectangle({ x: dx, y: -(baseline + el.size * TEXT_METRICS.underlineOffset + t), width: lineWidth, height: t, color: color(el.color), opacity: el.opacity })
    }
  })
}

function drawImage(page: PDFPage, el: ImageElement, img: PDFImage) {
  const w = el.w0 * el.scaleX
  const h = el.h0 * el.scaleY
  page.drawImage(img, { x: 0, y: -h, width: w, height: h, opacity: el.opacity })
}

function drawShape(page: PDFPage, el: ShapeElement) {
  const sw = el.stroke ? el.strokeWidth : 0
  const stroke = el.stroke ? { borderColor: color(el.stroke), borderWidth: sw, borderOpacity: el.opacity } : {}
  const fill = el.fill ? { color: color(el.fill), opacity: el.opacity } : {}
  if (el.shape === 'rect') {
    page.drawRectangle({ x: sw / 2, y: -(sw / 2 + el.h), width: el.w, height: el.h, ...fill, ...stroke })
  } else if (el.shape === 'ellipse') {
    page.drawEllipse({ x: sw / 2 + el.w / 2, y: -(sw / 2 + el.h / 2), xScale: el.w / 2, yScale: el.h / 2, ...fill, ...stroke })
  } else if (el.stroke) {
    // La linea è un rettangolo sottile alto quanto lo spessore (come nell'editor).
    page.drawRectangle({ x: 0, y: -el.strokeWidth, width: el.w, height: el.strokeWidth, color: color(el.stroke), opacity: el.opacity })
  }
}

function drawDrawing(page: PDFPage, el: DrawingElement) {
  const sw = el.strokeWidth
  // Il tracciato è in coordinate SVG (y in basso): drawSvgPath lo ribalta da sé partendo da (x, y).
  page.drawSvgPath(scalePath(el.path, el.scaleX, el.scaleY), {
    x: sw / 2,
    y: -sw / 2,
    borderColor: color(el.color),
    borderWidth: sw,
    borderOpacity: el.opacity,
    borderLineCap: LineCapStyle.Round, // come nell'editor
    // Evidenziatore: moltiplicazione, il testo sotto resta leggibile
    blendMode: el.highlighter ? BlendMode.Multiply : undefined,
  })
}

/**
 * Evidenziazione, sottolineatura o barratura come annotazione PDF vera (Highlight, Underline, StrikeOut):
 * si può selezionare, modificare o togliere in Acrobat e simili. Ha anche il suo aspetto disegnato,
 * così si vede uguale in tutti i lettori.
 */
/** Commento come annotazione «nota» (Text): l'icona è disegnata, il testo lo mostrano i lettori al clic. */
function addComment(pdf: PDFDocument, page: PDFPage, el: CommentElement, toPdf: Matrix) {
  const ctx = pdf.context
  const pts = COMMENT_ICON.map(([x, y]) => apply(toPdf, el.x + x, el.y + y))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const fillC = color(el.color)
  const ops = [setFillingRgbColor(fillC.red, fillC.green, fillC.blue), setStrokingRgbColor(0.08, 0.09, 0.11), setLineWidth(0.75), setLineJoin(LineJoinStyle.Round)]
  pts.forEach((p, i) => ops.push(i === 0 ? moveTo(...p) : lineTo(...p)))
  ops.push(closePath(), fillAndStroke())
  const appearance = ctx.register(ctx.formXObject(ops, { BBox: rect }))
  const annot = ctx.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Name: 'Comment',
    Rect: rect,
    C: [fillC.red, fillC.green, fillC.blue],
    F: 4, // stampabile
    Contents: PDFHexString.fromText(el.text),
    P: page.ref,
    AP: { N: appearance },
  })
  page.node.addAnnot(ctx.register(annot))
}

function addAnnotation(pdf: PDFDocument, page: PDFPage, el: AnnotationElement, toPdf: Matrix) {
  const ctx = pdf.context
  const abs = el.rects.map((r) => ({ x: el.x + r.x, y: el.y + r.y, w: r.w, h: r.h }))
  const corners = (r: { x: number; y: number; w: number; h: number }) =>
    // ordine dei QuadPoints come lo usano i lettori: alto-sinistra, alto-destra, basso-sinistra, basso-destra
    [apply(toPdf, r.x, r.y), apply(toPdf, r.x + r.w, r.y), apply(toPdf, r.x, r.y + r.h), apply(toPdf, r.x + r.w, r.y + r.h)]
  const quads = abs.flatMap((r) => corners(r).flat())
  const xs = quads.filter((_, i) => i % 2 === 0)
  const ys = quads.filter((_, i) => i % 2 === 1)
  const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]

  const c = color(el.color)
  const [r, g, b] = [c.red, c.green, c.blue]
  const ops = [setGraphicsState('GS0'), setFillingRgbColor(r, g, b)]
  for (const poly of abs.flatMap((a) => annotationShapes(el.style, a))) {
    poly.forEach(([x, y], i) => ops.push(i === 0 ? moveTo(...apply(toPdf, x, y)) : lineTo(...apply(toPdf, x, y))))
    ops.push(closePath())
  }
  ops.push(fill())
  const gs = ctx.obj({ Type: 'ExtGState', ca: el.opacity, CA: el.opacity, ...(el.style === 'highlight' ? { BM: 'Multiply' } : {}) })
  const appearance = ctx.register(ctx.formXObject(ops, { BBox: rect, Resources: { ExtGState: { GS0: gs } } }))

  const subtype = { highlight: 'Highlight', underline: 'Underline', strike: 'StrikeOut', squiggly: 'Squiggly' }[el.style]
  const annot = ctx.obj({
    Type: 'Annot',
    Subtype: subtype,
    Rect: rect,
    QuadPoints: quads,
    C: [r, g, b],
    CA: el.opacity,
    F: 4, // stampabile
    Contents: PDFHexString.fromText(el.text),
    P: page.ref,
    AP: { N: appearance },
  })
  page.node.addAnnot(ctx.register(annot))
}


