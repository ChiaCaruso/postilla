import * as S from '@radix-ui/react-slider'
import { useId } from 'react'

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, unit = '', disabled, width = 'w-28' }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  width?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <span id={id} className="text-xs text-text-muted">{label}</span>
      <S.Root
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`relative flex h-5 touch-none select-none items-center data-[disabled]:opacity-50 ${width}`}
      >
        <S.Track className="relative h-1 grow rounded-pill bg-border">
          <S.Range className="absolute h-full rounded-pill bg-accent" />
        </S.Track>
        <S.Thumb
          aria-labelledby={id}
          aria-valuetext={`${value}${unit}`}
          className="block size-4 rounded-pill border-2 border-accent bg-bg shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </S.Root>
      <span aria-hidden className="w-10 text-right text-xs tabular-nums text-text">{value}{unit}</span>
    </div>
  )
}
