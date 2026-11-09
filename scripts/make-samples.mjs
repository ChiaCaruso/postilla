// Crea i PDF di prova in samples/ (dati di partenza per sviluppo, test e screenshot).
// Uso: node scripts/make-samples.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'
import { PDFDocument, StandardFonts, rgb, degrees, PageSizes } from '@cantoo/pdf-lib'

const dir = new URL('../samples/', import.meta.url)
mkdirSync(dir, { recursive: true })
const save = async (name, doc) => writeFileSync(new URL(name, dir), await doc.save())

const paragrafo = [
  'Verbale della riunione del 4 novembre 2026.',
  'Presenti: ufficio acquisti, amministrazione, direzione tecnica.',
  'Si approva il preventivo per la manutenzione degli impianti,',
  'con consegna prevista entro la fine del mese di dicembre.',
  'Le spese di trasporto sono a carico del fornitore.',
]

async function testo(doc, page, titolo) {
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const { height } = page.getSize()
  page.drawText(titolo, { x: 56, y: height - 80, size: 20, font: bold })
  paragrafo.forEach((riga, i) => page.drawText(riga, { x: 56, y: height - 120 - i * 18, size: 12, font }))
  page.drawRectangle({ x: 56, y: height - 260, width: 200, height: 40, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 1 })
  page.drawText('Firma', { x: 62, y: height - 252, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
}

// 1. Documento normale, 3 pagine A4
{
  const doc = await PDFDocument.create()
  for (let i = 1; i <= 3; i++) await testo(doc, doc.addPage(PageSizes.A4), `Documento di prova · pagina ${i}`)
  await save('documento.pdf', doc)
}

// 2. Pagine difficili: ruotate, formati misti, CropBox spostata
{
  const doc = await PDFDocument.create()
  const p1 = doc.addPage(PageSizes.A4); await testo(doc, p1, 'Pagina ruotata di 90°'); p1.setRotation(degrees(90))
  const p2 = doc.addPage([PageSizes.Letter[1], PageSizes.Letter[0]]); await testo(doc, p2, 'Letter orizzontale')
  const p3 = doc.addPage(PageSizes.A4); await testo(doc, p3, 'Pagina ruotata di 180°'); p3.setRotation(degrees(180))
  const p4 = doc.addPage(PageSizes.A4); await testo(doc, p4, 'Ritagliata (CropBox)'); p4.setCropBox(40, 300, 500, 520)
  const p5 = doc.addPage(PageSizes.A5); await testo(doc, p5, 'A5, ruotata di 270°'); p5.setRotation(degrees(270))
  await save('pagine-difficili.pdf', doc)
}

// 3. Protetto da password di apertura ("prova")
{
  const doc = await PDFDocument.create()
  await testo(doc, doc.addPage(PageSizes.A4), 'Documento protetto (password: prova)')
  doc.encrypt({ userPassword: 'prova', ownerPassword: 'proprietario' })
  await save('protetto-prova.pdf', doc)
}

// 4. Si apre senza password ma è cifrato (solo permessi)
{
  const doc = await PDFDocument.create()
  await testo(doc, doc.addPage(PageSizes.A4), 'Cifrato con soli permessi')
  doc.encrypt({ userPassword: '', ownerPassword: 'proprietario', permissions: { modifying: false } })
  await save('solo-permessi.pdf', doc)
}

// 5. "Scansione": solo grafica, nessun testo selezionabile
{
  const doc = await PDFDocument.create()
  const page = doc.addPage(PageSizes.A4)
  for (let i = 0; i < 30; i++) page.drawRectangle({ x: 56, y: 760 - i * 22, width: 200 + ((i * 37) % 280), height: 8, color: rgb(0.55, 0.55, 0.55) })
  await save('scansione.pdf', doc)
}

// 6. Non è un PDF
writeFileSync(new URL('non-sono-un-pdf.pdf', dir), 'Questo è un file di testo con estensione .pdf\n')

// 7. Immagine PNG di prova (timbro 160×100 a quadri), scritta senza librerie
{
  const w = 160, h = 100
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const i = y * (w * 4 + 1) + 1 + x * 4
      const on = ((x >> 4) + (y >> 4)) % 2 === 0
      raw.set(on ? [192, 42, 42, 255] : [255, 224, 102, 200], i)
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8)
  writeFileSync(new URL('timbro.png', dir), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}

console.log('PDF di prova creati in samples/')
