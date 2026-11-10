import { test, expect, chooseFile, sample, pageFigure, a11y } from './helpers'
import { openSync, ftruncateSync, closeSync, writeSync } from 'node:fs'

test.describe('S01 apertura e errori', () => {
  test('S01 accessibilità della schermata iniziale', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Modifica un PDF' })).toBeVisible()
    expect(await a11y(page)).toEqual([])
  })

  test('S01-N1 un file che non è un PDF', async ({ page }) => {
    await page.goto('/')
    await chooseFile(page, 'Scegli un PDF', sample('non-sono-un-pdf.pdf'))
    await expect(page.getByRole('alert')).toContainText('Questo file non è un PDF')
    expect(await a11y(page)).toEqual([])
  })

  test('S01-N2 un PDF danneggiato', async ({ page }) => {
    await page.goto('/')
    await chooseFile(page, 'Scegli un PDF', sample('danneggiato.pdf'))
    await expect(page.getByRole('alert')).toContainText('Non riesco ad aprire questo PDF')
  })

  test('S01-N3 un file oltre i 100 MB', async ({ page }, info) => {
    const file = info.outputPath('enorme.pdf')
    const fd = openSync(file, 'w')
    writeSync(fd, '%PDF-1.7\n')
    ftruncateSync(fd, 101 * 1024 * 1024)
    closeSync(fd)
    await page.goto('/')
    await chooseFile(page, 'Scegli un PDF', file)
    await expect(page.getByRole('alert')).toContainText('Il file supera i 100 MB')
  })

  test('S01-E1 trascinare un PDF sul riquadro lo apre', async ({ page }) => {
    await page.goto('/')
    const dt = await page.evaluateHandle(async () => {
      const bytes = await (await fetch('/samples/documento.pdf')).arrayBuffer()
      const d = new DataTransfer()
      d.items.add(new File([bytes], 'trascinato.pdf', { type: 'application/pdf' }))
      return d
    })
    // il riquadro che contiene il pulsante (il suo testo cambia durante il trascinamento)
    const zone = page.getByRole('button', { name: 'Scegli un PDF' }).locator('..')
    await zone.dispatchEvent('dragover', { dataTransfer: dt })
    await expect(page.getByText('Rilascia qui il PDF')).toBeVisible()
    await zone.dispatchEvent('drop', { dataTransfer: dt })
    await expect(pageFigure(page, 1)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'trascinato.pdf' })).toBeVisible()
  })
})
