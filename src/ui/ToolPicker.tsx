import * as TG from '@radix-ui/react-toggle-group'
import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import { iconButtonClass } from './IconButton'

export interface Tool<T extends string> {
  value: T
  label: string
  icon: ReactNode
  shortcut?: string
  disabledReason?: string
}

/** Gruppo di strumenti esclusivi: uno solo attivo, frecce per spostarsi. */
export function ToolPicker<T extends string>({ tools, value, onChange, onActivate, label }: {
  tools: Tool<T>[]
  value: T
  onChange: (v: T) => void
  /**
   * Chiamata a ogni attivazione; viaKeyboard = premuto con Invio o Spazio.
   * Se restituisce true l'azione è già stata gestita e lo strumento attivo non cambia.
   */
  onActivate?: (v: T, viaKeyboard: boolean) => boolean | void
  label: string
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className="flex items-center gap-1"
    >
      {tools.map((t) => (
        <Tooltip key={t.value} label={t.disabledReason ?? t.label} shortcut={t.disabledReason ? undefined : t.shortcut}>
          {/* span: il tooltip resta raggiungibile anche quando lo strumento è disabilitato */}
          <span tabIndex={t.disabledReason ? 0 : -1} className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-accent">
            <TG.Item value={t.value} aria-label={t.label} disabled={!!t.disabledReason} className={iconButtonClass('md')} onClick={(e) => {
                if (onActivate?.(t.value, e.detail === 0) === true) e.preventDefault()
              }}>
              {t.icon}
            </TG.Item>
          </span>
        </Tooltip>
      ))}
    </TG.Root>
  )
}

export function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="toolbar" aria-label={label} className="flex h-(--layout-toolbar) items-center gap-2 border-b border-border bg-bg px-3">
      {children}
    </div>
  )
}

export const ToolbarSeparator = () => <div role="separator" aria-orientation="vertical" className="mx-1 h-6 w-px bg-border" />
