import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pdfAnnotations, pageShot, pixelMatch, setZoom, chooseFile, sample, a11y } from './helpers'
import type { Page, TestInfo } from '@playwright/test'

const A4 = 595.28
const LINE = { y: 120, x: 56 }

async function sameAfterExport(page: Page, info: TestInfo) {
  await setZoom(page, 100)
  await page.evaluate(() => (window as never as { __editor: { useStore: { getState: () => any } } }).__editor.useStore.getState().select(null))
  const before = await pageShot(page, 1)
  const file = await saveAndDownload(page, info)
  await page.getByRole('button', { name: 'Chiudi ed elimina dalla memoria' }).click()
  await chooseFile(page, 'Scegli un PDF', file)
  await expect(page.getByRole('figure', { name: 'Pagina 1' })).toBeVisible()
  await setZoom(page, 100)
  const after = await pageShot(page, 1)
  return { file, score: await pixelMatch(page, before, after) }
}

test.describe('avanzamento all\'apertura', () => {
  test('S01-E2 un PDF lungo mostra l\'avanzamento mentre si apre', async ({ page }) => {
    await page.goto('/')
    // CPU 20 volte più lenta: l'apertura dura abbastanza da far comparire la barra
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 })
    await chooseFile(page, 'Scegli un PDF', sample('lungo.pdf'))
    const bar = page.getByRole('progressbar', { name: 'Apertura del PDF' })
    await expect(bar).toBeVisible({ timeout: 15_000 })
    await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 30_000 }).toBeGreaterThan(20)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await expect(page.getByRole('figure', { name: 'Pagina 1', exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(bar).toHaveCount(0)
  })

  test('S01-E3 un PDF piccolo si apre senza lampi di barre', async ({ page }) => {
    await page.goto('/')
    let seen = false
    page.on('framenavigated', () => {})
    await page.exposeFunction('__barSeen', () => (seen = true))
    await page.evaluate(() => {
      new MutationObserver(() => {
        if (document.querySelector('[role="progressbar"]')) (window as never as { __barSeen: () => void }).__barSeen()
      }).observe(document.body, { childList: true, subtree: true })
    })
    await chooseFile(page, 'Scegli un PDF', sample('documento.pdf'))
    await expect(page.getByRole('figure', { name: 'Pagina 1', exact: true })).toBeVisible()
    expect(seen).toBe(false)
  })
})

test.describe('sottolineatura ondulata', () => {
  test('F08-H4 l\'onda diventa un\'annotazione Squiggly, uguale nell\'editor e nel PDF', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Evidenzia, sottolinea o barra il testo', exact: true }).click()
    await page.getByRole('radio', { name: 'Sottolinea con onda', exact: true }).click()
    const a = await pagePoint(page, 1, LINE.x - 4, LINE.y - 8, A4)
    const b = await pagePoint(page, 1, LINE.x + 200, LINE.y + 2, A4)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(b.x, b.y, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByRole('button', { name: /Sottolineato con onda:/ })).toBeVisible()
    const { file, score } = await sameAfterExport(page, info)
    expect(score).toBeGreaterThanOrEqual(95)
    expect((await pdfAnnotations(file)).map((x) => x.subtype)).toEqual(['Squiggly'])
  })
})

test.describe('commenti', () => {
  test('F09-H1 commento: clic, scrivi, salva → nota nel PDF con il testo', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Commento', exact: true }).click()
    const p = await pagePoint(page, 1, 400, 120, A4)
    await page.mouse.click(p.x, p.y)
    const field = page.getByRole('textbox', { name: 'Commento' })
    await expect(field).toBeFocused()
    await page.keyboard.type('Controllare la data di consegna')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: /Commento: Controllare la data/ })).toBeVisible()
    await page.getByRole('button', { name: /Commento: Controllare la data/ }).click()
    await expect(page.getByRole('slider', { name: 'Opacità' })).toHaveCount(0) // nessun comando senza effetto
    const [el] = await elements(page)
    expect(el).toMatchObject({ type: 'comment', text: 'Controllare la data di consegna' })

    const { file, score } = await sameAfterExport(page, info)
    expect(score).toBeGreaterThanOrEqual(95)
    const [a] = await pdfAnnotations(file)
    expect(a).toMatchObject({ page: 1, subtype: 'Text', contents: 'Controllare la data di consegna' })
  })

  test('F09-E1 un commento vuoto non finisce nel PDF', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Commento', exact: true }).click()
    const p = await pagePoint(page, 1, 400, 120, A4)
    await page.mouse.click(p.x, p.y)
    await expect(page.getByRole('button', { name: /Commento: \(vuoto\)/ })).toBeVisible()
    const file = await saveAndDownload(page, info)
    expect(await pdfAnnotations(file)).toEqual([])
  })

  test('F09-E2 il commento si sposta ma non si ridimensiona; accenti ed emoji restano nel testo', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Commento', exact: true }).click()
    const p = await pagePoint(page, 1, 400, 300, A4)
    await page.mouse.click(p.x, p.y)
    await page.keyboard.type('Sì, è così 👍')
    await page.keyboard.press('Escape')
    const [a] = await elements(page)
    const from = await pagePoint(page, 1, a.x + 6, a.y + 6, A4)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 30 * from.k, from.y + 20 * from.k, { steps: 6 })
    await page.mouse.up()
    const [b] = await elements(page)
    expect(b.x - a.x).toBeCloseTo(30, 0)
    expect(b.y - a.y).toBeCloseTo(20, 0)
    const [ann] = await pdfAnnotations(await saveAndDownload(page, info))
    expect(ann.contents).toBe('Sì, è così 👍') // il testo del commento non usa i font dell'editor
  })

  test('F09-E3 solo tastiera: Invio sullo strumento inserisce il commento e porta al campo', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Commento', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'Commento' })).toBeFocused()
    await page.keyboard.type('Da tastiera')
    await page.keyboard.press('Enter')
    expect((await elements(page))[0]).toMatchObject({ type: 'comment', text: 'Da tastiera' })
    expect(await a11y(page)).toEqual([])
  })
})
