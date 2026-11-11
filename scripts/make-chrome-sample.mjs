// Crea samples/stampato-da-chrome.pdf: un documento "stampato" da Chrome (font incorporati,
// codifica a due byte), simile ai PDF prodotti da molti programmi d'ufficio.
// Uso: node scripts/make-chrome-sample.mjs   (serve Chromium di Playwright)
import { chromium } from '@playwright/test'

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><style>
  body { font-family: Georgia, serif; margin: 48px; color: #1a1a1a; }
  h1 { font-family: Helvetica, Arial, sans-serif; font-size: 22px; }
  .riquadro { background: #fff3c4; padding: 8px 12px; }
  .importo { color: #b00020; font-weight: bold; }
  td { padding: 4px 12px; border-bottom: 1px solid #ccc; font-family: Helvetica, Arial, sans-serif; }
</style></head><body>
  <h1>Offerta n. 42/2026</h1>
  <p>Gentile cliente, le confermiamo la fornitura descritta qui sotto.</p>
  <p class="riquadro">Totale da pagare: <span class="importo">1.250,00 €</span> entro il 30 novembre.</p>
  <table><tr><td>Manutenzione impianti</td><td>800,00 €</td></tr><tr><td>Trasporto</td><td>450,00 €</td></tr></table>
  <p><i>Cordiali saluti, l'ufficio acquisti.</i></p>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html)
await page.pdf({ path: new URL('../samples/stampato-da-chrome.pdf', import.meta.url).pathname, format: 'A4', printBackground: true })
await browser.close()
console.log('samples/stampato-da-chrome.pdf creato')
