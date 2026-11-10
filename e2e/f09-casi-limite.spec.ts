import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pdfTexts, pdfAnnotations, pdfInfo, a11y, chooseFile, sample, pageFigure } from './helpers'
import type { Page } from '@playwright/test'

const A4 = 595.28
const ANNOTA = 'Evidenzia, sottolinea o barra il testo'

async function addRect(page: Page, x = 300, y = 400) {
  await page.getByRole('radio', { name: 'Forma', exact: true }).click()
  await page.getByRole('radio', { name: 'Rettangolo', exact: true }).click()
  const p = await pagePoint(page, 1, x, y, A4)
  await page.mouse.click(p.x, p.y)
}

async function addText(page: Page, text: string, x = 300, y = 450) {
  await page.getByRole('radio', { name: 'Testo', exact: true }).click()
  const p = await pagePoint(page, 1, x, y, A4)
  await page.mouse.click(p.x, p.y)
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
}

async function dragOn(page: Page, n: number, widthPt: number, from: [number, number], to: [number, number]) {
  const before = (await elements(page)).length
  const tool = await store<string>(page, 'st => st.tool')
  const a = await pagePoint(page, n, from[0], from[1], widthPt)
  const b = await pagePoint(page, n, to[0], to[1], widthPt)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 })
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
  // L'annotazione nasce dopo la lettura del testo della pagina: si aspetta un attimo (se deve nascere).
  if (tool === 'annotate') await expect.poll(async () => (await elements(page)).length, { timeout: 1500 }).toBeGreaterThan(before).catch(() => {})
}

const store = <T,>(page: Page, fn: string) =>
  page.evaluate((f) => new Function('st', `return (${f})(st)`)((window as never as { __editor: { useStore: { getState: () => unknown } } }).__editor.useStore.getState()) as T, fn)

test.describe('casi limite: annulla', () => {
  test('U-E1 il PDF salvato rispetta l\'annullamento', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await addText(page, 'Primo testo', 300, 420)
    await addText(page, 'Secondo testo', 300, 470)
    await page.keyboard.press('ControlOrMeta+z') // annulla la scrittura del secondo
    await page.keyboard.press('ControlOrMeta+z') // annulla la casella del secondo
    expect((await elements(page)).map((e) => e.text)).toEqual(['Primo testo'])
    const texts = (await pdfTexts(await saveAndDownload(page, info))).map((t) => t.text)
    expect(texts).toContain('Primo testo')
    expect(texts.join(' ')).not.toContain('Secondo')
  })

  test('U-E2 Annulla riporta tutto dopo «Rimuovi tutti»', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 100, 400)
    await addRect(page, 250, 400)
    await addRect(page, 400, 400)
    await page.getByRole('button', { name: 'Rimuovi tutti' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Rimuovi tutti' }).click()
    expect(await elements(page)).toHaveLength(0)
    await page.getByRole('button', { name: 'Annulla', exact: true }).click()
    expect(await elements(page)).toHaveLength(3)
    await expect(page.getByRole('button', { name: /Rettangolo/ })).toHaveCount(3)
  })

  test('U-E3 Ctrl Z mentre si scrive non rompe nulla', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Testo', exact: true }).click()
    const p = await pagePoint(page, 1, 300, 450, A4)
    await page.mouse.click(p.x, p.y)
    await page.keyboard.type('Bozza')
    await page.keyboard.press('ControlOrMeta+z')
    await page.keyboard.type(' finale')
    await page.keyboard.press('Escape')
    const [el] = await elements(page)
    // qualunque cosa abbia fatto Ctrl Z, editor e stato devono dire la stessa cosa
    const shown = await page.getByRole('button', { name: /^Testo:/ }).innerText()
    expect(shown).toContain((el.text as string).replace(/\s+/g, ' ').trim().slice(0, 10))
    expect(el.lines).toEqual([el.text])
  })

  test('U-E4 annullare un\'evidenziazione la toglie', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, A4, [52, 112], [200, 122])
    await expect(page.getByRole('button', { name: /Evidenziato:/ })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.getByRole('button', { name: /Evidenziato:/ })).toHaveCount(0)
    expect(await elements(page)).toHaveLength(0)
  })
})

test.describe('casi limite: copia e incolla', () => {
  test('C-E1 incollare con un\'altra pagina in vista mette la copia su quella pagina', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page, 300, 400)
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    await page.keyboard.press('ControlOrMeta+c')
    await pageFigure(page, 3).scrollIntoViewIfNeeded()
    await expect.poll(() => store<number>(page, 'st => st.currentPage')).toBe(2)
    await page.keyboard.press('ControlOrMeta+v')
    const [a, b] = await elements(page)
    expect(b.page).toBe(2)
    expect(b.x).toBeCloseTo(a.x, 5)
    expect(b.y).toBeCloseTo(a.y, 5)
  })

  test('C-E2 modificare la copia non cambia l\'originale', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addText(page, 'Originale')
    await page.getByRole('button', { name: /Testo: Originale/ }).click()
    await page.keyboard.press('ControlOrMeta+c')
    await page.keyboard.press('ControlOrMeta+v')
    await page.getByRole('slider', { name: 'Opacità' }).focus()
    await page.keyboard.press('PageDown')
    const [a, b] = await elements(page)
    expect(a.opacity).toBe(1)
    expect(b.opacity).toBeLessThan(1)
  })

  test('C-E4 inserire un\'immagine con un altro elemento selezionato seleziona l\'immagine', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page)
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    await chooseFile(page, 'Inserisci immagine', sample('timbro.png'))
    await expect(page.getByRole('button', { name: /Immagine/ })).toBeVisible()
    await expect.poll(() => store<string | null>(page, "st => st.elements.find(e => e.id === st.selectedId)?.type ?? null")).toBe('image')
  })

  test('C-E3 Ctrl C mentre si scrive non copia l\'elemento', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Testo', exact: true }).click()
    const p = await pagePoint(page, 1, 300, 450, A4)
    await page.mouse.click(p.x, p.y)
    await page.keyboard.type('Copiami')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+c')
    await page.keyboard.press('Escape')
    await page.keyboard.press('ControlOrMeta+v')
    expect(await elements(page)).toHaveLength(1)
  })

  test('C-E5 si può copiare da un PDF e incollare in un altro', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await chooseFile(page, 'Inserisci immagine', sample('timbro.png'))
    await page.getByRole('button', { name: /Immagine/ }).click()
    await page.keyboard.press('ControlOrMeta+c')
    await page.getByRole('button', { name: 'Chiudi il PDF' }).click()
    await page.getByRole('button', { name: 'Chiudi senza salvare' }).click()
    await chooseFile(page, 'Scegli un PDF', sample('pagine-difficili.pdf'))
    await expect(pageFigure(page, 1)).toBeVisible()
    await page.keyboard.press('ControlOrMeta+v')
    const els = await elements(page)
    expect(els.map((e) => e.type)).toEqual(['image'])
  })

  test('C-N1 un\'annotazione non si copia', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, A4, [52, 112], [200, 122])
    await page.getByRole('button', { name: /Evidenziato:/ }).click()
    await page.keyboard.press('ControlOrMeta+c')
    await page.keyboard.press('ControlOrMeta+v')
    expect(await elements(page)).toHaveLength(1)
  })
})

test.describe('casi limite: annotazioni', () => {
  test('A-E1 trascinare su tre righe crea una annotazione con tre aree', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, A4, [52, 112], [420, 158])
    const els = await elements(page)
    expect(els).toHaveLength(1)
    expect(els[0].rects).toHaveLength(3)
    const [a] = await pdfAnnotations(await saveAndDownload(page, info))
    expect(a.boxes).toHaveLength(3)
  })

  test('A-E2 trascinare dove non c\'è testo non crea nulla', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, A4, [100, 500], [300, 560])
    await page.waitForTimeout(300)
    expect(await elements(page)).toHaveLength(0)
  })

  test('A-E3 su una pagina ruotata si annota, oppure l\'utente viene avvisato', async ({ page }) => {
    await openPdf(page, 'pagine-difficili.pdf')
    // pagina 1: A4 ruotata di 90°, vista 841,89 × 595,28; il titolo è verticale a destra
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, 841.89, [740, 40], [790, 300])
    await page.waitForTimeout(400)
    const created = (await elements(page)).length > 0
    const told = await page.getByText(/ruotat|verticale|non si può/i).isVisible()
    expect(created || told, 'serve un\'annotazione o un messaggio').toBe(true)
  })

  test('A-E4 un\'annotazione non si sposta né con le frecce né trascinandola', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, A4, [52, 112], [200, 122])
    const [a] = await elements(page)
    await page.getByRole('button', { name: /Evidenziato:/ }).click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    await page.getByRole('radio', { name: 'Seleziona e sposta', exact: true }).click()
    await dragOn(page, 1, A4, [100, 117], [160, 200])
    const [b] = await elements(page)
    expect([b.x, b.y]).toEqual([a.x, a.y])
  })

  test('A-E5 annotare un PDF protetto: annotazione salvata, file non cifrato', async ({ page }, info) => {
    await page.goto('/')
    await chooseFile(page, 'Scegli un PDF', sample('protetto-prova.pdf'))
    await page.getByRole('dialog').getByLabel('Password', { exact: true }).fill('prova')
    await page.keyboard.press('Enter')
    await expect(pageFigure(page, 1)).toBeVisible()
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, A4, [52, 112], [200, 122])
    await expect(page.getByRole('button', { name: /Evidenziato:/ })).toBeVisible()
    const file = await saveAndDownload(page, info)
    expect((await pdfInfo(file)).encrypted).toBe(false)
    expect((await pdfAnnotations(file)).map((a) => a.subtype)).toEqual(['Highlight'])
  })

  test('A-E6 Canc elimina un\'annotazione selezionata', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, A4, [52, 112], [200, 122])
    await page.getByRole('button', { name: /Evidenziato:/ }).click()
    await page.keyboard.press('Delete')
    expect(await elements(page)).toHaveLength(0)
  })
})

test.describe('casi limite: schermo e accessibilità', () => {
  test('X-E5 un avviso non sopravvive al cambio di documento', async ({ page }) => {
    await openPdf(page, 'pagine-difficili.pdf')
    await page.getByRole('radio', { name: ANNOTA, exact: true }).click()
    await dragOn(page, 1, 841.89, [740, 40], [790, 300])
    await expect(page.getByText('Non è stato possibile annotare')).toBeVisible()
    await page.getByRole('button', { name: 'Chiudi il PDF' }).click()
    await chooseFile(page, 'Scegli un PDF', sample('documento.pdf'))
    await expect(pageFigure(page, 1)).toBeVisible()
    await expect(page.getByText('Non è stato possibile annotare')).toHaveCount(0)
  })

  test('M-E1 a 390 px la barra completa non fa scorrere la pagina di lato', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openPdf(page, 'documento.pdf')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const redo = page.getByRole('button', { name: 'Ripeti', exact: true })
    await redo.scrollIntoViewIfNeeded()
    await expect(redo).toBeInViewport()
  })

  test('X-A2 accessibilità con gli strumenti nuovi attivi', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    for (const tool of [ANNOTA, 'Evidenziatore a mano libera', 'Mano: trascina per scorrere']) {
      await page.getByRole('radio', { name: tool, exact: true }).click()
      expect(await a11y(page), tool).toEqual([])
    }
  })
})
