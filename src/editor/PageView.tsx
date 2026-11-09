import { useEffect, useRef, useState } from 'react'
import { Canvas, PencilBrush, cache, type FabricObject, type Path, type Textbox } from 'fabric'
import type { RenderTask } from 'pdfjs-dist'
import { useStore } from '../store'
import type { Element, Pagina } from '../model'
import { applyToObject, createObject, drawingFromPath, idOf, readFromObject } from './fabricBridge'
import { newShape, newText } from './factory'
import { cssFamily, isFontLoaded, loadFontFace } from '../pdf/fonts'

export const PX_PER_PT = 96 / 72

interface Props {
  page: Pagina
  /** px CSS per punto PDF */
  scale: number
}

export function PageView({ page, scale }: Props) {
  const wrapper = useRef<HTMLDivElement>(null)
  const pdfCanvas = useRef<HTMLCanvasElement>(null)
  const fabricHost = useRef<HTMLDivElement>(null)
  const fc = useRef<Canvas | null>(null)
  const objects = useRef(new Map<string, FabricObject>())
  const pending = useRef(new Set<string>())
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  /** Cresce quando un oggetto creato in modo asincrono (es. immagine) arriva sul canvas. */
  const [objVersion, setObjVersion] = useState(0)

  const pdfjs = useStore((s) => s.pdfjs)
  const elements = useStore((s) => s.elements)
  const selectedId = useStore((s) => s.selectedId)
  const tool = useStore((s) => s.tool)
  const style = useStore((s) => s.style)
  const editRequest = useStore((s) => s.editRequest)

  const w = page.larghezza * scale
  const h = page.altezza * scale

  // Visibilità: si disegna solo ciò che è vicino allo schermo.
  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Pagina del PDF (pdf.js), nitida anche su schermi ad alta densità.
  useEffect(() => {
    if (!visible || !pdfjs || !pdfCanvas.current) return
    let task: RenderTask | null = null
    let cancelled = false
    const t = setTimeout(async () => {
      const p = await pdfjs.getPage(page.indice + 1)
      if (cancelled || !pdfCanvas.current) return
      const dpr = window.devicePixelRatio || 1
      const vp = p.getViewport({ scale: scale * dpr })
      const c = pdfCanvas.current
      c.width = Math.floor(vp.width)
      c.height = Math.floor(vp.height)
      task = p.render({ canvas: c, viewport: vp })
      task.promise.catch(() => {})
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(t)
      task?.cancel()
    }
  }, [visible, pdfjs, page.indice, scale])

  // Livello modificabile (Fabric): creato una volta, quando la pagina diventa visibile.
  useEffect(() => {
    if (!visible || !fabricHost.current) return
    const el = document.createElement('canvas')
    fabricHost.current.appendChild(el)
    const canvas = new Canvas(el, { selection: false, preserveObjectStacking: true, enableRetinaScaling: true })
    fc.current = canvas
    const objs = objects.current

    canvas.on('mouse:down', (opt) => {
      const s = useStore.getState()
      const tool = s.tool
      if (opt.target || (tool !== 'text' && tool !== 'shape')) return
      const p = opt.scenePoint
      const id = s.addElement(tool === 'text' ? newText(page.indice, p.x, p.y, s.style) : newShape(page.indice, p.x, p.y, s.style))
      s.setTool('select')
      s.select(id)
      if (tool === 'text') s.requestEdit(id)
    })
    canvas.on('object:modified', ({ target }) => {
      const id = idOf(target)
      const s = useStore.getState()
      const el = s.elements.find((e) => e.id === id)
      if (id && el) s.updateElement(id, readFromObject(target, el))
    })
    canvas.on('text:changed', ({ target }) => {
      const id = idOf(target)
      const s = useStore.getState()
      const el = s.elements.find((e) => e.id === id)
      if (id && el) s.updateElement(id, readFromObject(target, el))
    })
    canvas.on('text:editing:exited', ({ target }) => {
      const id = idOf(target)
      if (id && !(target as Textbox).text.trim()) useStore.getState().removeElement(id)
    })
    const onSelect = () => {
      const active = canvas.getActiveObjects()
      if (active.length > 1) {
        canvas.setActiveObject(active[0])
        return
      }
      const id = idOf(active[0])
      if (id && useStore.getState().selectedId !== id) useStore.getState().select(id)
    }
    canvas.on('selection:created', onSelect)
    canvas.on('selection:updated', onSelect)
    canvas.on('selection:cleared', () => {
      const s = useStore.getState()
      const sel = s.elements.find((e) => e.id === s.selectedId)
      if (sel && sel.page === page.indice) s.select(null)
    })
    canvas.on('path:created', ({ path }) => {
      const s = useStore.getState()
      canvas.remove(path)
      const p = path as Path
      if (!p.path?.length) return
      s.addElement(drawingFromPath(p, page.indice, s.style.drawColor, s.style.drawWidth))
    })

    setReady(true)
    return () => {
      setReady(false)
      objs.clear()
      fc.current = null
      void canvas.dispose()
      el.remove()
    }
  }, [visible, page.indice])

  // Zoom.
  useEffect(() => {
    const c = fc.current
    if (!ready || !c) return
    c.setDimensions({ width: Math.ceil(w), height: Math.ceil(h) })
    c.setZoom(scale)
    c.requestRenderAll()
  }, [ready, w, h, scale])

  // Strumento attivo: penna o selezione.
  useEffect(() => {
    const c = fc.current
    if (!ready || !c) return
    c.isDrawingMode = tool === 'draw'
    if (tool === 'draw') {
      const brush = new PencilBrush(c)
      brush.color = style.drawColor
      brush.width = style.drawWidth
      brush.strokeLineCap = 'round'
      brush.strokeLineJoin = 'round'
      c.freeDrawingBrush = brush
    }
    c.defaultCursor = tool === 'text' ? 'text' : tool === 'shape' ? 'crosshair' : 'default'
    c.forEachObject((o) => o.set({ hoverCursor: tool === 'select' ? 'move' : 'pointer' }))
  }, [ready, tool, style.drawColor, style.drawWidth])

  // Dallo store a Fabric: crea, aggiorna, elimina e ordina gli oggetti di questa pagina.
  useEffect(() => {
    const c = fc.current
    if (!ready || !c) return
    const mine = elements.filter((e) => e.page === page.indice).sort((a, b) => a.z - b.z)
    const keep = new Set(mine.map((e) => e.id))
    for (const [id, o] of objects.current) {
      if (!keep.has(id)) {
        c.remove(o)
        objects.current.delete(id)
      }
    }
    // Variante del font non ancora caricata (es. grassetto): prima la si carica, poi si ridisegna.
    for (const el of mine) {
      if (el.type === 'text' && !isFontLoaded(el.font, el.bold, el.italic)) {
        void loadFontFace(el.font, el.bold, el.italic).then(() => {
          cache.clearFontCache(cssFamily(el.font))
          setObjVersion((v) => v + 1)
        })
      }
    }
    let changedOrder = false
    for (const el of mine) {
      const o = objects.current.get(el.id)
      if (o) applyToObject(el, o)
      else if (!pending.current.has(el.id)) {
        pending.current.add(el.id)
        void createObject(el).then((obj) => {
          pending.current.delete(el.id)
          if (fc.current !== c || !useStore.getState().elements.some((e) => e.id === el.id)) return
          objects.current.set(el.id, obj)
          c.add(obj)
          applyToObject(currentElement(el.id) ?? el, obj)
          syncTextLines(el.id, obj)
          restack(c, objects.current)
          if (useStore.getState().selectedId === el.id) c.setActiveObject(obj)
          c.requestRenderAll()
          setObjVersion((v) => v + 1)
        })
      }
      if (o) {
        syncTextLines(el.id, o)
        changedOrder = true
      }
    }
    if (changedOrder) restack(c, objects.current)
    c.requestRenderAll()
  }, [ready, elements, page.indice, objVersion])

  // Testo appena creato: entra subito in modifica con il testo selezionato.
  useEffect(() => {
    const c = fc.current
    if (!ready || !c || !editRequest) return
    const o = objects.current.get(editRequest) as Textbox | undefined
    if (!o) return
    useStore.getState().requestEdit(null)
    c.setActiveObject(o)
    o.enterEditing()
    o.selectAll()
    c.requestRenderAll()
  }, [ready, editRequest, objVersion])

  // Selezione decisa fuori dal canvas (pannello Elementi, altre pagine).
  useEffect(() => {
    const c = fc.current
    if (!ready || !c) return
    const o = selectedId ? objects.current.get(selectedId) : undefined
    if (o && c.getActiveObject() !== o) c.setActiveObject(o)
    if (!o && c.getActiveObject()) c.discardActiveObject()
    c.requestRenderAll()
  }, [ready, selectedId])

  return (
    <figure className="flex flex-col items-center gap-2" data-page={page.indice}>
      <div ref={wrapper} className="relative bg-page shadow-page" style={{ width: w, height: h }}>
        <canvas ref={pdfCanvas} aria-hidden className="absolute inset-0 size-full" />
        <div ref={fabricHost} className="absolute inset-0" />
      </div>
      <figcaption className="text-xs text-text-muted">Pagina {page.indice + 1}</figcaption>
    </figure>
  )
}

function currentElement(id: string): Element | undefined {
  return useStore.getState().elements.find((e) => e.id === id)
}

/** Le righe del testo vengono decise dall'editor: le salviamo perché l'export le riproduca uguali. */
function syncTextLines(id: string, o: FabricObject) {
  const el = currentElement(id)
  if (!el || el.type !== 'text') return
  const lines = (o as Textbox).textLines
  if (lines.length !== el.lines.length || lines.some((l, i) => l !== el.lines[i])) {
    queueMicrotask(() => useStore.getState().updateElement(id, { lines: lines.slice() }))
  }
}

function restack(c: Canvas, objs: Map<string, FabricObject>) {
  const order = useStore
    .getState()
    .elements.filter((e) => objs.has(e.id))
    .sort((a, b) => a.z - b.z)
  order.forEach((e, i) => {
    const o = objs.get(e.id)!
    if (c.getObjects().indexOf(o) !== i) c.moveObjectTo(o, i)
  })
}
