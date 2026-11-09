import * as D from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn, focusRing } from './cn'

export function Modal({ open, onOpenChange, title, description, children, footer }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-text/40" />
        <D.Content
          className="fixed left-1/2 top-1/2 z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-bg p-6 shadow-pop"
        >
          <div className="flex items-start justify-between gap-4">
            <D.Title className="text-lg">{title}</D.Title>
            <D.Close aria-label="Chiudi" className={cn('-mr-2 -mt-1 inline-flex size-8 items-center justify-center rounded-sm text-text-muted hover:bg-surface', focusRing)}>
              <X className="size-4" aria-hidden />
            </D.Close>
          </div>
          {description ? <D.Description className="text-sm text-text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          {children}
          {footer && <div className="flex justify-end gap-2">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
