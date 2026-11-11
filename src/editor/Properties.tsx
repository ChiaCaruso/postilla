import { useEffect, useRef } from 'react'
// Barra delle proprietà: mostra le proprietà dell'elemento selezionato,
// oppure quelle che avranno i nuovi elementi dello strumento attivo.
import * as TG from '@radix-ui/react-toggle-group'
import { AlignCenter, AlignLeft, AlignRight, Bold, Circle, Highlighter, Italic, Minus, Square, Strikethrough, Trash2, Underline, Waves } from 'lucide-react'
import { PropertyBar, PropertyGroup } from '../ui/PropertyBar'
import { Select } from '../ui/Select'
import { ColorPicker, HIGHLIGHT_SWATCHES } from '../ui/ColorPicker'
import { Slider } from '../ui/Slider'
import { IconButton, iconButtonClass } from '../ui/IconButton'
import { Tooltip } from '../ui/Tooltip'
import { FONT_FAMILIES, loadFontFace } from '../pdf/fonts'
import { selectedElement, useStore, type AnnotationStyle, type ShapeKind, type Style } from '../store'
import type { Element, FontFamily } from '../model'

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72]

function TextControls({ v, onChange }: { v: Pick<Style, 'font' | 'size' | 'color' | 'bold' | 'italic' | 'underline' | 'align'>; onChange: (p: Partial<Style>) => void }) {
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
        <IconButton size="sm" label="Sottolineato" icon={<Underline />} pressed={v.underline} onClick={() => onChange({ underline: !v.underline })} />
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
      {/* "Nessuno" solo se resta l'altro: senza bordo né riempimento la forma diventerebbe invisibile. */}
      {!line && <ColorPicker label="Riempimento" value={fill} onChange={(c) => onChange({ fill: c })} allowNone={stroke !== null} />}
      <ColorPicker label={line ? 'Colore' : 'Bordo'} value={stroke} onChange={(c) => onChange({ stroke: c ?? (line ? stroke : null) })} allowNone={!line && fill !== null} />
      <Slider label="Spessore" value={strokeWidth} onChange={(n) => onChange({ strokeWidth: n })} min={1} max={20} unit=" pt" disabled={!stroke} />
    </PropertyGroup>
  )
}

const ANNOTATIONS: Array<{ value: AnnotationStyle; label: string; icon: React.ReactNode }> = [
  { value: 'highlight', label: 'Evidenzia', icon: <Highlighter /> },
  { value: 'underline', label: 'Sottolinea', icon: <Underline /> },
  { value: 'strike', label: 'Barra', icon: <Strikethrough /> },
  { value: 'squiggly', label: 'Sottolinea con onda', icon: <Waves /> },
]

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
        {el.type === 'drawing' && !el.highlighter && (
          <PropertyGroup>
            <ColorPicker label="Colore" value={el.color} onChange={(c) => c && edit({ color: c }, { drawColor: c })} />
            <Slider label="Spessore" value={el.strokeWidth} onChange={(n) => edit({ strokeWidth: n }, { drawWidth: n })} min={1} max={20} unit=" pt" />
          </PropertyGroup>
        )}
        {el.type === 'drawing' && el.highlighter && (
          <PropertyGroup>
            <ColorPicker label="Colore dell'evidenziatore" value={el.color} swatches={HIGHLIGHT_SWATCHES} onChange={(c) => c && edit({ color: c }, { markerColor: c })} />
            <Slider label="Spessore" value={el.strokeWidth} onChange={(n) => edit({ strokeWidth: n }, { markerWidth: n })} min={4} max={40} unit=" pt" />
          </PropertyGroup>
        )}
        {el.type === 'comment' && (
          <PropertyGroup>
            <CommentField id={el.id} value={el.text} onChange={(t) => updateElement(el.id, { text: t })} />
            <ColorPicker label="Colore dell'icona" value={el.color} swatches={HIGHLIGHT_SWATCHES} onChange={(c) => c && edit({ color: c }, { commentColor: c })} />
          </PropertyGroup>
        )}
        {el.type === 'annotation' && (
          <PropertyGroup>
            <ColorPicker
              label="Colore"
              value={el.color}
              swatches={el.style === 'highlight' ? HIGHLIGHT_SWATCHES : undefined}
              onChange={(c) => c && edit({ color: c }, el.style === 'highlight' ? { highlightColor: c } : { lineColor: c })}
            />
          </PropertyGroup>
        )}
        {el.type === 'erase' && <Hint>Il testo originale di questa riga viene tolto dal PDF. Elimina questo elemento per riaverlo.</Hint>}
        {/* commento e testo tolto non hanno un'opacità che abbia senso cambiare */}
        {el.type !== 'comment' && el.type !== 'erase' && <OpacityControl value={el.opacity} onChange={(o) => edit({ opacity: o }, {})} />}
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
  if (tool === 'marker') {
    return (
      <PropertyBar>
        <PropertyGroup>
          <ColorPicker label="Colore dell'evidenziatore" value={style.markerColor} swatches={HIGHLIGHT_SWATCHES} onChange={(c) => c && setStyle({ markerColor: c })} />
          <Slider label="Spessore" value={style.markerWidth} onChange={(n) => setStyle({ markerWidth: n })} min={4} max={40} unit=" pt" />
        </PropertyGroup>
        <Hint>Passa sopra il testo come con un evidenziatore: il testo resta leggibile.</Hint>
      </PropertyBar>
    )
  }
  if (tool === 'annotate') {
    const highlight = style.annotStyle === 'highlight'
    return (
      <PropertyBar>
        <PropertyGroup>
          <TG.Root type="single" value={style.annotStyle} onValueChange={(v) => v && setStyle({ annotStyle: v as AnnotationStyle })} aria-label="Tipo di annotazione" className="flex gap-1">
            {ANNOTATIONS.map((a) => (
              <Tooltip key={a.value} label={a.label}>
                <TG.Item value={a.value} aria-label={a.label} className={iconButtonClass('sm')}>{a.icon}</TG.Item>
              </Tooltip>
            ))}
          </TG.Root>
          <ColorPicker
            label="Colore"
            value={highlight ? style.highlightColor : style.lineColor}
            swatches={highlight ? HIGHLIGHT_SWATCHES : undefined}
            onChange={(c) => c && setStyle(highlight ? { highlightColor: c } : { lineColor: c })}
          />
        </PropertyGroup>
        <Hint>Trascina sopra il testo, oppure clicca su una parola.</Hint>
      </PropertyBar>
    )
  }
  if (tool === 'comment') {
    return (
      <PropertyBar>
        <PropertyGroup>
          <ColorPicker label="Colore dell'icona" value={style.commentColor} swatches={HIGHLIGHT_SWATCHES} onChange={(c) => c && setStyle({ commentColor: c })} />
        </PropertyGroup>
        <Hint>Clicca sulla pagina dove vuoi lasciare il commento, poi scrivilo qui.</Hint>
      </PropertyBar>
    )
  }
  if (tool === 'edittext') {
    return (
      <PropertyBar>
        <Hint>Clicca su una riga del PDF: si apre in modifica al suo posto, e al salvataggio il testo vecchio viene tolto dal file.</Hint>
      </PropertyBar>
    )
  }
  if (tool === 'hand') {
    return (
      <PropertyBar>
        <Hint>Trascina il documento per spostarti tra le pagine.</Hint>
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

/** Testo del commento: si scrive qui. Un commento nuovo (vuoto) riceve subito il focus. */
function CommentField({ id, value, onChange }: { id: string; value: string; onChange: (t: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const isNew = value === ''
  // Il focus si dà dopo il clic che ha creato il commento: durante il clic il browser lo sposterebbe di nuovo.
  useEffect(() => {
    if (!isNew) return
    const t = setTimeout(() => input.current?.focus(), 0)
    return () => clearTimeout(t)
    // solo quando cambia il commento selezionato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-text-muted">Commento</span>
      <input
        ref={input}
        key={id}
        type="text"
        value={value}
        placeholder="Scrivi il commento…"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="h-8 w-[min(360px,50vw)] rounded-sm border border-border-input bg-bg px-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  )
}

const Hint = ({ children }: { children: React.ReactNode }) => <p className="truncate px-1 text-xs text-text-muted">{children}</p>
