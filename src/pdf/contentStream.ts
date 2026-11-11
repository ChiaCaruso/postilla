// Lettura e riscrittura dei comandi di disegno di una pagina PDF (content stream),
// limitata a quanto serve per togliere testo esistente senza spostare il resto.
//
// Convenzione delle matrici come in geometry.ts: [a b c d e f], apply(m, x, y) = (a x + c y + e, b x + d y + f),
// mul(m, n) = prima n, poi m.
import type { Matrix } from '../model'
import { apply, mul, translate } from './geometry'

// ─── Lettura (tokenizer) ─────────────────────────────────────────────────────

export type Tok =
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'str'; v: Uint8Array }
  | { t: 'arr'; v: Tok[] }
  | { t: 'dict'; v: Tok[] }
  | { t: 'kw'; v: string }

export interface Op {
  op: string
  args: Tok[]
  /** byte del primo operando (o dell'operatore) e subito dopo l'operatore */
  start: number
  end: number
}

const isWs = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32
const isDelim = (c: number) =>
  c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37
const isNumStart = (c: number) => (c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46

export function parseContent(b: Uint8Array): Op[] {
  let i = 0
  const ops: Op[] = []

  const skipWs = () => {
    while (i < b.length) {
      const c = b[i]
      if (isWs(c)) i++
      else if (c === 37) while (i < b.length && b[i] !== 10 && b[i] !== 13) i++
      else break
    }
  }
  const readRegular = () => {
    let s = ''
    while (i < b.length && !isWs(b[i]) && !isDelim(b[i])) s += String.fromCharCode(b[i++])
    return s
  }
  const readLiteral = (): Uint8Array => {
    i++ // (
    const out: number[] = []
    let depth = 1
    while (i < b.length) {
      const c = b[i++]
      if (c === 92) {
        const n = b[i++]
        if (n === 110) out.push(10)
        else if (n === 114) out.push(13)
        else if (n === 116) out.push(9)
        else if (n === 98) out.push(8)
        else if (n === 102) out.push(12)
        else if (n >= 48 && n <= 55) {
          let v = n - 48
          for (let k = 0; k < 2 && b[i] >= 48 && b[i] <= 55; k++) v = v * 8 + (b[i++] - 48)
          out.push(v & 255)
        } else if (n === 13) {
          if (b[i] === 10) i++ // a capo nella stringa: si ignora
        } else if (n === 10) {
          // a capo nella stringa: si ignora
        } else out.push(n) // \( \) \\ e altri
      } else if (c === 40) {
        depth++
        out.push(c)
      } else if (c === 41) {
        if (--depth === 0) break
        out.push(c)
      } else out.push(c)
    }
    return Uint8Array.from(out)
  }
  const readHex = (): Uint8Array => {
    i++ // <
    let hex = ''
    while (i < b.length && b[i] !== 62) {
      const c = b[i++]
      if (!isWs(c)) hex += String.fromCharCode(c)
    }
    i++ // >
    if (hex.length % 2) hex += '0'
    const out = new Uint8Array(hex.length / 2)
    for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16)
    return out
  }
  const readValue = (): Tok | null => {
    skipWs()
    const c = b[i]
    if (c === 47) {
      i++
      return { t: 'name', v: readRegular() }
    }
    if (c === 40) return { t: 'str', v: readLiteral() }
    if (c === 60) {
      if (b[i + 1] === 60) {
        i += 2
        const v: Tok[] = []
        for (;;) {
          skipWs()
          if (i >= b.length) break
          if (b[i] === 62 && b[i + 1] === 62) {
            i += 2
            break
          }
          const x = readValue()
          if (x) v.push(x)
          else i++
        }
        return { t: 'dict', v }
      }
      return { t: 'str', v: readHex() }
    }
    if (c === 91) {
      i++
      const v: Tok[] = []
      for (;;) {
        skipWs()
        if (i >= b.length) break
        if (b[i] === 93) {
          i++
          break
        }
        const x = readValue()
        if (x) v.push(x)
        else i++
      }
      return { t: 'arr', v }
    }
    if (isNumStart(c)) {
      const s = readRegular()
      const n = parseFloat(s)
      return Number.isNaN(n) ? { t: 'kw', v: s } : { t: 'num', v: n }
    }
    if (!isDelim(c) && !isWs(c)) return { t: 'kw', v: readRegular() }
    return null
  }

  let args: Tok[] = []
  let argStart = -1
  while (true) {
    skipWs()
    if (i >= b.length) break
    const start = i
    const tok = readValue()
    if (!tok) {
      i++ // delimitatore isolato (es. ">" o ")" sbagliati): si salta
      continue
    }
    if (tok.t !== 'kw' || tok.v === 'true' || tok.v === 'false' || tok.v === 'null') {
      if (args.length === 0) argStart = start
      args.push(tok)
      continue
    }
    const op = tok.v
    const opStart = args.length ? argStart : start
    if (op === 'BI') {
      // Immagine in linea: dizionario fino a ID, poi dati binari fino a "EI" isolato.
      while (i < b.length) {
        skipWs()
        const save = i
        const t = readValue()
        if (t && t.t === 'kw' && t.v === 'ID') break
        if (!t) i = save + 1
      }
      i++ // un carattere di spazio dopo ID
      while (i < b.length) {
        if (b[i] === 69 && b[i + 1] === 73 && isWs(b[i - 1]) && (i + 2 >= b.length || isWs(b[i + 2]) || isDelim(b[i + 2]))) {
          i += 2
          break
        }
        i++
      }
      ops.push({ op: 'BI', args: [], start: opStart, end: i })
    } else {
      ops.push({ op, args, start: opStart, end: i })
    }
    args = []
  }
  return ops
}

// ─── Testo: posizione di ogni carattere ──────────────────────────────────────

export interface FontMetrics {
  /** byte per codice: 1 per i font semplici, 2 per i font Identity-H */
  bytesPerCode: 1 | 2
  /** larghezza del glifo in millesimi dell'unità di testo */
  width(code: number): number
  /** false = non sappiamo misurarlo con sicurezza (Type3, codifiche particolari): non si tocca */
  supported: boolean
}

export interface Glyph {
  kind: 'glyph'
  bytes: Uint8Array
  code: number
  /** spostamento dopo il glifo, nello spazio del testo senza scala orizzontale (per i numeri di TJ) */
  advance: number
  /** centro del glifo in coordinate utente del PDF */
  center: [number, number]
}
export interface Adjust {
  kind: 'adj'
  n: number
}

export interface TextShow {
  opIndex: number
  /** nome della risorsa del font nella pagina (es. "F5") */
  font: string
  items: Array<Glyph | Adjust>
  fontSize: number
  supported: boolean
}

interface TextState {
  ctm: Matrix
  fontName: string
  font: FontMetrics | null
  fontSize: number
  Tc: number
  Tw: number
  Th: number
  TL: number
  rise: number
}

const num = (t: Tok | undefined) => (t && t.t === 'num' ? t.v : 0)

export function interpretText(ops: Op[], getFont: (name: string) => FontMetrics | null, ctm0: Matrix = [1, 0, 0, 1, 0, 0]): TextShow[] {
  const shows: TextShow[] = []
  let gs: TextState = { ctm: ctm0, fontName: '', font: null, fontSize: 0, Tc: 0, Tw: 0, Th: 1, TL: 0, rise: 0 }
  const stack: TextState[] = []
  let Tm: Matrix = [1, 0, 0, 1, 0, 0]
  let Tlm: Matrix = [1, 0, 0, 1, 0, 0]

  const nextLine = (tx: number, ty: number) => {
    Tlm = mul(Tlm, translate(tx, ty))
    Tm = Tlm
  }

  const show = (opIndex: number, parts: Tok[]) => {
    const font = gs.font
    const items: Array<Glyph | Adjust> = []
    let x = 0
    const M = mul(gs.ctm, Tm)
    const fs = gs.fontSize
    const supported = !!font && font.supported && fs !== 0
    for (const part of parts) {
      if (part.t === 'num') {
        items.push({ kind: 'adj', n: part.v })
        x += (-part.v / 1000) * fs * gs.Th
        continue
      }
      if (part.t !== 'str') continue
      const bytes = part.v
      const bpc = font?.bytesPerCode ?? 1
      for (let k = 0; k + bpc <= bytes.length; k += bpc) {
        const code = bpc === 2 ? (bytes[k] << 8) | bytes[k + 1] : bytes[k]
        const w0 = font ? font.width(code) : 500
        const tw = bpc === 1 && code === 32 ? gs.Tw : 0
        const advance = (w0 / 1000) * fs + gs.Tc + tw
        const glyphW = (w0 / 1000) * fs * gs.Th
        const center = apply(M, x + glyphW / 2, gs.rise + fs * 0.3)
        items.push({ kind: 'glyph', bytes: bytes.slice(k, k + bpc), code, advance, center })
        x += advance * gs.Th
      }
    }
    Tm = mul(Tm, translate(x, 0))
    shows.push({ opIndex, font: gs.fontName, items, fontSize: fs, supported })
  }

  ops.forEach((o, idx) => {
    const a = o.args
    switch (o.op) {
      case 'q':
        stack.push({ ...gs })
        break
      case 'Q':
        gs = stack.pop() ?? gs
        break
      case 'cm':
        gs.ctm = mul(gs.ctm, [num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5])])
        break
      case 'BT':
        Tm = [1, 0, 0, 1, 0, 0]
        Tlm = [1, 0, 0, 1, 0, 0]
        break
      case 'Tf': {
        const name = a[0]?.t === 'name' ? a[0].v : ''
        gs.fontName = name
        gs.font = getFont(name)
        gs.fontSize = num(a[1])
        break
      }
      case 'Tc':
        gs.Tc = num(a[0])
        break
      case 'Tw':
        gs.Tw = num(a[0])
        break
      case 'Tz':
        gs.Th = num(a[0]) / 100
        break
      case 'TL':
        gs.TL = num(a[0])
        break
      case 'Ts':
        gs.rise = num(a[0])
        break
      case 'Td':
        nextLine(num(a[0]), num(a[1]))
        break
      case 'TD':
        gs.TL = -num(a[1])
        nextLine(num(a[0]), num(a[1]))
        break
      case 'Tm':
        Tm = [num(a[0]), num(a[1]), num(a[2]), num(a[3]), num(a[4]), num(a[5])]
        Tlm = Tm
        break
      case 'T*':
        nextLine(0, -gs.TL)
        break
      case 'Tj':
        show(idx, a.slice(0, 1))
        break
      case 'TJ':
        show(idx, a[0]?.t === 'arr' ? a[0].v : [])
        break
      case "'":
        nextLine(0, -gs.TL)
        show(idx, a.slice(0, 1))
        break
      case '"':
        gs.Tw = num(a[0])
        gs.Tc = num(a[1])
        nextLine(0, -gs.TL)
        show(idx, a.slice(2, 3))
        break
    }
  })
  return shows
}

// ─── Riscrittura: togliere caratteri senza spostare il resto ─────────────────

const fmt = (n: number) => {
  const s = n.toFixed(3).replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}
const hex = (bytes: number[]) => '<' + bytes.map((x) => x.toString(16).padStart(2, '0')).join('') + '>'

/** Nuovo comando TJ: i caratteri tolti diventano spazi della stessa larghezza (numeri di TJ). */
function rebuild(show: TextShow, remove: (g: Glyph) => boolean): string {
  const parts: string[] = []
  let cur: number[] = []
  let pending = 0
  const flushStr = () => {
    if (cur.length) {
      if (pending) parts.push(fmt(pending))
      pending = 0
      parts.push(hex(cur))
      cur = []
    }
  }
  for (const it of show.items) {
    if (it.kind === 'adj') {
      flushStr()
      pending += it.n
    } else if (remove(it)) {
      flushStr()
      pending += (-it.advance * 1000) / show.fontSize
    } else {
      if (!cur.length && pending) {
        parts.push(fmt(pending))
        pending = 0
      }
      cur.push(...it.bytes)
    }
  }
  flushStr()
  if (pending) parts.push(fmt(pending))
  return `[${parts.join(' ')}] TJ`
}

export interface RewriteResult {
  bytes: Uint8Array
  removedGlyphs: number
  /** caratteri che sarebbero da togliere ma con font che non sappiamo misurare: non toccati */
  skippedGlyphs: number
}

export function removeGlyphs(content: Uint8Array, ops: Op[], shows: TextShow[], remove: (g: Glyph) => boolean): RewriteResult {
  const edits: Array<{ start: number; end: number; text: string }> = []
  let removedGlyphs = 0
  let skippedGlyphs = 0
  for (const s of shows) {
    const hit = s.items.filter((it): it is Glyph => it.kind === 'glyph' && remove(it)).length
    if (!hit) continue
    if (!s.supported) {
      skippedGlyphs += hit
      continue
    }
    removedGlyphs += hit
    const o = ops[s.opIndex]
    let text = rebuild(s, remove)
    if (o.op === "'") text = `T* ${text}`
    if (o.op === '"') text = `${fmt(num(o.args[0]))} Tw ${fmt(num(o.args[1]))} Tc T* ${text}`
    edits.push({ start: o.start, end: o.end, text })
  }
  if (!edits.length) return { bytes: content, removedGlyphs, skippedGlyphs }
  edits.sort((a, b) => a.start - b.start)
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  let pos = 0
  for (const e of edits) {
    chunks.push(content.subarray(pos, e.start), enc.encode(e.text))
    pos = e.end
  }
  chunks.push(content.subarray(pos))
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return { bytes: out, removedGlyphs, skippedGlyphs }
}
