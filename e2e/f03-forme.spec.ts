import { test, expect, openPdf, pagePoint, elements, saveAndDownload, pageFigure, setZoom, pixelMatch, chooseFile } from './helpers'

const A4 = 595.28

test.describe('F03 forme e penna', () => {
  test('F03-H1 rettangolo, ellisse e linea con un clic', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    const kinds = [
      ['Rettangolo', 'rect'],
      ['Ellisse', 'ellipse'],
      ['Linea', 'line'],
    ] as const
    for (const [i, [label]] of kinds.entries()) {
      await page.getByRole('radio', { name: 'Forma' }).click()
      await page.getByRole('radio', { name: label }).click()
      const p = await pagePoint(page, 1, 80 + i * 170, 400, A4)
      await page.mouse.click(p.x, p.y)
    }
    const els = await elements(page)
    expect(els.map((e) => e.shape)).toEqual(['rect', 'ellipse', 'line'])
    for (const label of ['Rettangolo', 'Ellisse', 'Linea']) await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible()
  })

  test('F03-H2 la penna crea un disegno', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Penna' }).click()
    const a = await pagePoint(page, 1, 100, 450, A4)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    for (let i = 1; i <= 15; i++) await page.mouse.move(a.x + i * 10 * a.k, a.y + Math.sin(i / 2) * 20 * a.k)
    await page.mouse.up()
    const [el] = await elements(page)
    expect(el.type).toBe('drawing')
    expect(el.w0 as number).toBeGreaterThan(100)
    await expect(page.getByRole('button', { name: /Disegno a mano/ })).toBeVisible()
  })

  test('F03-H3 il PDF esportato coincide con l\'editor su pagine difficili', async ({ page }, info) => {
    await openPdf(page, 'pagine-difficili.pdf')
    await setZoom(page, 75)
    await page.evaluate(() => {
      const st = (window as never as { __editor: { useStore: { getState: () => any } } }).__editor.useStore.getState()
      const c = document.createElement('canvas')
      c.width = 60
      c.height = 40
      const g = c.getContext('2d')!
      g.fillStyle = '#2f5bea'
      g.fillRect(0, 0, 60, 40)
      g.fillStyle = '#ffe066'
      g.fillRect(0, 0, 30, 20)
      g.fillRect(30, 20, 30, 20)
      const png = c.toDataURL('image/png')
      st.doc.pagine.forEach((_: unknown, i: number) => {
        st.addElement({ type: 'text', page: i, x: 40, y: 40, rotation: 0, opacity: 1, text: 'Prova è €', lines: ['Prova è €'], width: 200, font: 'NotoSans', size: 16, color: '#c02a2a', bold: true, italic: false, align: 'left' })
        st.addElement({ type: 'shape', page: i, x: 40, y: 90, rotation: 0, opacity: 1, shape: 'rect', w: 120, h: 60, fill: '#ffe066', stroke: '#14171c', strokeWidth: 3 })
        st.addElement({ type: 'shape', page: i, x: 190, y: 90, rotation: 30, opacity: 0.6, shape: 'ellipse', w: 100, h: 50, fill: null, stroke: '#1d7148', strokeWidth: 4 })
        st.addElement({ type: 'shape', page: i, x: 40, y: 180, rotation: 0, opacity: 1, shape: 'line', w: 200, h: 0, fill: null, stroke: '#6b3fd4', strokeWidth: 5 })
        st.addElement({ type: 'drawing', page: i, x: 260, y: 170, rotation: 0, opacity: 1, path: 'M 0 0 L 40 30 L 80 0 L 80 50', w0: 80, h0: 50, scaleX: 1.5, scaleY: 1, color: '#2f5bea', strokeWidth: 3 })
        st.addElement({ type: 'image', page: i, x: 40, y: 210, rotation: 15, opacity: 1, src: png, format: 'png', w0: 60, h0: 40, scaleX: 1.5, scaleY: 1.5 })
      })
      st.select(null)
    })
    const shots = async () => {
      const out: Buffer[] = []
      for (let n = 1; n <= 5; n++) {
        await pageFigure(page, n).scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)
        out.push(await pageFigure(page, n).locator('> div').screenshot())
      }
      return out
    }
    const before = await shots()
    const file = await saveAndDownload(page, info)
    await page.getByRole('button', { name: 'Chiudi ed elimina dalla memoria' }).click()
    await chooseFile(page, 'Scegli un PDF', file)
    await expect(pageFigure(page, 1)).toBeVisible()
    await setZoom(page, 75)
    const after = await shots()
    for (let i = 0; i < 5; i++) {
      const score = await pixelMatch(page, before[i], after[i])
      expect(score, `pagina ${i + 1}: ${score.toFixed(1)}% dei pixel disegnati coincide`).toBeGreaterThanOrEqual(95)
    }
  })

  test('F03-E1 non si possono togliere insieme bordo e riempimento (la forma sparirebbe)', async ({ page }) => {
    await openPdf(page, 'documento.pdf')
    await page.getByRole('radio', { name: 'Forma' }).click()
    await page.getByRole('radio', { name: 'Rettangolo' }).click()
    const p = await pagePoint(page, 1, 300, 300, A4)
    await page.mouse.click(p.x, p.y)
    const [el] = await elements(page)
    expect(el.fill).toBeNull() // per default la forma ha solo il bordo
    await page.getByRole('button', { name: /^Bordo:/ }).click()
    await expect(page.getByRole('radiogroup', { name: 'Bordo' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Nessuno' })).toHaveCount(0)
  })
})
