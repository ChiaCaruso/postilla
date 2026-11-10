import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { AnnotationElement, Documento, Element, FontFamily, Id, ShapeElement } from './model'

export type Screen = 'upload' | 'editor' | 'processing' | 'done'
export type ToolId = 'select' | 'hand' | 'text' | 'shape' | 'draw' | 'marker' | 'annotate' | 'comment'
export type ShapeKind = ShapeElement['shape']
export type AnnotationStyle = AnnotationElement['style']

/** Valori usati per i nuovi elementi: si aggiornano con le ultime scelte dell'utente. */
export interface Style {
  font: FontFamily
  size: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  shape: ShapeKind
  fill: string | null
  stroke: string | null
  strokeWidth: number
  drawColor: string
  drawWidth: number
  markerColor: string
  markerWidth: number
  annotStyle: AnnotationStyle
  highlightColor: string
  lineColor: string
  commentColor: string
  opacity: number
}

export interface Result {
  blob: Blob
  name: string
  wasEncrypted: boolean
}

export type NewElement = Element extends infer E ? (E extends Element ? Omit<E, 'id' | 'z'> : never) : never

/**
 * Come una modifica entra nella cronologia di Annulla:
 * - push: sempre un passo a sé
 * - merge: modifiche consecutive allo stesso elemento entro un secondo diventano un solo passo
 *   (scrivere una parola, trascinare un cursore, premere più volte una freccia)
 * - skip: dettagli interni che l'utente non ha fatto (es. righe ricalcolate dall'editor)
 */
export type HistoryMode = 'push' | 'merge' | 'skip'

const HISTORY_LIMIT = 100
const MERGE_MS = 1000

interface State {
  screen: Screen
  doc: Documento | null
  pdfjs: PDFDocumentProxy | null
  elements: Element[]
  past: Element[][]
  future: Element[][]
  clipboard: Element | null
  selectedId: Id | null
  tool: ToolId
  zoom: number
  currentPage: number
  style: Style
  result: Result | null
  exportError: string | null
  /** Testo appena creato da mettere subito in modifica (lo esegue la pagina che lo contiene). */
  editRequest: Id | null
  /** Messaggio informativo per l'utente (es. perché un'azione non ha avuto effetto). */
  notice: string | null

  openDocument: (doc: Documento, pdfjs: PDFDocumentProxy) => void
  closeDocument: () => void
  setScreen: (s: Screen) => void
  setTool: (t: ToolId) => void
  setZoom: (z: number) => void
  setCurrentPage: (p: number) => void
  setStyle: (s: Partial<Style>) => void
  addElement: (el: NewElement) => Id
  updateElement: (id: Id, patch: Partial<Element>, mode?: HistoryMode) => void
  removeElement: (id: Id) => void
  removeAll: () => void
  reorder: (id: Id, dir: 'up' | 'down') => void
  undo: () => void
  redo: () => void
  copy: (id: Id) => boolean
  paste: () => Id | null
  select: (id: Id | null) => void
  setResult: (r: Result | null) => void
  setExportError: (e: string | null) => void
  requestEdit: (id: Id | null) => void
  setNotice: (n: string | null) => void
}

export const DEFAULT_STYLE: Style = {
  font: 'NotoSans',
  size: 14,
  color: '#14171c',
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  shape: 'rect',
  fill: null,
  stroke: '#c02a2a',
  strokeWidth: 2,
  drawColor: '#2f5bea',
  drawWidth: 3,
  markerColor: '#ffe066',
  markerWidth: 14,
  annotStyle: 'highlight',
  highlightColor: '#ffe066',
  lineColor: '#c02a2a',
  commentColor: '#ffe066',
  opacity: 1,
}

export const useStore = create<State>()((set, get) => {
  let lastMergeKey = ''
  let lastMergeAt = 0

  /** Applica un nuovo elenco di elementi registrando (o no) il passo per Annulla. */
  function commit(elements: Element[], mode: HistoryMode, mergeKey = '', extra: Partial<State> = {}) {
    const now = Date.now()
    const { past } = get()
    const merging = mode === 'merge' && mergeKey === lastMergeKey && now - lastMergeAt < MERGE_MS
    if (mode === 'skip' || merging) {
      set({ elements, ...extra })
    } else {
      set({ elements, past: [...past.slice(-(HISTORY_LIMIT - 1)), get().elements], future: [], ...extra })
    }
    if (mode === 'merge') {
      lastMergeKey = mergeKey
      lastMergeAt = now
    } else if (mode === 'push') {
      lastMergeKey = ''
    }
  }

  const nextZ = (page: number) => Math.max(0, ...get().elements.filter((e) => e.page === page).map((e) => e.z)) + 1

  return {
    screen: 'upload',
    doc: null,
    pdfjs: null,
    elements: [],
    past: [],
    future: [],
    clipboard: null,
    selectedId: null,
    tool: 'select',
    zoom: 100,
    currentPage: 0,
    style: DEFAULT_STYLE,
    result: null,
    exportError: null,
    editRequest: null,
    notice: null,

    openDocument: (doc, pdfjs) =>
      set({ doc, pdfjs, elements: [], past: [], future: [], selectedId: null, tool: 'select', currentPage: 0, result: null, exportError: null, notice: null, screen: 'editor' }),
    closeDocument: () => {
      void get().pdfjs?.loadingTask.destroy()
      set({ doc: null, pdfjs: null, elements: [], past: [], future: [], selectedId: null, result: null, exportError: null, notice: null, screen: 'upload', tool: 'select' })
    },
    setScreen: (screen) => set({ screen }),
    // Scegliere uno strumento per inserire qualcosa deseleziona: la barra mostra le opzioni del nuovo elemento.
    setTool: (tool) => set({ tool, selectedId: tool === 'select' ? get().selectedId : null, notice: null }),
    setZoom: (zoom) => set({ zoom: Math.min(400, Math.max(25, Math.round(zoom))) }),
    setCurrentPage: (currentPage) => set({ currentPage }),
    setStyle: (s) => set({ style: { ...get().style, ...s } }),

    addElement: (el) => {
      const id = crypto.randomUUID()
      commit([...get().elements, { ...el, id, z: nextZ(el.page) } as Element], 'push')
      return id
    },
    updateElement: (id, patch, mode = 'merge') => {
      const current = get().elements.find((e) => e.id === id) as Record<string, unknown> | undefined
      if (!current) return
      // Una "modifica" che non cambia nulla (es. uscire dalla scrittura) non diventa un passo di Annulla.
      const changed = Object.entries(patch).some(([k, v]) => JSON.stringify(current[k]) !== JSON.stringify(v))
      if (!changed) return
      const key = `${id}:${Object.keys(patch).sort().join(',')}`
      commit(get().elements.map((e) => (e.id === id ? ({ ...e, ...patch } as Element) : e)), mode, key)
    },
    removeElement: (id) =>
      commit(
        get().elements.filter((e) => e.id !== id),
        'push',
        '',
        { selectedId: get().selectedId === id ? null : get().selectedId },
      ),
    removeAll: () => commit([], 'push', '', { selectedId: null }),
    reorder: (id, dir) => {
      const el = get().elements.find((e) => e.id === id)
      if (!el) return
      const samePage = get().elements.filter((e) => e.page === el.page).sort((a, b) => a.z - b.z)
      const i = samePage.findIndex((e) => e.id === id)
      const other = samePage[dir === 'up' ? i + 1 : i - 1]
      if (!other) return
      commit(
        get().elements.map((e) => (e.id === id ? { ...e, z: other.z } : e.id === other.id ? { ...e, z: el.z } : e)),
        'push',
      )
    },

    undo: () => {
      const { past, future, elements, selectedId } = get()
      const prev = past.at(-1)
      if (!prev) return
      lastMergeKey = ''
      set({
        elements: prev,
        past: past.slice(0, -1),
        future: [...future, elements],
        selectedId: prev.some((e) => e.id === selectedId) ? selectedId : null,
      })
    },
    redo: () => {
      const { past, future, elements, selectedId } = get()
      const next = future.at(-1)
      if (!next) return
      lastMergeKey = ''
      set({
        elements: next,
        past: [...past, elements],
        future: future.slice(0, -1),
        selectedId: next.some((e) => e.id === selectedId) ? selectedId : null,
      })
    },

    copy: (id) => {
      const el = get().elements.find((e) => e.id === id)
      // Le annotazioni sono legate al testo sotto: copiarle altrove non ha senso.
      if (!el || el.type === 'annotation') return false
      set({ clipboard: el })
      return true
    },
    paste: () => {
      const { clipboard, currentPage, doc } = get()
      if (!clipboard || !doc) return null
      const page = doc.pagine[currentPage] ? currentPage : clipboard.page
      const offset = page === clipboard.page ? 12 : 0
      const { id: _id, z: _z, ...rest } = clipboard
      const id = get().addElement({ ...rest, page, x: clipboard.x + offset, y: clipboard.y + offset } as NewElement)
      // incollando di nuovo, la copia successiva si sposta ancora
      set({ clipboard: { ...clipboard, page, x: clipboard.x + offset, y: clipboard.y + offset }, selectedId: id, tool: 'select' })
      return id
    },

    select: (selectedId) => set({ selectedId }),
    setResult: (result) => set({ result }),
    setExportError: (exportError) => set({ exportError }),
    requestEdit: (editRequest) => set({ editRequest }),
    setNotice: (notice) => set({ notice }),
  }
})

export const selectedElement = (s: State) => s.elements.find((e) => e.id === s.selectedId) ?? null
