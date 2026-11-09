// Barra delle proprietà: mostra le proprietà dell'elemento selezionato,
// oppure quelle che avranno i nuovi elementi dello strumento attivo.
import * as TG from '@radix-ui/react-toggle-group'
import { AlignCenter, AlignLeft, AlignRight, Bold, Circle, Italic, Minus, Square, Trash2 } from 'lucide-react'
import { PropertyBar, PropertyGroup } from '../ui/PropertyBar'
import { Select } from '../ui/Select'
import { ColorPicker } from '../ui/ColorPicker'
import { Slider } from '../ui/Slider'
import { IconButton, iconButtonClass } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import { FONT_FAMILIES, loadFontFace } from '../pdf/fonts'
import { selectedElement, useStore, type ShapeKind, type Style } from '../store'
import type { Element, FontFamily } from '../model'

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72]

function TextControls({ v, onChange }: { v: Pick<Style, 'font' | 'size' | 'color' | 'bold' | 'italic' | 'align'>; onChange: (p: Partial<Style>) => void }) {
  const sizes = SIZES.includes(v.size) ? SIZES : [...SIZES, v.size].sort((a, b) => a - b)
  const withFont = async (p: Partial<Style>) => {
    const next = { ...v, ...p }
    await loadFontFace(next.font, next.bold, next.italic)
    onChange(p)
  }
  return (
    <>
      <PropertyGroup>
        <Select label="Font" hideLabel value={v.font} onChange={(e) => void withFont({ font: e.target.value as FontFamily })} options={FONT_FAMILIES} />
        <Select label="Dimensione" hideLabel value={String(v.size)} onChange={(e) => onChange({ size: Number(e.target.value) })} options={sizes.map((n) => ({ value: String(n), label: `${n} pt` }))} />
        <ColorPicker label="Colore del testo" value={v.color} onChange={(c) => c && onChange({ color: c })} />
      </PropertyGroup>
      <PropertyGroup>
        <IconButton size="sm" label="Grassetto" icon={<Bold />} pressed={v.bold} onClick={() => void withFont({ bold: !v.bold })} />
        <IconButton size="sm" label="Corsivo" icon={<Italic />} pressed={v.italic} disabled={v.font === 'NotoSansMono'} onClick={() => void withFont({ italic: !v.italic })} />
      </PropertyGroup>
      <PropertyGroup>
        <IconButton size="sm" label="Allinea a sinistra" icon={<AlignLeft />} pressed={v.align === 'left'} onClick={() => onChange({ align: 'left' })} />
        <IconButton size="sm" label="Centra" icon={<AlignCenter />} pressed={v.align === 'center'} onClick={() => onChange({ align: 'center' })} />
        <IconButton size="sm" label="Allinea a destra" icon={<AlignRight />} pressed={v.align === 'right'} onClick={() => onChange({ align: 'right' })} />
      </PropertyGroup>
    </>
  )
}

const SHAPES: Array<{ value: ShapeKind; label: string; icon: React.ReactNode }> = [
  { value: 'rect', label: 'Rettangolo', icon: <Square /> },
  { value: 'ellipse', label: 'Ellisse', icon: <Circle /> },
  { value: 'line', label: 'Linea', icon: <Minus /> },
]

function ShapeControls({ shape, fill, stroke, strokeWidth, onChange }: {
  shape: ShapeKind
  fill: string | null
  stroke: string | null
  strokeWidth: number
  onChange: (p: Partial<Style>) => void
}) {
  const line = shape === 'line'
  return (
    <PropertyGroup>
      {!line && <ColorPicker label="Riempimento" value={fill} onChange={(c) => onChange({ fill: c })} allowNone />}
      <ColorPicker label={line ? 'Colore' : 'Bordo'} value={stroke} onChange={(c) => onChange({ stroke: c ?? (line ? stroke : null) })} allowNone={!line} />
      <Slider label="Spessore" value={strokeWidth} onChange={(n) => onChange({ strokeWidth: n })} min={1} max={20} unit=" pt" disabled={!stroke} />
    </PropertyGroup>
  )
}

function OpacityControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <PropertyGroup>
      <Slider label="Opacità" value={Math.round(value * 100)} onChange={(n) => onChange(n / 100)} min={10} max={100} unit="%" />
    </PropertyGroup>
  )
}

export function Properties() {
  const el = useStore(selectedElement)
  const tool = useStore((s) => s.tool)
  const style = useStore((s) => s.style)
  const setStyle = useStore((s) => s.setStyle)
  const updateElement = useStore((s) => s.updateElement)
  const removeElement = useStore((s) => s.removeElement)

  /** Modifica l'elemento e ricorda la scelta per i prossimi. */
  const edit = (patch: Partial<Element>, stylePatch: Partial<Style> = patch as Partial<Style>) => {
    if (el) updateElement(el.id, patch)
    setStyle(stylePatch)
  }

  if (el) {
    return (
      <PropertyBar>
        {el.type === 'text' && <TextControls v={el} onChange={(p) => edit(p)} />}
        {el.type === 'shape' && (
          <ShapeControls shape={el.shape} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} onChange={(p) => edit(p)} />
        )}
        {el.type === 'drawing' && (
          <PropertyGroup>
            <ColorPicker label="Colore" value={el.color} onChange={(c) => c && edit({ color: c }, { drawColor: c })} />
            <Slider label="Spessore" value={el.strokeWidth} onChange={(n) => edit({ strokeWidth: n }, { drawWidth: n })} min={1} max={20} unit=" pt" />
          </PropertyGroup>
        )}
        <OpacityControl value={el.opacity} onChange={(o) => edit({ opacity: o }, {})} />
        <PropertyGroup>
          <IconButton size="sm" label="Elimina elemento" shortcut="Canc" icon={<Trash2 />} onClick={() => removeElement(el.id)} />
        </PropertyGroup>
      </PropertyBar>
    )
  }

  if (tool === 'text') {
    return (
      <PropertyBar>
        <TextControls v={style} onChange={setStyle} />
        <Hint>Clicca sulla pagina nel punto in cui vuoi scrivere.</Hint>
      </PropertyBar>
    )
  }
  if (tool === 'shape') {
    return (
      <PropertyBar>
        <PropertyGroup>
          <TG.Root type="single" value={style.shape} onValueChange={(v) => v && setStyle({ shape: v as ShapeKind })} aria-label="Tipo di forma" className="flex gap-1">
            {SHAPES.map((s) => (
              <Tooltip key={s.value} label={s.label}>
                <TG.Item value={s.value} aria-label={s.label} className={iconButtonClass('sm')}>{s.icon}</TG.Item>
              </Tooltip>
            ))}
          </TG.Root>
        </PropertyGroup>
        <ShapeControls shape={style.shape} fill={style.fill} stroke={style.stroke} strokeWidth={style.strokeWidth} onChange={setStyle} />
        <Hint>Clicca sulla pagina per inserire la forma.</Hint>
      </PropertyBar>
    )
  }
  if (tool === 'draw') {
    return (
      <PropertyBar>
        <PropertyGroup>
          <ColorPicker label="Colore della penna" value={style.drawColor} onChange={(c) => c && setStyle({ drawColor: c })} />
          <Slider label="Spessore" value={style.drawWidth} onChange={(n) => setStyle({ drawWidth: n })} min={1} max={20} unit=" pt" />
        </PropertyGroup>
        <Hint>Tieni premuto e trascina sulla pagina per disegnare.</Hint>
      </PropertyBar>
    )
  }
  return (
    <PropertyBar>
      <Hint>Seleziona un elemento per modificarlo, oppure scegli uno strumento.</Hint>
    </PropertyBar>
  )
}

const Hint = ({ children }: { children: React.ReactNode }) => <p className="truncate px-1 text-xs text-text-muted">{children}</p>
