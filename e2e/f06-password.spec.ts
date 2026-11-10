import { test, expect, chooseFile, sample, pageFigure, saveAndDownload, pdfTexts, pdfInfo, a11y, pagePoint } from './helpers'

test.describe('F06 PDF protetto', () => {
  test('F06-N1 + H1 password errata, poi giusta: il PDF salvato si apre senza password', async ({ page }, info) => {
    await page.goto('/')
    await chooseFile(page, 'Scegli un PDF', sample('protetto-prova.pdf'))
    const dialog = page.getByRole('dialog', { name: 'Questo PDF è protetto' })
    await expect(dialog).toBeVisible()
    expect(await a11y(page)).toEqual([])
    await dialog.getByLabel('Password', { exact: true }).fill('sbagliata')
    await dialog.getByRole('button', { name: 'Apri' }).click()
    await expect(dialog.getByText('Password errata. Riprova.')).toBeVisible()
    await dialog.getByLabel('Password', { exact: true }).fill('prova')
    await page.keyboard.press('Enter')
    await expect(pageFigure(page, 1)).toBeVisible()

    await page.getByRole('radio', { name: 'Testo', exact: true }).click()
    const p = await pagePoint(page, 1, 100, 500, 595.28)
    await page.mouse.click(p.x, p.y)
    await page.keyboard.type('Aggiunto')
    await page.keyboard.press('Escape')
    const file = await saveAndDownload(page, info)
    await expect(page.getByRole('alert')).toContainText('non ha password')

    const pdf = await pdfInfo(file)
    expect(pdf.encrypted).toBe(false)
    const texts = (await pdfTexts(file)).map((t) => t.text)
    expect(texts).toContain('Aggiunto')
    expect(texts).toContain('Verbale della riunione del 4 novembre 2026.') // contenuto originale decifrato
  })

  test('F06-E1 Annulla nella finestra della password torna all\'inizio', async ({ page }) => {
    await page.goto('/')
    await chooseFile(page, 'Scegli un PDF', sample('protetto-prova.pdf'))
    await page.getByRole('dialog').getByRole('button', { name: 'Annulla' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Modifica un PDF' })).toBeVisible()
  })

  test('F06-E2 PDF con soli permessi: si apre e si salva', async ({ page }, info) => {
    await page.goto('/')
    await chooseFile(page, 'Scegli un PDF', sample('solo-permessi.pdf'))
    await expect(pageFigure(page, 1)).toBeVisible()
    const file = await saveAndDownload(page, info)
    await expect(page.getByRole('alert')).toContainText('non ha password')
    expect((await pdfInfo(file)).encrypted).toBe(false)
    expect((await pdfTexts(file)).map((t) => t.text)).toContain('Cifrato con soli permessi')
  })
})
