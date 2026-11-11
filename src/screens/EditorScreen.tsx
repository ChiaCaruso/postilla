import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Brush, Download, Hand, Highlighter, ImagePlus, Layers, MousePointer2, Redo2, Shapes, Square, Circle, Minus, Eraser, MessageSquare, Strikethrough, Type, PenLine, TextCursorInput, TextSelect, Underline, Undo2, Waves, X } from 'lucide-react'
import { Toolbar, ToolbarSeparator, ToolPicker, type Tool } from '../ui/ToolPicker'
import { IconButton } from '../ui/IconButton'
import { Button } from '../ui/Button'
import { Banner } from '../ui/Banner'
import { ZoomControl, ZOOM_STEPS } from '../ui/ZoomControl'
import { ElementRow, ElementsPanel } from '../ui/ElementRow'
import { Modal } from '../ui/Modal'
import { PageView, PX_PER_PT } from '../editor/PageView'
import { Properties } from '../editor/Properties'
import { newComment, newImage, newShape, newText } from '../editor/factory'
import { exportPdf } from '../pdf/export'
import { missingChars } from '../pdf/coverage'
import { useStore, type ToolId } from '../store'
import type { Element, FontFamily } from '../model'
import { cn } from '../ui/cn'

const NO_TEXT = 'Questo PDF non contiene testo selezionabile (forse è una scansione)'

function toolsFor(haTesto: boolean): Tool<ToolId>[] {
  return [
    { value: 'select', label: 'Seleziona e sposta', icon: <MousePointer2 />, shortcut: 'V' },
    { value: 'hand', label: 'Mano: trascina per scorrere', icon: <Hand />, shortcut: 'H' },
    { value: 'text', label: 'Testo', icon: <Type />, shortcut: 'T' },
    {
      value: 'edittext',
      label: 'Modifica il testo del PDF',
      icon: <TextCursorInput />,
      shortcut: 'M',
      disabledReason: haTesto ? undefined : NO_TEXT,
    },
    { value: 'shape', label: 'Forma', icon: <Shapes />, shortcut: 'R' },
    { value: 'draw', label: 'Penna', icon: <Brush />, shortcut: 'P' },
    { value: 'marker', label: 'Evidenziatore a mano libera', icon: <Highlighter />, shortcut: 'E' },
    {
      value: 'annotate',
      label: 'Evidenzia, sottolinea o barra il testo',
      icon: <TextSelect />,
      shortcut: 'A',
      disabledReason: haTesto ? undefined : NO_TEXT,
    },
    { value: 'comment', label: 'Commento', icon: <MessageSquare />, shortcut: 'C' },
  ]
}
const SHORTCUTS: Record<string, ToolId> = { v: 'select', h: 'hand', t: 'text', m: 'edittext', r: 'shape', p: 'draw', e: 'marker', a: 'annotate', c: 'comment' }

function describe(el: Element): { title: string; icon: React.ReactNode } {
  switch (el.type) {
    case 'text':
      return { title: `Testo: ${el.text.replace(/\s+/g, ' ').trim() || '(vuoto)'}`, icon: <Type /> }
    case 'image':
      return { title: 'Immagine', icon: <ImagePlus /> }
    case 'drawing':
      return el.highlighter ? { title: 'Tratto di evidenziatore', icon: <Highlighter /> } : { title: 'Disegno a mano', icon: <PenLine /> }
    case 'shape':
      return el.shape === 'rect'
        ? { title: 'Rettangolo', icon: <Square /> }
        : el.shape === 'ellipse'
          ? { title: 'Ellisse', icon: <Circle /> }
          : { title: 'Linea', icon: <Minus /> }
    case 'comment':
      return { title: `Commento: ${el.text.replace(/\s+/g, ' ').trim() || '(vuoto)'}`, icon: <MessageSquare /> }
    case 'erase':
      return { title: `Testo originale tolto: ${el.text}`, icon: <Eraser /> }
    case 'annotation': {
      const what = { highlight: 'Evidenziato', underline: 'Sottolineato', strike: 'Barrato', squiggly: 'Sottolineato con onda' }[el.style]
      const icon = { highlight: <TextSelect />, underline: <Underline />, strike: <Strikethrough />, squiggly: <Waves /> }[el.style]
      return { title: `${what}: ${el.text}`, icon }
    }
  }
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

export function EditorScreen() {
  const s = useStore()
  const doc = s.doc!
  const scroller = useRef<HTMLElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [mobileHintClosed, setMobileHintClosed] = useState(false)
  const [missing, setMissing] = useState<string[]>([])
  const tools = toolsFor(doc.haTesto)
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const scale = (s.zoom / 100) * PX_PER_PT

  const fitWidth = () => {
    const el = scroller.current
    if (!el) return
    const widest = Math.max(...doc.pagine.map((p) => p.larghezza))
    s.setZoom(Math.min(150, ((el.clientWidth - 48) / (widest * PX_PER_PT)) * 100))
  }
  // Al primo ingresso la pagina occupa la larghezza disponibile.
  useLayoutEffect(() => {
    if (useStore.getState().zoom === 100) fitWidth()
  }, [])

  // Pagina corrente = quella più visibile (serve per inserire immagini e per la tastiera).
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const ratios = new Map<number, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(Number((e.target as HTMLElement).dataset.page), e.intersectionRatio)
        const best = [...ratios].sort((a, b) => b[1] - a[1])[0]
        if (best && best[1] > 0) useStore.getState().setCurrentPage(best[0])
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    root.querySelectorAll('[data-page]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [doc])

  // Caratteri che il font non ha (emoji, alcuni simboli): nel PDF sparirebbero, quindi lo diciamo subito.
  const textKey = JSON.stringify(
    s.elements.flatMap((e) => (e.type === 'text' ? [[e.text, e.font, e.bold, e.italic]] : [])),
  )
  useEffect(() => {
    let cancelled = false
    const texts = JSON.parse(textKey) as Array<[string, FontFamily, boolean, boolean]>
    void Promise.all(texts.map(([t, f, b, i]) => missingChars(t, f, b, i))).then((lists) => {
      if (!cancelled) setMissing([...new Set(lists.flat())])
    })
    return () => {
      cancelled = true
    }
  }, [textKey])

  /** Inserisce al centro della pagina corrente (uso da tastiera). */
  const insertAtCenter = (tool: 'text' | 'shape' | 'comment') => {
    const st = useStore.getState()
    const page = doc.pagine[st.currentPage]
    const base =
      tool === 'text' ? newText(page.indice, 0, 0, st.style) : tool === 'shape' ? newShape(page.indice, 0, 0, st.style) : newComment(page.indice, 0, 0, st.style)
    const w = base.type === 'text' ? base.width : base.type === 'shape' ? base.w : 18
    const id = st.addElement({ ...base, x: (page.larghezza - w) / 2, y: page.altezza / 2 - 20 })
    st.setTool('select')
    st.select(id)
    if (tool === 'text') st.requestEdit(id)
  }

  async function addImage(file: File) {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      let src: string
      let format: 'png' | 'jpg'
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        src = await new Promise<string>((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(r.result as string)
          r.onerror = rej
          r.readAsDataURL(file)
        })
        format = file.type === 'image/png' ? 'png' : 'jpg'
      } else {
        // Altri formati (WebP, GIF…): convertiti in PNG, l'unico formato con trasparenza che il PDF accetta così.
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext('2d')!.drawImage(img, 0, 0)
        src = c.toDataURL('image/png')
        format = 'png'
      }
      const st = useStore.getState()
      const page = doc.pagine[st.currentPage]
      const id = st.addElement(newImage(page.indice, page.larghezza, page.altezza, src, format, img.naturalWidth, img.naturalHeight))
      st.setTool('select')
      st.select(id)
    } catch {
      useStore.getState().setExportError('Non riesco a leggere questa immagine. Prova con un file PNG o JPG.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async function save() {
    const st = useStore.getState()
    st.select(null)
    st.setExportError(null)
    st.setScreen('processing')
    await new Promise((r) => setTimeout(r, 30)) // lascia disegnare la schermata di attesa
    try {
      const { bytes, wasEncrypted } = await exportPdf(doc, st.elements)
      const name = doc.nomeFile.replace(/\.pdf$/i, '') + '-modificato.pdf'
      st.setResult({ blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), name, wasEncrypted })
      st.setScreen('done')
    } catch (e) {
      console.error(e)
      st.setExportError('Non è stato possibile creare il PDF. Riprova; se succede ancora, il file di partenza potrebbe usare funzioni non supportate.')
      st.setScreen('editor')
    }
  }

  // Tastiera: scorciatoie degli strumenti, elimina, frecce, zoom, Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const st = useStore.getState()
      const sel = st.elements.find((x) => x.id === st.selectedId)
      const mod = e.ctrlKey || e.metaKey
      if (mod && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        st.setZoom(ZOOM_STEPS.find((z) => z > st.zoom) ?? st.zoom)
      } else if (mod && e.key === '-') {
        e.preventDefault()
        st.setZoom([...ZOOM_STEPS].reverse().find((z) => z < st.zoom) ?? st.zoom)
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        st.redo()
      } else if (mod && e.key.toLowerCase() === 'c' && sel) {
        if (st.copy(sel.id)) e.preventDefault()
      } else if (mod && e.key.toLowerCase() === 'v' && st.clipboard) {
        e.preventDefault()
        st.paste()
      } else if (mod) {
        return
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        st.removeElement(sel.id)
      } else if (e.key.startsWith('Arrow') && sel && sel.type !== 'annotation' && sel.type !== 'erase') {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0
        st.updateElement(sel.id, { x: sel.x + dx, y: sel.y + dy })
      } else if (e.key === 'Escape') {
        st.select(null)
        st.setTool('select')
      } else if (!e.altKey && SHORTCUTS[e.key.toLowerCase()]) {
        const t = SHORTCUTS[e.key.toLowerCase()]
        if ((t !== 'annotate' && t !== 'edittext') || st.doc?.haTesto) st.setTool(t)
      } else if (!e.altKey && e.key.toLowerCase() === 'i') {
        imageInput.current?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sorted = [...s.elements].sort((a, b) => a.page - b.page || b.z - a.z)
  const panel = (
    <ElementsPanel count={s.elements.length} onRemoveAll={() => setConfirmClear(true)}>
      {sorted.map((el) => {
        const same = s.elements.filter((x) => x.page === el.page)
        const top = Math.max(...same.map((x) => x.z))
        const bottom = Math.min(...same.map((x) => x.z))
        const d = describe(el)
        return (
          <ElementRow
            key={el.id}
            icon={d.icon}
            title={d.title}
            page={el.page + 1}
            selected={s.selectedId === el.id}
            onSelect={() => {
              s.select(el.id)
              s.setCurrentPage(el.page)
              scroller.current?.querySelector(`[data-page="${el.page}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }}
            onUp={el.z < top ? () => s.reorder(el.id, 'up') : undefined}
            onDown={el.z > bottom ? () => s.reorder(el.id, 'down') : undefined}
            onDelete={() => s.removeElement(el.id)}
          />
        )
      })}
    </ElementsPanel>
  )

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-(--layout-header) shrink-0 items-center gap-3 border-b border-border bg-bg px-3 md:px-4">
        <IconButton label="Chiudi il PDF" icon={<X />} onClick={() => (s.elements.length ? setConfirmClose(true) : s.closeDocument())} />
        <h1 className="min-w-0 truncate text-sm font-semibold" title={doc.nomeFile}>{doc.nomeFile}</h1>
        <span className="hidden shrink-0 text-xs text-text-muted md:inline">{doc.pagine.length} {doc.pagine.length === 1 ? 'pagina' : 'pagine'}</span>
        <div className="grow" />
        <Button size="sm" icon={<Download className="size-4" aria-hidden />} onClick={() => void save()}>Salva il PDF</Button>
      </header>

      <section aria-label="Strumenti di modifica" className="shrink-0">
        <div className="overflow-x-auto">
        <Toolbar label="Strumenti">
          <ToolPicker
            label="Strumento attivo"
            tools={tools}
            value={s.tool}
            onChange={s.setTool}
            onActivate={(v, viaKeyboard) => {
              // Da tastiera si inserisce subito al centro della pagina; il gruppo di strumenti non cambia
              // strumento, altrimenti deselezionerebbe l'elemento appena creato.
              if (!viaKeyboard || (v !== 'text' && v !== 'shape' && v !== 'comment')) return false
              insertAtCenter(v)
              return true
            }}
          />
          <IconButton label="Inserisci immagine" shortcut="I" icon={<ImagePlus />} onClick={() => imageInput.current?.click()} />
          <ToolbarSeparator />
          <IconButton label="Annulla" shortcut="Ctrl Z" icon={<Undo2 />} disabled={s.past.length === 0} onClick={s.undo} />
          <IconButton label="Ripeti" shortcut="Ctrl Maiusc Z" icon={<Redo2 />} disabled={s.future.length === 0} onClick={s.redo} />
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void addImage(f)
              e.target.value = ''
            }}
          />
          <div className="grow" />
          <ZoomControl value={s.zoom} onChange={s.setZoom} onFitWidth={fitWidth} />
          <ToolbarSeparator />
          <div className="lg:hidden">
            <IconButton label={`Elementi (${s.elements.length})`} icon={<Layers />} pressed={panelOpen} onClick={() => setPanelOpen(!panelOpen)} />
          </div>
        </Toolbar>
        </div>
        <Properties />

      {missing.length > 0 && (
        <div className="px-3 pt-3">
          <Banner tone="warning" title="Alcuni caratteri non finiranno nel PDF">
            {missing.join(' ')} non {missing.length === 1 ? 'è disponibile' : 'sono disponibili'} nei font dell'editor (succede con le emoji e con alcuni simboli). Toglili o sostituiscili prima di salvare.
          </Banner>
        </div>
      )}
      {s.notice && (
        <div className="px-3 pt-3">
          <Banner tone="info" title={s.notice.title} onDismiss={() => s.setNotice(null)}>{s.notice.text}</Banner>
        </div>
      )}
      {s.exportError && (
        <div className="px-3 pt-3">
          <Banner tone="danger" title="Qualcosa non ha funzionato" onDismiss={() => s.setExportError(null)}>{s.exportError}</Banner>
        </div>
      )}
      {!mobileHintClosed && (
        <div className="px-3 pt-3 md:hidden">
          <Banner tone="info" title="Meglio da computer" onDismiss={() => setMobileHintClosed(true)}>
            Su schermi piccoli l'editor funziona, ma è scomodo da usare con le dita.
          </Banner>
        </div>
      )}

      </section>

      <div className="relative flex min-h-0 grow">
        <main
          ref={scroller}
          aria-label="Pagine del documento"
          tabIndex={0}
          className={cn(
            'grow overflow-auto bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
            s.tool === 'hand' && (panning ? 'cursor-grabbing select-none' : 'cursor-grab'),
          )}
          onPointerDown={(e) => {
            const el = scroller.current
            if (s.tool === 'hand' && el) {
              // Mano: si trascina il documento.
              pan.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
              el.setPointerCapture(e.pointerId)
              setPanning(true)
              e.preventDefault()
              return
            }
            // Clic sullo sfondo grigio: deseleziona.
            if (e.target === e.currentTarget) s.select(null)
          }}
          onPointerMove={(e) => {
            const el = scroller.current
            if (!pan.current || !el) return
            el.scrollLeft = pan.current.left - (e.clientX - pan.current.x)
            el.scrollTop = pan.current.top - (e.clientY - pan.current.y)
          }}
          onPointerUp={() => {
            pan.current = null
            setPanning(false)
          }}
        >
          <div className="mx-auto flex w-max flex-col items-center gap-(--layout-page-gap) p-6">
            {doc.pagine.map((p) => (
              <PageView key={p.indice} page={p} scale={scale} />
            ))}
          </div>
        </main>
        <div className={cn('h-full shrink-0', 'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:shadow-pop', !panelOpen && 'max-lg:hidden')}>
          {panel}
        </div>
      </div>

      <Modal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Rimuovere tutti gli elementi?"
        description="Testi, immagini, forme e disegni aggiunti spariscono da tutte le pagine. Il PDF originale non cambia."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>Annulla</Button>
            <Button variant="danger" onClick={() => { s.removeAll(); setConfirmClear(false) }}>Rimuovi tutti</Button>
          </>
        }
      />
      <Modal
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Chiudere senza salvare?"
        description="Le modifiche non salvate andranno perse. Il PDF originale sul tuo computer non cambia."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClose(false)}>Continua a modificare</Button>
            <Button variant="danger" onClick={() => { setConfirmClose(false); s.closeDocument() }}>Chiudi senza salvare</Button>
          </>
        }
      />
    </div>
  )
}
