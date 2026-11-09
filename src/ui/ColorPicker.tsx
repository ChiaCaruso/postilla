import * as P from '@radix-ui/react-popover'
import { cn, focusRing } from './cn'
import { Tooltip } from './Tooltip'
import tokens from '../../docs/design/tokens.json'

export interface Swatch { value: string; name: string }

/** Colori del contenuto del PDF (non dell'interfaccia): vengono da tokens.json → swatches. */
export const CONTENT_SWATCHES: Swatch[] = tokens.swatches.content
export const HIGHLIGHT_SWATCHES: Swatch[] = tokens.swatches.highlight

const dot = 'inline-block rounded-pill border border-border'

export function ColorPicker({ label, value, onChange, swatches = CONTENT_SWATCHES, allowNone }: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  swatches?: Swatch[]
  allowNone?: boolean
}) {
  const current = swatches.find((s) => s.value === value)?.name ?? (value === null ? 'Nessuno' : value)
  const options: Array<Swatch | { value: null; name: string }> = allowNone ? [{ value: null, name: 'Nessuno' }, ...swatches] : swatches
  return (
    <P.Root>
      <Tooltip label={label}>
        <P.Trigger
          aria-label={`${label}: ${current}`}
          className={cn('inline-flex size-8 items-center justify-center rounded-sm hover:bg-bg', focusRing)}
        >
          <span aria-hidden className={cn(dot, 'size-5', value === null && 'bg-[linear-gradient(135deg,transparent_45%,var(--color-danger)_45%,var(--color-danger)_55%,transparent_55%)]')} style={value ? { background: value } : undefined} />
        </P.Trigger>
      </Tooltip>
      <P.Portal>
        <P.Content sideOffset={6} className="z-50 rounded-md border border-border bg-bg p-3 shadow-pop">
          <p className="mb-2 text-xs text-text-muted">{label}</p>
          <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2">
            {options.map((s) => {
              const selected = s.value === value
              return (
                <button
                  key={s.name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={s.name}
                  title={s.name}
                  onClick={() => onChange(s.value)}
                  className={cn('inline-flex size-8 items-center justify-center rounded-pill', selected && 'ring-2 ring-accent ring-offset-1', focusRing)}
                >
                  <span aria-hidden className={cn(dot, 'size-6', s.value === null && 'bg-[linear-gradient(135deg,transparent_45%,var(--color-danger)_45%,var(--color-danger)_55%,transparent_55%)]')} style={s.value ? { background: s.value } : undefined} />
                </button>
              )
            })}
          </div>
          <P.Arrow className="fill-bg" />
        </P.Content>
      </P.Portal>
    </P.Root>
  )
}
