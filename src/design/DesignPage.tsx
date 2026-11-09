// Pagina di prova del design system: ogni componente in tutti i suoi stati.
// Solo per sviluppo (npm run dev → /design.html), non entra nella build di produzione.
import { useState, type ReactNode } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Brush, Highlighter, ImagePlus, Italic, MousePointer2,
  Redo2, Shapes, Square, Type, Underline, Undo2, Download, Trash2,
} from 'lucide-react'
import { TooltipProvider } from '../ui/Tooltip'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Toolbar, ToolbarSeparator, ToolPicker, type Tool } from '../ui/ToolPicker'
import { PropertyBar, PropertyGroup } from '../ui/PropertyBar'
import { Slider } from '../ui/Slider'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { ColorPicker, HIGHLIGHT_SWATCHES } from '../ui/ColorPicker'
import { Dropzone } from '../ui/Dropzone'
import { ProgressBar } from '../ui/ProgressBar'
import { Banner } from '../ui/Banner'
import { Modal } from '../ui/Modal'
import { ElementRow, ElementsPanel } from '../ui/ElementRow'
import { ZoomControl } from '../ui/ZoomControl'
import { DownloadCard } from '../ui/DownloadCard'
import { PageFrame, SelectionPreview } from '../ui/PageFrame'
import tokens from '../../docs/design/tokens.json'

type ToolId = 'select' | 'text' | 'image' | 'shape' | 'draw' | 'highlight'
const TOOLS: Tool<ToolId>[] = [
  { value: 'select', label: 'Seleziona', icon: <MousePointer2 />, shortcut: 'V' },
  { value: 'text', label: 'Testo', icon: <Type />, shortcut: 'T' },
  { value: 'image', label: 'Immagine', icon: <ImagePlus />, shortcut: 'I' },
  { value: 'shape', label: 'Forma', icon: <Shapes />, shortcut: 'R' },
  { value: 'draw', label: 'Disegno a mano libera', icon: <Brush />, shortcut: 'P' },
  { value: 'highlight', label: 'Evidenzia', icon: <Highlighter />, disabledReason: 'Questo PDF non contiene testo selezionabile' },
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 border-t border-border py-8">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  )
}

export function DesignPage() {
  const [tool, setTool] = useState<ToolId>('text')
  const [opacity, setOpacity] = useState(100)
  const [stroke, setStroke] = useState(2)
  const [color, setColor] = useState<string | null>('#14171c')
  const [fill, setFill] = useState<string | null>(null)
  const [hl, setHl] = useState<string | null>('#ffe066')
  const [zoom, setZoom] = useState(100)
  const [bold, setBold] = useState(true)
  const [align, setAlign] = useState<'l' | 'c' | 'r'>('l')
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(0)

  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-[1200px] flex-col px-6 py-10">
        <h1 className="text-display">Componenti</h1>
        <p className="mt-2 max-w-[640px] text-base text-text-muted">
          Tutti i componenti dell'editor PDF nei loro stati, costruiti solo con i token di <code className="font-mono text-sm">docs/design/tokens.json</code>.
        </p>

        <Section id="colori" title="Colori (ruoli)">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(tokens.color).map(([name, value]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className="h-12 rounded-md border border-border" style={{ background: value }} />
                <p className="text-xs font-semibold">{name}</p>
                <p className="font-mono text-xs text-text-muted">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="tipografia" title="Tipografia">
          {([['display', 'text-display'], ['xl', 'text-xl'], ['lg', 'text-lg'], ['base', 'text-base'], ['sm', 'text-sm'], ['xs', 'text-xs']] as const).map(([k, cls]) => (
            <p key={k} className={cls}>
              <span className="mr-4 inline-block w-20 font-mono text-xs text-text-muted">{k} {tokens.type[k].size}/{tokens.type[k].line}</span>
              Fattura n. 128 · è già firmata?
            </p>
          ))}
        </Section>

        <Section id="pulsanti" title="Button">
          {(['primary', 'secondary', 'ghost', 'danger', 'danger-ghost'] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-24 font-mono text-xs text-text-muted">{v}</span>
              <Button variant={v} size="sm">Piccolo</Button>
              <Button variant={v}>Medio</Button>
              <Button variant={v} size="lg">Grande</Button>
              <Button variant={v} disabled>Disabilitato</Button>
              <Button variant={v} loading>In corso</Button>
            </div>
          ))}
        </Section>

        <Section id="editor" title="Toolbar, PropertyBar, ZoomControl">
          <div className="overflow-hidden rounded-md border border-border">
            <Toolbar label="Strumenti">
              <ToolPicker label="Strumento attivo" tools={TOOLS} value={tool} onChange={setTool} />
              <ToolbarSeparator />
              <IconButton label="Annulla" shortcut="Ctrl Z" icon={<Undo2 />} />
              <IconButton label="Ripeti" shortcut="Ctrl Maiusc Z" icon={<Redo2 />} disabled />
              <div className="grow" />
              <ZoomControl value={zoom} onChange={setZoom} onFitWidth={() => setZoom(125)} />
              <ToolbarSeparator />
              <Button size="sm" icon={<Download className="size-4" aria-hidden />}>Salva il PDF</Button>
            </Toolbar>
            <PropertyBar>
              <PropertyGroup>
                <Select label="Font" hideLabel defaultValue="NotoSans" options={[
                  { value: 'NotoSans', label: 'Noto Sans' },
                  { value: 'NotoSerif', label: 'Noto Serif' },
                  { value: 'NotoSansMono', label: 'Noto Sans Mono' },
                  { value: 'Inter', label: 'Inter' },
                ]} />
                <Select label="Dimensione" hideLabel defaultValue="12" options={[8, 9, 10, 11, 12, 14, 16, 18, 24, 32, 48].map((n) => ({ value: String(n), label: `${n} pt` }))} />
                <ColorPicker label="Colore del testo" value={color} onChange={setColor} />
              </PropertyGroup>
              <PropertyGroup>
                <IconButton size="sm" label="Grassetto" shortcut="Ctrl B" icon={<Bold />} pressed={bold} onClick={() => setBold(!bold)} />
                <IconButton size="sm" label="Corsivo" shortcut="Ctrl I" icon={<Italic />} pressed={false} />
                <IconButton size="sm" label="Sottolineato" shortcut="Ctrl U" icon={<Underline />} pressed={false} />
              </PropertyGroup>
              <PropertyGroup>
                <IconButton size="sm" label="Allinea a sinistra" icon={<AlignLeft />} pressed={align === 'l'} onClick={() => setAlign('l')} />
                <IconButton size="sm" label="Centra" icon={<AlignCenter />} pressed={align === 'c'} onClick={() => setAlign('c')} />
                <IconButton size="sm" label="Allinea a destra" icon={<AlignRight />} pressed={align === 'r'} onClick={() => setAlign('r')} />
              </PropertyGroup>
              <PropertyGroup>
                <Slider label="Trasparenza" value={opacity} onChange={setOpacity} unit="%" />
              </PropertyGroup>
              <PropertyGroup>
                <IconButton size="sm" label="Elimina" shortcut="Canc" icon={<Trash2 />} />
              </PropertyGroup>
            </PropertyBar>
            <PropertyBar>
              <PropertyGroup>
                <ColorPicker label="Riempimento" value={fill} onChange={setFill} allowNone />
                <ColorPicker label="Bordo" value={color} onChange={setColor} allowNone />
                <Slider label="Spessore" value={stroke} onChange={setStroke} min={1} max={20} unit=" pt" />
              </PropertyGroup>
              <PropertyGroup>
                <ColorPicker label="Colore evidenziatore" value={hl} onChange={setHl} swatches={HIGHLIGHT_SWATCHES} />
              </PropertyGroup>
            </PropertyBar>
          </div>
        </Section>

        <Section id="pagina" title="PageFrame, selezione, pannello Elementi">
          <div className="flex h-[520px] overflow-hidden rounded-md border border-border">
            <div className="flex grow justify-center overflow-auto bg-canvas p-6">
              <PageFrame number={1} width={340} height={440}>
                <div className="absolute left-8 top-10 h-2 w-40 rounded-pill bg-border" />
                <div className="absolute left-8 top-16 h-2 w-64 rounded-pill bg-border" />
                <div className="absolute left-8 top-20 h-2 w-56 rounded-pill bg-border" />
                <div className="absolute left-10 top-32">
                  <SelectionPreview>
                    <p className="px-1 text-base font-semibold" style={{ color: color ?? undefined, opacity: opacity / 100 }}>Approvato il 9/11</p>
                  </SelectionPreview>
                </div>
                <div className="absolute bottom-16 right-10"><Square aria-hidden className="size-16 text-danger" strokeWidth={1.5} /></div>
              </PageFrame>
            </div>
            <ElementsPanel count={3} onRemoveAll={() => setModal(true)}>
              {[
                { icon: <Type />, title: 'Testo: Approvato il 9/11' },
                { icon: <Square />, title: 'Rettangolo' },
                { icon: <ImagePlus />, title: 'Immagine: timbro.png' },
              ].map((e, i, all) => (
                <ElementRow key={i} icon={e.icon} title={e.title} page={1} selected={selected === i} onSelect={() => setSelected(i)}
                  onUp={i > 0 ? () => {} : undefined} onDown={i < all.length - 1 ? () => {} : undefined} onDelete={() => {}} />
              ))}
            </ElementsPanel>
            <ElementsPanel count={0} onRemoveAll={() => {}}>{null}</ElementsPanel>
          </div>
        </Section>

        <Section id="caricamento" title="Dropzone, ProgressBar, Banner">
          <div className="grid gap-6 lg:grid-cols-2">
            <Dropzone onFile={() => {}} />
            <Dropzone onFile={() => {}} forceDragging />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProgressBar label="Lettura del file" value={62} />
            <ProgressBar label="Preparazione del PDF" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Banner tone="danger" title="Questo file non è un PDF">Scegli un file che termina con .pdf.</Banner>
            <Banner tone="warning" title="Questo PDF sembra una scansione" onDismiss={() => {}}>Puoi aggiungere testo, immagini e forme, ma non evidenziare o correggere il testo esistente.</Banner>
            <Banner tone="info" title="Nessun elemento aggiunto">Scegli uno strumento e clicca su una pagina.</Banner>
            <Banner tone="success" title="PDF salvato" />
          </div>
        </Section>

        <Section id="moduli" title="TextField e Modal">
          <div className="grid max-w-[720px] gap-4 md:grid-cols-2">
            <TextField label="Password del PDF" type="password" />
            <TextField label="Password del PDF" type="password" defaultValue="segreta" error="Password errata. Riprova." />
            <TextField label="Nome del file" defaultValue="contratto-modificato.pdf" hint="Lo usi per salvare il PDF." />
            <TextField label="Disabilitato" disabled defaultValue="—" />
          </div>
          <div><Button variant="secondary" onClick={() => setModal(true)}>Apri una finestra di conferma</Button></div>
          <Modal
            open={modal}
            onOpenChange={setModal}
            title="Rimuovere tutti gli elementi?"
            description="Testi, immagini, forme e disegni aggiunti spariscono da tutte le pagine. Puoi annullare con Ctrl Z."
            footer={<><Button variant="secondary" onClick={() => setModal(false)}>Annulla</Button><Button variant="danger" onClick={() => setModal(false)}>Rimuovi tutti</Button></>}
          />
        </Section>

        <Section id="download" title="DownloadCard">
          <div className="flex flex-wrap gap-6 bg-surface p-6">
            <DownloadCard fileName="contratto-modificato.pdf" size="2,4 MB" pages={12} onDownload={() => {}} onEditAgain={() => {}} onClose={() => {}} />
            <DownloadCard fileName="busta-paga-modificato.pdf" size="310 KB" pages={1} wasProtected onDownload={() => {}} onEditAgain={() => {}} onClose={() => {}} />
          </div>
        </Section>
      </main>
    </TooltipProvider>
  )
}
