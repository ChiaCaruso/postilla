import type { ReactNode } from 'react'

/** Una pagina del PDF sull'area grigia. Il contenuto reale (canvas pdf.js + Fabric) va dentro. */
export function PageFrame({ number, width, height, children }: { number: number; width: number; height: number; children?: ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="relative bg-page shadow-page" style={{ width, height }}>{children}</div>
      <figcaption className="text-xs text-text-muted">Pagina {number}</figcaption>
    </figure>
  )
}

/** Riquadro di selezione con maniglie: riferimento visivo per la configurazione di Fabric.js. */
export function SelectionPreview({ children }: { children: ReactNode }) {
  const handle = 'absolute size-(--layout-handle) border-[1.5px] border-selection bg-bg'
  return (
    <div className="relative inline-block border border-selection">
      {children}
      <span aria-hidden className={`${handle} -left-[5px] -top-[5px]`} />
      <span aria-hidden className={`${handle} -right-[5px] -top-[5px]`} />
      <span aria-hidden className={`${handle} -bottom-[5px] -left-[5px]`} />
      <span aria-hidden className={`${handle} -bottom-[5px] -right-[5px]`} />
      <span aria-hidden className="absolute -top-6 left-1/2 h-5 w-px -translate-x-1/2 bg-selection" />
      <span aria-hidden className={`${handle} -top-[30px] left-1/2 -translate-x-1/2 rounded-pill`} />
    </div>
  )
}
