import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pdfTexts, a11y, sample } from './helpers'
import type { Page } from '@playwright/test'

async function addText(page: Page, text: string) {
  await page.getByRole('radio', { name: 'Testo' }).click()
  const p = await pagePoint(page, 1, 100, 500, 595.28)
  await page.mouse.click(p.x, p.y)
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
}

test.describe('trasversali', () => {
  test('X-E1 ricaricare con modifiche non salvate chiede conferma', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addText(page, 'Non salvato')
    let asked = false
    page.once('dialog', async (d) => {
      asked = d.type() === 'beforeunload'
      await d.accept()
    })
    await page.reload()
    expect(asked).toBe(true)
    await expect(page.getByRole('heading', { name: 'Modifica un PDF' })).toBeVisible()
  })

  test('X-E2 chiudere con la X chiede conferma e "Continua" non perde nulla', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addText(page, 'Da tenere')
    await page.getByRole('button', { name: 'Chiudi il PDF' }).click()
    await page.getByRole('button', { name: 'Continua a modificare' }).click()
    expect(await elements(page)).toHaveLength(1)
    await page.getByRole('button', { name: 'Chiudi il PDF' }).click()
    await page.getByRole('button', { name: 'Chiudi senza salvare' }).click()
    await expect(page.getByRole('heading', { name: 'Modifica un PDF' })).toBeVisible()
  })

  test('X-E3 senza rete si apre, si modifica e si salva', async ({ page, context }, info) => {
    await page.goto('/')
    await context.setOffline(true)
    // stesso percorso di openPdf ma senza ricaricare la pagina
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Scegli un PDF' }).click()])
    await chooser.setFiles(sample('documento.pdf'))
    await expect(page.getByRole('figure', { name: 'Pagina 1' })).toBeVisible()
    await addText(page, 'Senza rete')
    await page.getByRole('button', { name: 'Grassetto' }).click()
    const file = await saveAndDownload(page, info)
    expect((await pdfTexts(file)).map((t) => t.text)).toContain('Senza rete')
  })

  test('X-A1 accessibilità di S05', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await addText(page, 'Prova')
    await saveAndDownload(page, info)
    expect(await a11y(page)).toEqual([])
  })
})
