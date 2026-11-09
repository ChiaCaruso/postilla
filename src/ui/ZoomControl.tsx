import { Minus, Plus, MoveHorizontal } from 'lucide-react'
import { IconButton } from './IconButton'

export const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200, 300, 400]

export function ZoomControl({ value, onChange, onFitWidth }: { value: number; onChange: (v: number) => void; onFitWidth: () => void }) {
  const lower = [...ZOOM_STEPS].reverse().find((s) => s < value)
  const higher = ZOOM_STEPS.find((s) => s > value)
  return (
    <div role="group" aria-label="Zoom" className="flex items-center gap-0.5">
      <IconButton size="sm" label="Riduci" shortcut="Ctrl −" icon={<Minus />} disabled={!lower} onClick={() => lower && onChange(lower)} />
      <span aria-live="polite" className="w-12 text-center text-sm tabular-nums">{value}%</span>
      <IconButton size="sm" label="Ingrandisci" shortcut="Ctrl +" icon={<Plus />} disabled={!higher} onClick={() => higher && onChange(higher)} />
      <IconButton size="sm" label="Adatta alla larghezza" icon={<MoveHorizontal />} onClick={onFitWidth} />
    </div>
  )
}
