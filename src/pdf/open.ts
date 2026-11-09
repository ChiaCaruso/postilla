import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { MAX_BYTES, type Documento, type ErroreApertura, type Matrix, type Pagina } from '../model'
import { invert } from './geometry'

// Il worker parte subito, all'apertura dell'app: se poi la rete cade, i PDF si aprono lo stesso.
GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: 'module' })

const base = `${import.meta.env.BASE_URL}pdfjs/`
export const PDFJS_ASSETS = {
  cMapUrl: `${base}cmaps/`,
  standardFontDataUrl: `${base}standard_fonts/`,
  wasmUrl: `${base}wasm/`,
  iccUrl: `${base}iccs/`,
}

export class OpenError extends Error {
  code: ErroreApertura
  constructor(code: ErroreApertura, detail?: string) {
    super(detail ?? code)
    this.code = code
  }
}

export interface Opened {
  doc: Documento
  pdfjs: PDFDocumentProxy
}

/** Un PDF ha l'intestazione "%PDF-" entro il primo kilobyte. */
function looksLikePdf(bytes: Uint8Array) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

export async function openPdf(file: File, password?: string): Promise<Opened> {
  if (file.size > MAX_BYTES) throw new OpenError('troppo_grande')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!looksLikePdf(bytes)) throw new OpenError('non_pdf')

  let pdfjs: PDFDocumentProxy
  try {
    // pdf.js trasferisce il buffer al worker: gli passiamo una copia e teniamo l'originale per l'export.
    pdfjs = await getDocument({ data: bytes.slice(), password, ...PDFJS_ASSETS, enableXfa: false }).promise
  } catch (e) {
    const err = e as { name?: string; code?: number; message?: string }
    if (err.name === 'PasswordException') {
      throw new OpenError(err.code === 2 ? 'password_errata' : 'serve_password')
    }
    throw new OpenError('danneggiato', err.message)
  }

  const pagine: Pagina[] = []
  for (let i = 0; i < pdfjs.numPages; i++) {
    const page = await pdfjs.getPage(i + 1)
    const vp = page.getViewport({ scale: 1 })
    // vp.transform porta le coordinate del PDF in coordinate "come si vede": ci serve l'inversa.
    pagine.push({ indice: i, larghezza: vp.width, altezza: vp.height, toPdf: invert(vp.transform as Matrix) })
  }

  let haTesto = false
  for (let i = 1; i <= Math.min(3, pdfjs.numPages) && !haTesto; i++) {
    const content = await (await pdfjs.getPage(i)).getTextContent()
    haTesto = content.items.some((it) => 'str' in it && it.str.trim().length > 0)
  }

  return {
    pdfjs,
    doc: {
      nomeFile: file.name,
      dimensioneByte: file.size,
      bytes,
      password: password ?? null,
      pagine,
      haTesto,
    },
  }
}
