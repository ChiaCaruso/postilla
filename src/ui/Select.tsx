import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn, focusRing } from './cn'

export function Select({ label, hideLabel, options, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hideLabel?: boolean
  options: Array<{ value: string; label: string }>
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-xs text-text-muted'}>{label}</label>
      <div className="relative">
        <select
          id={id}
          {...rest}
          className={cn(
            'h-8 appearance-none rounded-sm border border-border-input bg-bg pl-2 pr-7 text-sm text-text hover:bg-surface disabled:opacity-50',
            focusRing,
            className,
          )}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
      </div>
    </div>
  )
}
