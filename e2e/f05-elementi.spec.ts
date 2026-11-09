import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pdfInfo } from './helpers'
import type { Page } from '@playwright/test'

const A4 = 595.28

async function addRect(page: Page, x: number, y: number) {
  await page.getByRole('radio', { name: 'Forma' }).click()
  await page.getByRole('radio', { name: 'Rettangolo' }).click()
  const p = await pagePoint(page, 1, x, y, A4)
  await page.mouse.click(p.x, p.y)
}

test.describe('F05 gestire gli elementi', () => {
  test('F05-H1 trascinare sposta l\'elemento', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 300, 400)
    const [a] = await elements(page)
    const from = await pagePoint(page, 1, a.x + 70, a.y + 40, A4)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 20 * from.k, from.y + 10 * from.k, { steps: 5 })
    await page.mouse.move(from.x + 40 * from.k, from.y + 20 * from.k, { steps: 5 })
    await page.mouse.up()
    const [b] = await elements(page)
    expect(b.x - a.x).toBeCloseTo(40, 0)
    expect(b.y - a.y).toBeCloseTo(20, 0)
  })

  test('F05-H2 ridimensionare dall\'angolo allarga la forma, non il bordo', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 300, 400)
    const [a] = await elements(page)
    const sw = a.strokeWidth as number
    const corner = await pagePoint(page, 1, a.x + (a.w as number) + sw, a.y + (a.h as number) + sw, A4)
    await page.mouse.move(corner.x, corner.y)
    await page.mouse.down()
    await page.mouse.move(corner.x + 40 * corner.k, corner.y + 30 * corner.k, { steps: 8 })
    await page.mouse.up()
    const [b] = await elements(page)
    expect(b.w as number).toBeGreaterThan((a.w as number) + 20)
    expect(b.h as number).toBeGreaterThan((a.h as number) + 10)
    expect(b.strokeWidth).toBe(a.strokeWidth)
  })

  test('F05-H3 Canc elimina l\'elemento selezionato', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 300, 400)
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    await page.keyboard.press('Delete')
    expect(await elements(page)).toHaveLength(0)
    await expect(page.getByText('Niente da mostrare.')).toBeVisible()
  })

  test('F05-H4 le frecce spostano di 1 pt, con Maiusc di 10', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 300, 400)
    const [a] = await elements(page)
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    const [b] = await elements(page)
    expect(b.x - a.x).toBeCloseTo(1, 5)
    expect(b.y - a.y).toBeCloseTo(10, 5)
  })

  test('F05-H5 "Porta avanti" cambia l\'ordine dei livelli', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 100, 400)
    await addRect(page, 300, 400)
    const [first, second] = await elements(page)
    expect(second.z).toBeGreaterThan(first.z)
    // nel pannello l'elemento più in alto è il primo: il secondo della lista è il rettangolo più vecchio
    await page.getByRole('button', { name: 'Porta avanti' }).nth(1).click()
    const after = await elements(page)
    const f = after.find((e) => e.id === first.id)!
    const s = after.find((e) => e.id === second.id)!
    expect(f.z).toBeGreaterThan(s.z)
  })

  test('F05-H6 "Rimuovi tutti" chiede conferma; Annulla non rimuove nulla', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 100, 400)
    await addRect(page, 300, 400)
    await page.getByRole('button', { name: 'Rimuovi tutti' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Annulla' }).click()
    expect(await elements(page)).toHaveLength(2)
    await page.getByRole('button', { name: 'Rimuovi tutti' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Rimuovi tutti' }).click()
    expect(await elements(page)).toHaveLength(0)
  })

  test('F05-H7 l\'opacità si regola da tastiera sul cursore', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 300, 400)
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    const slider = page.getByRole('slider', { name: 'Opacità' })
    await slider.focus()
    for (let i = 0; i < 5; i++) await page.keyboard.press('PageDown')
    expect((await elements(page))[0].opacity).toBeCloseTo(0.5, 2)
  })

  test('F05-E1 selezionare dal pannello porta alla pagina dell\'elemento', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.evaluate(() => {
      const st = (window as never as { __editor: { useStore: { getState: () => any } } }).__editor.useStore.getState()
      st.addElement({ type: 'shape', page: 2, x: 100, y: 100, rotation: 0, opacity: 1, shape: 'rect', w: 100, h: 50, fill: '#ffe066', stroke: null, strokeWidth: 2 })
    })
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    await expect(page.getByRole('figure', { name: 'Pagina 3' })).toBeInViewport()
    await expect(page.getByRole('slider', { name: 'Opacità' })).toBeVisible()
    const file = await saveAndDownload(page, info)
    expect((await pdfInfo(file)).pages).toBe(3)
  })
})
