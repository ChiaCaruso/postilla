// Costanti di impaginazione del testo dell'editor (Fabric.js 7), riprodotte nell'export.
// Se si aggiorna Fabric, verificare che non siano cambiate (test: npm test).
export const TEXT_METRICS = {
  /** Altezza della riga rispetto alla dimensione del font, prima dell'interlinea. */
  sizeMult: 1.13,
  /** Interlinea dei Textbox. */
  lineHeight: 1.16,
  /** Quota della riga sotto la linea di base. */
  baselineFraction: 0.222,
}

/**
 * Scala un tracciato composto solo da comandi assoluti con coppie di coordinate (M, L, Q, C),
 * come quelli prodotti dal disegno a mano libera. Scalare i numeri invece del sistema di
 * coordinate mantiene uniforme lo spessore della linea.
 */
export function scalePath(d: string, sx: number, sy: number): string {
  if (sx === 1 && sy === 1) return d
  let i = 0
  return d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (n) => {
    const v = parseFloat(n) * (i++ % 2 === 0 ? sx : sy)
    return String(Math.round(v * 1000) / 1000)
  })
}
