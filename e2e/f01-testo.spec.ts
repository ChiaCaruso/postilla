import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pdfTexts, pdfInfo, firstBaseline, pageFigure, a11y } from './helpers'

const A4 = 595.28

async function addTextByClick(page: import('@playwright/test').Page, n: number, x: number, y: number, text: string) {
  await page.getByRole('radio', { name: 'Testo' }).click()
  const p = await pagePoint(page, n, x, y, A4)
  await page.mouse.click(p.x, p.y)
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
}

test.describe('F01 aggiungere testo e scaricare', () => {
  test('F01-H1 il testo finisce nel PDF dove era nell\'editor', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await addTextByClick(page, 1, 300, 330, 'Approvato il 9 novembre')
    const [el] = await elements(page)
    expect(el).toMatchObject({ type: 'text', text: 'Approvato il 9 novembre', page: 0 })
    await expect(page.getByRole('button', { name: /Testo: Approvato il 9 novembre/ })).toBeVisible()

    const file = await saveAndDownload(page, info)
    const t = (await pdfTexts(file)).find((i) => i.text === 'Approvato il 9 novembre')!
    expect(t.page).toBe(1)
    expect(t.x).toBeCloseTo(el.x, 0)
    expect(Math.abs(t.y - (el.y + firstBaseline(el.size as number)))).toBeLessThan(0.5)
    expect(t.angle).toBe(0)
  })

  test('F01-E1 il testo lungo va a capo uguale nell\'editor e nel PDF', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    const long = 'Il presente verbale viene approvato all\'unanimità dai presenti e trasmesso agli uffici competenti per gli adempimenti successivi, con allegati il preventivo e il cronoprogramma dei lavori.'
    await addTextByClick(page, 1, 56, 600, long)
    const [el] = await elements(page)
    const lines = el.lines as string[]
    expect(lines.length).toBeGreaterThan(2)

    const file = await saveAndDownload(page, info)
    const items = (await pdfTexts(file)).filter((i) => i.y > el.y && i.y < el.y + 200 && i.page === 1)
    expect(items.map((i) => i.text.trim())).toEqual(lines.map((l) => l.trim()).filter(Boolean))
  })

  test('F01-E2 accenti e simboli restano identici', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    const s = 'È già l’ora: 1.250,00 € – così «sì»'
    await addTextByClick(page, 1, 56, 600, s)
    const file = await saveAndDownload(page, info)
    expect((await pdfTexts(file)).map((i) => i.text)).toContain(s)
  })

  test('F01-E3 le emoji non spariscono in silenzio', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await addTextByClick(page, 1, 56, 600, 'Ok 👍')
    const warned = await page.getByText(/emoji/i).isVisible()
    const file = await saveAndDownload(page, info)
    const inPdf = (await pdfTexts(file)).some((i) => i.text.includes('👍'))
    expect(inPdf || warned, 'l\'emoji deve esserci nel PDF oppure l\'utente deve essere avvisato').toBe(true)
  })

  test('F01-E4 un testo svuotato sparisce', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Testo' }).click()
    const p = await pagePoint(page, 1, 300, 330, A4)
    await page.mouse.click(p.x, p.y)
    await page.keyboard.press('Backspace') // il testo iniziale è tutto selezionato
    await page.keyboard.press('Escape')
    expect(await elements(page)).toHaveLength(0)
  })

  test('F01-E5 solo tastiera: inserisci, scrivi, salva', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Testo' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.type('Scritto senza mouse')
    await page.keyboard.press('Escape')
    const [el] = await elements(page)
    expect(el).toMatchObject({ type: 'text', text: 'Scritto senza mouse' })
    await page.getByRole('button', { name: 'Salva il PDF' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Il PDF è pronto' })).toBeFocused()
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => {
      await page.getByRole('button', { name: 'Scarica il PDF' }).focus()
      await page.keyboard.press('Enter')
    })()])
    const file = info.outputPath('tastiera.pdf')
    await dl.saveAs(file)
    expect((await pdfTexts(file)).map((i) => i.text)).toContain('Scritto senza mouse')
  })

  test('F01-E6 doppio clic su Salva produce un solo PDF', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addTextByClick(page, 1, 300, 330, 'Doppio')
    await page.getByRole('button', { name: 'Salva il PDF' }).dblclick()
    await expect(page.getByRole('heading', { name: 'Il PDF è pronto' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Il PDF è pronto' })).toHaveCount(1)
  })

  test('F01-E7 su pagine ruotate e ritagliate il testo è dritto e al suo posto', async ({ page }, info) => {
    await openPdf(page, 'pagine-difficili.pdf')
    await page.evaluate(() => {
      const st = (window as never as { __editor: { useStore: { getState: () => any } } }).__editor.useStore.getState()
      st.doc.pagine.forEach((_: unknown, i: number) =>
        st.addElement({ type: 'text', page: i, x: 40, y: 40, rotation: 0, opacity: 1, text: `T${i + 1}`, lines: [`T${i + 1}`], width: 200, font: 'NotoSans', size: 16, color: '#14171c', bold: false, italic: false, align: 'left' }),
      )
    })
    const file = await saveAndDownload(page, info)
    const items = (await pdfTexts(file)).filter((i) => /^T\d$/.test(i.text))
    expect(items).toHaveLength(5)
    for (const t of items) {
      expect(t.angle, `pagina ${t.page}`).toBe(0)
      expect(t.x, `pagina ${t.page}`).toBeCloseTo(40, 1)
      expect(t.y, `pagina ${t.page}`).toBeCloseTo(40 + firstBaseline(16), 1)
    }
  })

  test('F01-E8 font, grassetto, corsivo, dimensione e centratura arrivano nel PDF', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await addTextByClick(page, 1, 100, 600, 'Centrato')
    await page.getByRole('button', { name: /Testo: Centrato/ }).click()
    await page.getByLabel('Font').selectOption('NotoSerif')
    await page.getByLabel('Dimensione').selectOption('24')
    await page.getByRole('button', { name: 'Grassetto' }).click()
    await page.getByRole('button', { name: 'Corsivo' }).click()
    await page.getByRole('button', { name: 'Centra', exact: true }).click()
    await expect.poll(async () => (await elements(page))[0]).toMatchObject({ font: 'NotoSerif', size: 24, bold: true, italic: true, align: 'center' })
    const [el] = await elements(page)
    const file = await saveAndDownload(page, info)
    expect((await pdfInfo(file)).fonts.some((f) => /NotoSerif-BoldItalic/.test(f))).toBe(true)
    const t = (await pdfTexts(file)).find((i) => i.text === 'Centrato')!
    expect(t.size).toBeCloseTo(24, 1)
    // centrato: il testo inizia dopo il bordo sinistro della casella
    expect(t.x).toBeGreaterThan(el.x + 20)
  })

  test('F01-E9 a 390 px nessuno scorrimento orizzontale e avviso chiudibile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openPdf(page, 'documento.pdf')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.getByText('Meglio da computer')).toBeVisible()
    await page.getByRole('button', { name: 'Chiudi avviso' }).click()
    await expect(page.getByText('Meglio da computer')).toHaveCount(0)
    await expect(pageFigure(page, 1)).toBeVisible()
  })

  test('X-A1 accessibilità dell\'editor con un elemento selezionato', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addTextByClick(page, 1, 300, 330, 'Prova')
    await page.getByRole('button', { name: /Testo: Prova/ }).click()
    expect(await a11y(page)).toEqual([])
  })
})
