// Crea il PDF finale: carica l'originale con pdf-lib e ci disegna sopra gli elementi.
// L'unico punto in cui le coordinate "come si vede" diventano coordinate PDF.
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFInvalidObject,
  EncryptedPDFError,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  rgb,
  LineCapStyle,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from '@cantoo/pdf-lib'
import fontkit from '@cantoo/fontkit'
import type { Documento, DrawingElement, Element, ImageElement, ShapeElement, TextElement } from '../model'
import { elementToPdf } from './geometry'
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

async function load(doc: Documento): Promise<{ pdf: PDFDocument; wasEncrypted: boolean }> {
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
  const { pdf, wasEncrypted } = await load(doc)
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

  const isolated = new Set<number>()
  const sorted = [...elements].sort((a, b) => a.page - b.page || a.z - b.z)
  for (const el of sorted) {
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
    page.drawText(line, {
      x: dx,
      y: -(firstBaseline + i * lineStep),
      size: el.size,
      font,
      color: color(el.color),
      opacity: el.opacity,
    })
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
  })
}

