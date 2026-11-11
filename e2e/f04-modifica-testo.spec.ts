import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pdfTexts, pdfInfo, pageShot, pixelMatch, setZoom, chooseFile } from './helpers'
import type { Page } from '@playwright/test'

const A4 = 595.28
const TOOL = 'Modifica il testo del PDF'

async function clickOnText(page: Page, x: number, y: number) {
  await page.getByRole('radio', { name: TOOL, exact: true }).click()
  const p = await pagePoint(page, 1, x, y, A4)
  await page.mouse.click(p.x, p.y)
}

test.describe('F04 modificare il testo esistente', () => {
  test('F04-H1 clic su una riga, la si riscrive: nel PDF c\'è solo il testo nuovo, nello stesso punto', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    const before = (await pdfTexts('samples/documento.pdf')).filter((t) => t.page === 1)
    await clickOnText(page, 120, 116) // «Verbale della riunione del 4 novembre 2026.», linea di base a y = 120
    await expect(page.getByRole('button', { name: /Testo originale tolto: Verbale/ })).toBeVisible()
    const [erase, text] = await elements(page)
    expect(erase.type).toBe('erase')
    expect(text).toMatchObject({ type: 'text', text: 'Verbale della riunione del 4 novembre 2026.', font: 'NotoSans', size: 12 })

    await page.keyboard.type('Verbale approvato il 10 novembre 2026.') // il testo è già selezionato: si sostituisce
    await page.keyboard.press('Escape')
    const file = await saveAndDownload(page, info)
    const after = (await pdfTexts(file)).filter((t) => t.page === 1)
    expect(after.map((t) => t.text)).not.toContain('Verbale della riunione del 4 novembre 2026.')
    const nuovo = after.find((t) => t.text === 'Verbale approvato il 10 novembre 2026.')!
    expect(nuovo).toBeTruthy()
    expect(nuovo.x).toBeCloseTo(56, 0)
    expect(Math.abs(nuovo.y - 120)).toBeLessThan(0.6) // stessa linea di base
    // le altre righe non si sono mosse
    for (const o of before.filter((t) => !t.text.startsWith('Verbale'))) {
      const same = after.find((a) => a.text === o.text)!
      expect(same, o.text).toBeTruthy()
      expect(Math.abs(same.x - o.x) + Math.abs(same.y - o.y), o.text).toBeLessThan(0.01)
    }
    expect((await pdfInfo(file)).fonts.some((f) => /NotoSans-Regular/.test(f))).toBe(true)
  })

  test('F04-H2 importo in grassetto rosso su sfondo giallo (PDF stampato da Chrome)', async ({ page }, info) => {
    await openPdf(page, 'stampato-da-chrome.pdf')
    const t = (await pdfTexts('samples/stampato-da-chrome.pdf')).find((x) => x.text.startsWith('1.250,00'))!
    await clickOnText(page, t.x + 10, t.y - t.size * 0.3)
    await expect.poll(async () => (await elements(page)).length).toBe(2)
    const [erase, text] = await elements(page)
    expect(text).toMatchObject({ type: 'text', font: 'NotoSerif', bold: true })
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    const [r, g] = rgb(text.color as string)
    expect(r, 'testo rosso').toBeGreaterThan(140)
    expect(g, 'testo rosso').toBeLessThan(90)
    const [br, bg, bb] = rgb(erase.color as string)
    expect(br > 240 && bg > 220 && bb < 230, `sfondo giallo chiaro (${erase.color})`).toBe(true)

    await page.keyboard.type('2.000,00 €')
    await page.keyboard.press('Escape')
    const file = await saveAndDownload(page, info)
    const texts = (await pdfTexts(file)).map((x) => x.text).join(' | ')
    expect(texts).toContain('2.000,00 €')
    expect(texts).not.toContain('1.250,00')
    expect(texts).toContain('Totale da pagare:') // il resto della riga c'è ancora
  })

  test('F04-H3 l\'editor mostra già quello che finirà nel PDF', async ({ page }, info) => {
    await openPdf(page, 'stampato-da-chrome.pdf')
    const t = (await pdfTexts('samples/stampato-da-chrome.pdf')).find((x) => x.text.startsWith('Gentile'))!
    await clickOnText(page, t.x + 30, t.y - t.size * 0.3)
    await expect.poll(async () => (await elements(page)).length).toBe(2)
    await page.keyboard.type('Gentile cliente, le confermiamo la fornitura.')
    await page.keyboard.press('Escape')
    await setZoom(page, 100)
    await page.evaluate(() => (window as never as { __editor: { useStore: { getState: () => any } } }).__editor.useStore.getState().select(null))
    const before = await pageShot(page, 1)
    const file = await saveAndDownload(page, info)
    await page.getByRole('button', { name: 'Chiudi ed elimina dalla memoria' }).click()
    await chooseFile(page, 'Scegli un PDF', file)
    await expect(page.getByRole('figure', { name: 'Pagina 1' })).toBeVisible()
    await setZoom(page, 100)
    const score = await pixelMatch(page, before, await pageShot(page, 1))
    expect(score, `${score.toFixed(1)}% dei pixel disegnati coincide`).toBeGreaterThanOrEqual(95)
  })

  test('F04-E1 un solo Annulla toglie sia il testo nuovo sia il riquadro', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await clickOnText(page, 120, 116)
    await expect.poll(async () => (await elements(page)).length).toBe(2)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Annulla', exact: true }).click()
    expect(await elements(page)).toHaveLength(0)
  })

  test('F04-E2 clic dove non c\'è testo: l\'editor lo dice', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await clickOnText(page, 300, 600)
    await expect(page.getByText('Clicca su una riga di testo del PDF.')).toBeVisible()
    expect(await elements(page)).toHaveLength(0)
  })

  test('F04-N1 su un PDF senza testo lo strumento è disattivato', async ({ page }) => {
    await openPdf(page, 'scansione.pdf')
    await expect(page.getByRole('radio', { name: TOOL, exact: true })).toBeDisabled()
  })
})
