import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pdfInfo, pdfAnnotations, pageShot, pixelMatch, setZoom, chooseFile } from './helpers'
import type { Page, TestInfo } from '@playwright/test'

const A4 = 595.28
// In documento.pdf la prima riga del verbale ha la linea di base a y = 120 pt, corpo 12, da x = 56.
const LINE = { y: 120, size: 12, x: 56, text: 'Verbale della riunione del 4 novembre 2026.' }

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await pagePoint(page, 1, from[0], from[1], A4)
  const b = await pagePoint(page, 1, to[0], to[1], A4)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 })
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
}

/** L'editor e il PDF esportato (riaperto) mostrano la pagina 1 allo stesso modo. */
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

test.describe('F08 annotare il testo', () => {
  test('F08-H1 trascinando sopra una riga la si evidenzia; nel PDF è un\'annotazione vera', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Evidenzia, sottolinea o barra il testo', exact: true }).click()
    await drag(page, [LINE.x - 4, LINE.y - 8], [LINE.x + 125, LINE.y + 2])
    const [el] = await elements(page)
    expect(el).toMatchObject({ type: 'annotation', style: 'highlight' })
    expect(LINE.text.startsWith(el.text as string)).toBe(true)
    expect((el.text as string).length).toBeGreaterThan(10)
    await expect(page.getByRole('button', { name: /Evidenziato: Verbale/ })).toBeVisible()

    const { file, score } = await sameAfterExport(page, info)
    expect(score, `${score.toFixed(1)}% dei pixel coincide`).toBeGreaterThanOrEqual(95)
    const [a] = await pdfAnnotations(file)
    expect(a).toMatchObject({ page: 1, subtype: 'Highlight', contents: el.text })
    // l'area evidenziata copre la riga giusta
    expect(a.boxes[0].y).toBeLessThan(LINE.y)
    expect(a.boxes[0].y + a.boxes[0].h).toBeGreaterThan(LINE.y)
    expect(a.boxes[0].x).toBeCloseTo(LINE.x, 0)
  })

  test('F08-H2 un clic su una parola la evidenzia tutta', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Evidenzia, sottolinea o barra il testo', exact: true }).click()
    const p = await pagePoint(page, 1, LINE.x + 100, LINE.y - 4, A4) // dentro "riunione" (da x ≈ 129 a ≈ 178)
    await page.mouse.click(p.x, p.y)
    await expect.poll(async () => (await elements(page))[0]?.text).toBe('riunione')
  })

  test('F08-H3 sottolineare e barrare diventano Underline e StrikeOut', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Evidenzia, sottolinea o barra il testo', exact: true }).click()
    await page.getByRole('radio', { name: 'Sottolinea', exact: true }).click()
    await drag(page, [LINE.x - 4, LINE.y - 8], [LINE.x + 60, LINE.y + 2])
    await page.getByRole('radio', { name: 'Barra', exact: true }).click()
    await drag(page, [LINE.x - 4, LINE.y + 10], [LINE.x + 60, LINE.y + 20]) // riga sotto
    await expect.poll(async () => (await elements(page)).map((e) => e.style)).toEqual(['underline', 'strike'])
    const { file, score } = await sameAfterExport(page, info)
    expect(score).toBeGreaterThanOrEqual(95)
    expect((await pdfAnnotations(file)).map((a) => a.subtype)).toEqual(['Underline', 'StrikeOut'])
  })

  test('F08-N1 su un PDF senza testo lo strumento è disattivato e dice perché', async ({ page }) => {
    await openPdf(page, 'scansione.pdf')
    await expect(page.getByRole('radio', { name: 'Evidenzia, sottolinea o barra il testo', exact: true })).toBeDisabled()
    await page.keyboard.press('a')
    expect(await page.evaluate(() => (window as never as { __editor: { useStore: { getState: () => { tool: string } } } }).__editor.useStore.getState().tool)).toBe('select')
  })

  test('F03-H4 l\'evidenziatore a mano libera lascia leggibile il testo, anche nel PDF', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Evidenziatore a mano libera', exact: true }).click()
    await drag(page, [LINE.x, LINE.y - 4], [LINE.x + 200, LINE.y - 4])
    const [el] = await elements(page)
    expect(el).toMatchObject({ type: 'drawing', highlighter: true })
    const { file, score } = await sameAfterExport(page, info)
    expect(score).toBeGreaterThanOrEqual(95)
    expect((await pdfInfo(file)).blendModes).toContain('/Multiply')
  })
})

test.describe('F05 annulla, copia, mano, sottolineato', () => {
  async function addRect(page: Page) {
    await page.getByRole('radio', { name: 'Forma', exact: true }).click()
    await page.getByRole('radio', { name: 'Rettangolo', exact: true }).click()
    const p = await pagePoint(page, 1, 300, 400, A4)
    await page.mouse.click(p.x, p.y)
  }

  test('F05-H8 Annulla e Ripeti, dai pulsanti e da tastiera', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await expect(page.getByRole('button', { name: 'Annulla', exact: true })).toBeDisabled()
    await addRect(page)
    const [a] = await elements(page)
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowRight') // due pressioni ravvicinate = un solo passo
    expect((await elements(page))[0].x).toBeCloseTo(a.x + 20, 5)
    await page.keyboard.press('ControlOrMeta+z')
    expect((await elements(page))[0].x).toBeCloseTo(a.x, 5)
    await page.getByRole('button', { name: 'Annulla', exact: true }).click()
    expect(await elements(page)).toHaveLength(0)
    await page.getByRole('button', { name: 'Ripeti', exact: true }).click()
    expect(await elements(page)).toHaveLength(1)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    expect((await elements(page))[0].x).toBeCloseTo(a.x + 20, 5)
    await expect(page.getByRole('button', { name: 'Ripeti', exact: true })).toBeDisabled()
  })

  test('F05-H9 una parola scritta si annulla in un solo passo', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Testo', exact: true }).click()
    const p = await pagePoint(page, 1, 300, 400, A4)
    await page.mouse.click(p.x, p.y)
    await page.keyboard.type('Approvato')
    await page.keyboard.press('Escape')
    await page.keyboard.press('ControlOrMeta+z')
    expect((await elements(page))[0]?.text).not.toBe('Approvato')
    await page.keyboard.press('ControlOrMeta+z')
    expect(await elements(page)).toHaveLength(0)
  })

  test('F05-H10 copia e incolla duplicano l\'elemento accanto all\'originale', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await addRect(page)
    await page.getByRole('button', { name: /Rettangolo/ }).click()
    await page.keyboard.press('ControlOrMeta+c')
    await page.keyboard.press('ControlOrMeta+v')
    const [a, b] = await elements(page)
    expect(b.type).toBe('shape')
    expect(b.x - a.x).toBeCloseTo(12, 5)
    expect(b.y - a.y).toBeCloseTo(12, 5)
    expect(b.id).not.toBe(a.id)
  })

  test('F05-H11 con la mano si trascina il documento senza creare nulla', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Mano: trascina per scorrere', exact: true }).click()
    const main = page.getByRole('main', { name: 'Pagine del documento' })
    const before = await main.evaluate((m) => m.scrollTop)
    const box = (await main.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 50)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 10 })
    await page.mouse.up()
    expect(await main.evaluate((m) => m.scrollTop)).toBeGreaterThan(before + 200)
    expect(await elements(page)).toHaveLength(0)
  })

  test('F01-E10 il sottolineato del testo arriva nel PDF uguale', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Testo', exact: true }).click()
    await page.getByRole('button', { name: 'Sottolineato', exact: true }).click()
    const p = await pagePoint(page, 1, 300, 330, A4)
    await page.mouse.click(p.x, p.y)
    await page.keyboard.type('Sottolineato')
    await page.keyboard.press('Escape')
    expect((await elements(page))[0].underline).toBe(true)
    const { score } = await sameAfterExport(page, info)
    expect(score).toBeGreaterThanOrEqual(95)
  })
})
