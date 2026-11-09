import { test, expect, openPdf, elements, saveAndDownload, pdfInfo, chooseFile, sample } from './helpers'
import { writeFileSync } from 'node:fs'

test.describe('F02 inserire un\'immagine', () => {
  test('F02-H1 il PNG entra centrato e finisce nel PDF', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    await chooseFile(page, 'Inserisci immagine', sample('timbro.png'))
    await expect(page.getByRole('button', { name: /Immagine/ })).toBeVisible()
    const [el] = await elements(page)
    const w = (el.w0 as number) * (el.scaleX as number)
    const h = (el.h0 as number) * (el.scaleY as number)
    expect(el.x + w / 2).toBeCloseTo(595.28 / 2, 0)
    expect(el.y + h / 2).toBeCloseTo(841.89 / 2, 0)
    expect(el.format).toBe('png')
    const file = await saveAndDownload(page, info)
    expect((await pdfInfo(file)).images).toBeGreaterThanOrEqual(1)
  })

  test('F02-E1 un WebP viene convertito e inserito', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas')
      c.width = 120
      c.height = 80
      const g = c.getContext('2d')!
      g.fillStyle = '#1d7148'
      g.fillRect(0, 0, 120, 80)
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/webp'))
      const buf = new Uint8Array(await blob.arrayBuffer())
      return btoa(String.fromCharCode(...buf))
    })
    const file = info.outputPath('verde.webp')
    writeFileSync(file, Buffer.from(b64, 'base64'))
    await chooseFile(page, 'Inserisci immagine', file)
    await expect(page.getByRole('button', { name: /Immagine/ })).toBeVisible()
    expect((await elements(page))[0].format).toBe('png')
    const out = await saveAndDownload(page, info)
    expect((await pdfInfo(out)).images).toBeGreaterThanOrEqual(1)
  })

  test('F02-E2 un\'immagine enorme viene ridotta a metà pagina', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas')
      c.width = 4000
      c.height = 3000
      const g = c.getContext('2d')!
      g.fillStyle = '#6b3fd4'
      g.fillRect(0, 0, 4000, 3000)
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.8))
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      return btoa(s)
    })
    const file = info.outputPath('grande.jpg')
    writeFileSync(file, Buffer.from(b64, 'base64'))
    await chooseFile(page, 'Inserisci immagine', file)
    await expect(page.getByRole('button', { name: /Immagine/ })).toBeVisible()
    const [el] = await elements(page)
    expect((el.w0 as number) * (el.scaleX as number)).toBeLessThanOrEqual(595.28 / 2 + 0.5)
    await saveAndDownload(page, info)
  })

  test('F02-N1 un file che non è un\'immagine dà un messaggio chiaro', async ({ page }, info) => {
    await openPdf(page, 'documento.pdf')
    const file = info.outputPath('finto.png')
    writeFileSync(file, 'non sono un\'immagine')
    await chooseFile(page, 'Inserisci immagine', file)
    await expect(page.getByRole('alert')).toContainText('immagine')
    expect(await elements(page)).toHaveLength(0)
  })
})
