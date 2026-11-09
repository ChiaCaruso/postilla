import { useRef, useState } from 'react'
import { FileUp, Lock } from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'

/** Area di caricamento: il pulsante è sempre il modo principale, il trascinamento un'alternativa. */
export function Dropzone({ onFile, busy, forceDragging }: { onFile: (f: File) => void; busy?: boolean; forceDragging?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const dragging = over || forceDragging
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      className={cn(
        'flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-12 text-center transition-colors',
        dragging ? 'border-accent bg-accent-subtle' : 'border-border-input bg-surface',
      )}
    >
      <FileUp aria-hidden className={cn('size-10', dragging ? 'text-accent' : 'text-text-muted')} />
      <div className="flex flex-col gap-1">
        <p className="text-lg">{dragging ? 'Rilascia qui il PDF' : 'Apri un PDF da modificare'}</p>
        <p className="text-sm text-text-muted">Oppure trascinalo in questo riquadro. Fino a 100 MB.</p>
      </div>
      <Button size="lg" loading={busy} onClick={() => input.current?.click()}>
        {busy ? 'Apertura in corso…' : 'Scegli un PDF'}
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <Lock aria-hidden className="size-3.5" /> Il file resta sul tuo computer: non viene caricato da nessuna parte.
      </p>
    </div>
  )
}
