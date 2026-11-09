import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn, focusRing } from './cn'

type Tone = 'info' | 'warning' | 'danger' | 'success'
const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-surface border-border text-text', icon: <Info className="text-text-muted" /> },
  warning: { box: 'bg-warning-subtle border-warning/40 text-text', icon: <TriangleAlert className="text-warning" /> },
  danger: { box: 'bg-danger-subtle border-danger/40 text-text', icon: <CircleAlert className="text-danger" /> },
  success: { box: 'bg-surface border-success/40 text-text', icon: <CircleCheck className="text-success" /> },
}

export function Banner({ tone = 'info', title, children, action, onDismiss }: {
  tone?: Tone
  title: string
  children?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
}) {
  const t = tones[tone]
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border p-3', t.box)}>
      <span aria-hidden className="mt-0.5 [&_svg]:size-5">{t.icon}</span>
      <div className="flex min-w-0 grow flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="text-sm text-text-muted">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Chiudi avviso" className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-bg', focusRing)}>
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
