import { useEffect, useRef } from 'react'
import { Download, FileText, PencilLine, Trash2 } from 'lucide-react'
import { Button } from './Button'
import { Banner } from './Banner'

export function DownloadCard({ fileName, size, pages, wasProtected, onDownload, onEditAgain, onClose }: {
  fileName: string
  size: string
  pages: number
  wasProtected?: boolean
  onDownload: () => void
  onEditAgain: () => void
  onClose: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <section className="flex w-full max-w-[520px] flex-col gap-6 rounded-lg border border-border bg-bg p-8 shadow-card">
      <h1 ref={heading} tabIndex={-1} className="text-xl outline-none">Il PDF è pronto</h1>
      <div className="flex items-center gap-3 rounded-md bg-surface p-3">
        <FileText aria-hidden className="size-8 text-text-muted" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{fileName}</p>
          <p className="text-xs text-text-muted">{size} · {pages} {pages === 1 ? 'pagina' : 'pagine'}</p>
        </div>
      </div>
      {wasProtected && (
        <Banner tone="warning" title="Il nuovo file non ha password">
          Il PDF originale era protetto. Se serve, proteggilo di nuovo prima di inviarlo.
        </Banner>
      )}
      <Button size="lg" icon={<Download className="size-5" aria-hidden />} onClick={onDownload}>Scarica il PDF</Button>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" icon={<PencilLine className="size-4" aria-hidden />} onClick={onEditAgain}>Modifica ancora</Button>
        <Button variant="danger-ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={onClose}>Chiudi ed elimina dalla memoria</Button>
      </div>
    </section>
  )
}
