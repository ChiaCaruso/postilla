import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Documento, Element, FontFamily, Id, ShapeElement } from './model'

export type Screen = 'upload' | 'editor' | 'processing' | 'done'
export type ToolId = 'select' | 'text' | 'shape' | 'draw'
export type ShapeKind = ShapeElement['shape']

/** Valori usati per i nuovi elementi: si aggiornano con le ultime scelte dell'utente. */
export interface Style {
  font: FontFamily
  size: number
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  shape: ShapeKind
  fill: string | null
  stroke: string | null
  strokeWidth: number
  drawColor: string
  drawWidth: number
  opacity: number
}

export interface Result {
  blob: Blob
  name: string
  wasEncrypted: boolean
}

type NewElement = Element extends infer E ? (E extends Element ? Omit<E, 'id' | 'z'> : never) : never

interface State {
  screen: Screen
  doc: Documento | null
  pdfjs: PDFDocumentProxy | null
  elements: Element[]
  selectedId: Id | null
  tool: ToolId
  zoom: number
  currentPage: number
  style: Style
  result: Result | null
  exportError: string | null
  /** Testo appena creato da mettere subito in modifica (lo esegue la pagina che lo contiene). */
  editRequest: Id | null

  openDocument: (doc: Documento, pdfjs: PDFDocumentProxy) => void
  closeDocument: () => void
  setScreen: (s: Screen) => void
  setTool: (t: ToolId) => void
  setZoom: (z: number) => void
  setCurrentPage: (p: number) => void
  setStyle: (s: Partial<Style>) => void
  addElement: (el: NewElement) => Id
  updateElement: (id: Id, patch: Partial<Element>) => void
  removeElement: (id: Id) => void
  removeAll: () => void
  reorder: (id: Id, dir: 'up' | 'down') => void
  select: (id: Id | null) => void
  setResult: (r: Result | null) => void
  setExportError: (e: string | null) => void
  requestEdit: (id: Id | null) => void
}

export const DEFAULT_STYLE: Style = {
  font: 'NotoSans',
  size: 14,
  color: '#14171c',
  bold: false,
  italic: false,
  align: 'left',
  shape: 'rect',
  fill: null,
  stroke: '#c02a2a',
  strokeWidth: 2,
  drawColor: '#2f5bea',
  drawWidth: 3,
  opacity: 1,
}

export const useStore = create<State>()((set, get) => ({
  screen: 'upload',
  doc: null,
  pdfjs: null,
  elements: [],
  selectedId: null,
  tool: 'select',
  zoom: 100,
  currentPage: 0,
  style: DEFAULT_STYLE,
  result: null,
  exportError: null,
  editRequest: null,

  openDocument: (doc, pdfjs) =>
    set({ doc, pdfjs, elements: [], selectedId: null, tool: 'select', currentPage: 0, result: null, exportError: null, screen: 'editor' }),
  closeDocument: () => {
    void get().pdfjs?.loadingTask.destroy()
    set({ doc: null, pdfjs: null, elements: [], selectedId: null, result: null, exportError: null, screen: 'upload', tool: 'select' })
  },
  setScreen: (screen) => set({ screen }),
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.min(400, Math.max(25, Math.round(zoom))) }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setStyle: (s) => set({ style: { ...get().style, ...s } }),

  addElement: (el) => {
    const id = crypto.randomUUID()
    const z = Math.max(0, ...get().elements.filter((e) => e.page === el.page).map((e) => e.z)) + 1
    set({ elements: [...get().elements, { ...el, id, z } as Element] })
    return id
  },
  updateElement: (id, patch) =>
    set({ elements: get().elements.map((e) => (e.id === id ? ({ ...e, ...patch } as Element) : e)) }),
  removeElement: (id) =>
    set({ elements: get().elements.filter((e) => e.id !== id), selectedId: get().selectedId === id ? null : get().selectedId }),
  removeAll: () => set({ elements: [], selectedId: null }),
  reorder: (id, dir) => {
    const el = get().elements.find((e) => e.id === id)
    if (!el) return
    const samePage = get().elements.filter((e) => e.page === el.page).sort((a, b) => a.z - b.z)
    const i = samePage.findIndex((e) => e.id === id)
    const other = samePage[dir === 'up' ? i + 1 : i - 1]
    if (!other) return
    set({
      elements: get().elements.map((e) => (e.id === id ? { ...e, z: other.z } : e.id === other.id ? { ...e, z: el.z } : e)),
    })
  },
  select: (selectedId) => set({ selectedId }),
  setResult: (result) => set({ result }),
  setExportError: (exportError) => set({ exportError }),
  requestEdit: (editRequest) => set({ editRequest }),
}))

export const selectedElement = (s: State) => s.elements.find((e) => e.id === s.selectedId) ?? null
