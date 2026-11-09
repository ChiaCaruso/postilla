// Strumenti comuni ai test: controlli automatici (console, 5xx), apertura PDF, salvataggio,
// lettura del PDF prodotto, accessibilità, confronto immagini.
import { test as base, expect, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFDict, PDFName } from '@cantoo/pdf-lib'

export const sample = (name: string) => fileURLToPath(new URL(`../samples/${name}`, import.meta.url))

/** Ogni test fallisce se compaiono errori in console, eccezioni o risposte 5xx. */
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`)
      })
      page.on('pageerror', (e) => errors.push(`eccezione: ${e.message}`))
      page.on('response', (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`)
      })
      await use()
      expect(errors, 'errori durante il test').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

export async function chooseFile(page: Page, button: string, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: button }).click()])
  await chooser.setFiles(file)
}

/** Apre un PDF dalla schermata iniziale e aspetta la prima pagina. */
export async function openPdf(page: Page, file: string) {
  await page.goto('/')
  await chooseFile(page, 'Scegli un PDF', sample(file))
  await expect(page.getByRole('figure', { name: 'Pagina 1' })).toBeVisible()
}

export const pageFigure = (page: Page, n: number) => page.getByRole('figure', { name: `Pagina ${n}`, exact: true })

/** Coordinate dello schermo di un punto della pagina n (in punti PDF "come si vede"). */
export async function pagePoint(page: Page, n: number, x: number, y: number, widthPt: number) {
  const fig = pageFigure(page, n)
  await fig.scrollIntoViewIfNeeded()
  const inner = fig.locator('> div')
  let box = (await inner.boundingBox())!
  const k = box.width / widthPt
  // Porta il punto a metà altezza dell'area visibile: un clic fuori schermo non arriva alla pagina.
  const vh = page.viewportSize()!.height
  const target = box.y + y * k
  if (target < 220 || target > vh - 60) {
    await page.mouse.move(box.x + 10, Math.min(Math.max(box.y + 10, 220), vh - 60))
    await page.mouse.wheel(0, target - vh / 2)
    await page.waitForTimeout(150)
    box = (await inner.boundingBox())!
  }
  return { x: box.x + x * k, y: box.y + y * k, k }
}

export interface El {
  id: string
  type: string
  page: number
  x: number
  y: number
  z: number
  [k: string]: unknown
}

/** Elementi nello stato dell'app (accesso disponibile solo in sviluppo). */
export const elements = (page: Page): Promise<El[]> =>
  page.evaluate(() =>
    (window as unknown as { __editor: { useStore: { getState: () => { elements: El[] } } } }).__editor.useStore
      .getState()
      .elements.map(({ src: _s, ...e }: El & { src?: string }) => e),
  )

export const setZoom = (page: Page, z: number) =>
  page.evaluate((z) => (window as unknown as { __editor: { useStore: { getState: () => { setZoom: (n: number) => void } } } }).__editor.useStore.getState().setZoom(z), z)

/** Salva, scarica e restituisce il percorso del PDF. */
export async function saveAndDownload(page: Page, info: TestInfo, name = 'risultato.pdf') {
  await page.getByRole('button', { name: 'Salva il PDF' }).click()
  await expect(page.getByRole('heading', { name: 'Il PDF è pronto' })).toBeVisible({ timeout: 20_000 })
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Scarica il PDF' }).click()])
  const path = info.outputPath(name)
  await dl.saveAs(path)
  return path
}

// pdf.js 6 usa Promise.withResolvers, assente in Node 20.
const P = Promise as unknown as { withResolvers?: () => unknown }
P.withResolvers ??= () => {
  let resolve!: (v: unknown) => void
  let reject!: (e: unknown) => void
  const promise = new Promise((a, b) => {
    resolve = a
    reject = b
  })
  return { promise, resolve, reject }
}

export interface TextItem {
  page: number
  text: string
  /** origine della linea di base, coordinate "come si vede" */
  x: number
  y: number
  size: number
  /** direzione del testo come si vede, in gradi (0 = dritto) */
  angle: number
}

export async function pdfTexts(file: string): Promise<TextItem[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 }).promise
  const out: TextItem[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const vp = page.getViewport({ scale: 1 })
    const { items } = await page.getTextContent()
    for (const it of items) {
      if (!('str' in it) || !it.str) continue
      const [a, b, , , e, f] = it.transform as number[]
      const [x, y] = vp.convertToViewportPoint(e, f)
      const [x2, y2] = vp.convertToViewportPoint(e + a, f + b)
      out.push({ page: i, text: it.str, x, y, size: Math.hypot(a, b), angle: Math.round((Math.atan2(y2 - y, x2 - x) * 180) / Math.PI) })
    }
  }
  return out
}

export async function pdfInfo(file: string) {
  const doc = await PDFDocument.load(readFileSync(file))
  const fonts = new Set<string>()
  let images = 0
  for (const [, o] of doc.context.enumerateIndirectObjects()) {
    const dict = o instanceof PDFDict ? o : (o as { dict?: PDFDict }).dict
    if (!dict) continue
    if (dict.get(PDFName.of('Type'))?.toString() === '/Font') fonts.add(String(dict.get(PDFName.of('BaseFont'))))
    if (dict.get(PDFName.of('Subtype'))?.toString() === '/Image') images++
  }
  return { encrypted: doc.isEncrypted, pages: doc.getPageCount(), fonts: [...fonts], images }
}

/** Scansione di accessibilità: restituisce le violazioni in forma leggibile. */
export async function a11y(page: Page) {
  const r = await new AxeBuilder({ page }).analyze()
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
}

/** Quota (0–100) di pixel disegnati che coincidono tra due PNG, calcolata nel browser. */
export async function pixelMatch(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([a64, b64]) => {
      const load = async (s: string) => {
        const img = new Image()
        img.src = `data:image/png;base64,${s}`
        await img.decode()
        return img
      }
      const [ia, ib] = await Promise.all([load(a64), load(b64)])
      const w = Math.min(ia.width, ib.width)
      const h = Math.min(ia.height, ib.height)
      const read = (img: HTMLImageElement) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const g = c.getContext('2d')!
        g.drawImage(img, 0, 0)
        return g.getImageData(0, 0, w, h).data
      }
      const da = read(ia)
      const db = read(ib)
      // Solo i pixel "con inchiostro" in almeno una delle due immagini: il bianco della pagina non conta.
      let ink = 0
      let same = 0
      const isInk = (d: Uint8ClampedArray, i: number) => d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235
      for (let i = 0; i < da.length; i += 4) {
        if (!isInk(da, i) && !isInk(db, i)) continue
        ink++
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
        if (d <= 64) same++
      }
      return ink === 0 ? 100 : (same / ink) * 100
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

/** Costanti di impaginazione (copiate da src/pdf/metrics.ts per non importare codice dell'app nei test). */
export const firstBaseline = (size: number) => size * 1.13 * (1 - 0.222)
