import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { IconButton } from './IconButton'
import { cn, focusRing } from './cn'

export function ElementRow({ icon, title, page, selected, onSelect, onUp, onDown, onDelete }: {
  icon: ReactNode
  title: string
  page: number
  selected?: boolean
  onSelect: () => void
  onUp?: () => void
  onDown?: () => void
  onDelete: () => void
}) {
  return (
    <li className={cn('group flex items-center gap-1 rounded-sm border-l-2 pr-1', selected ? 'border-accent bg-accent-subtle' : 'border-transparent hover:bg-surface')}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={cn('flex min-w-0 grow items-center gap-2 rounded-sm px-2 py-2 text-left', focusRing)}
      >
        <span aria-hidden className={cn('[&_svg]:size-4', selected ? 'text-accent' : 'text-text-muted')}>{icon}</span>
        <span className="min-w-0 grow truncate text-sm">{title}</span>
        <span className="shrink-0 text-xs text-text-muted">p. {page}</span>
      </button>
      <IconButton size="sm" label="Porta avanti" icon={<ArrowUp />} disabled={!onUp} onClick={onUp} />
      <IconButton size="sm" label="Porta indietro" icon={<ArrowDown />} disabled={!onDown} onClick={onDown} />
      <IconButton size="sm" label="Elimina" icon={<Trash2 />} onClick={onDelete} />
    </li>
  )
}

export function ElementsPanel({ count, children, onRemoveAll }: { count: number; children: ReactNode; onRemoveAll: () => void }) {
  return (
    <aside aria-label="Elementi aggiunti" className="flex h-full w-(--layout-panel) flex-col border-l border-border bg-bg">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Elementi <span className="font-normal text-text-muted">({count})</span></h2>
        <button type="button" disabled={count === 0} onClick={onRemoveAll} className={cn('rounded-sm px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-subtle disabled:opacity-50', focusRing)}>
          Rimuovi tutti
        </button>
      </div>
      {count === 0 ? (
        <p className="px-4 text-sm text-text-muted">Niente da mostrare. Scegli uno strumento in alto e clicca su una pagina per aggiungere qualcosa.</p>
      ) : (
        <ul className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-2">{children}</ul>
      )}
    </aside>
  )
}
