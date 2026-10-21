import { moduleDef } from './catalogue'
import type { Cell, Dir, EdgeKey, ModuleId, Piece, Port, Rotation, Size } from './types'

/** Index = Dir, north first, clockwise. */
export const DX: readonly number[] = [0, 1, 1, 1, 0, -1, -1, -1]
export const DY: readonly number[] = [-1, -1, 0, 1, 1, 1, 0, -1]

export const opposite = (d: Dir): Dir => ((d + 4) % 8) as Dir
export const rotateDir = (d: Dir): Dir => ((d + 2) % 8) as Dir
export const nextRotation = (r: Rotation): Rotation => ((r + 1) % 4) as Rotation

export interface Shape {
  cells: Cell[]
  ports: Port[]
  ext: Port[]
  w: number
  h: number
}

const cache = new Map<string, Shape>()

export function baseSize(id: ModuleId): Size {
  const { cells } = moduleDef(id)
  return { w: Math.max(...cells.map((c) => c[0])) + 1, h: Math.max(...cells.map((c) => c[1])) + 1 }
}

export function isResizable(id: ModuleId): boolean {
  const def = moduleDef(id)
  const { w, h } = baseSize(id)
  return def.kind === 'room' && def.cells.length === w * h
}

export const pieceSize = (p: Pick<Piece, 'module' | 'w' | 'h'>): Size =>
  p.w !== undefined && p.h !== undefined ? { w: p.w, h: p.h } : baseSize(p.module)

export const pieceShape = (p: Pick<Piece, 'module' | 'r' | 'w' | 'h'>): Shape =>
  shape(p.module, p.r, pieceSize(p))

/** The same wall of a `size` rectangle, clamped to its length. */
function remapPort([x, y, d]: Port, size: Size): Port {
  const right = size.w - 1
  const bottom = size.h - 1
  if (d === 0) return [Math.min(x, right), 0, d]
  if (d === 4) return [Math.min(x, right), bottom, d]
  if (d === 6) return [0, Math.min(y, bottom), d]
  if (d === 2) return [right, Math.min(y, bottom), d]
  throw new Error(`Diagonal port on a resizable room: ${String(d)}`)
}

const remapPorts = (ports: readonly Port[], size: Size): Port[] => {
  const unique = new Map(ports.map((p) => remapPort(p, size)).map((p) => [p.join(','), p]))
  return [...unique.values()]
}

const rect = ({ w, h }: Size): Cell[] =>
  Array.from({ length: w * h }, (_, i): Cell => [i % w, Math.floor(i / w)])

export function shape(id: ModuleId, r: Rotation, size?: Size): Shape {
  const base = baseSize(id)
  const resized = size !== undefined && (size.w !== base.w || size.h !== base.h)
  const key = resized ? `${id}|${r}|${size.w}x${size.h}` : `${id}|${r}`
  const cached = cache.get(key)
  if (cached) return cached
  const def = moduleDef(id)
  let cells: Cell[] = resized ? rect(size) : [...def.cells]
  let ports: Port[] = resized ? remapPorts(def.ports, size) : [...def.ports]
  let ext: Port[] = resized ? remapPorts(def.ext, size) : [...def.ext]
  let { w, h } = resized ? size : base
  for (let i = 0; i < r; i++) {
    const height = h
    const rot = ([x, y]: Cell): Cell => [height - 1 - y, x]
    cells = cells.map(rot)
    ports = ports.map(([x, y, d]) => [...rot([x, y]), rotateDir(d)])
    ext = ext.map(([x, y, d]) => [...rot([x, y]), rotateDir(d)])
    ;[w, h] = [h, w]
  }
  const result = { cells, ports, ext, w, h }
  cache.set(key, result)
  return result
}

export function edgeKey(x: number, y: number, d: Dir): EdgeKey | null {
  if (d === 2) return `${x},${y},E`
  if (d === 4) return `${x},${y},S`
  if (d === 0) return `${x},${y - 1},S`
  if (d === 6) return `${x - 1},${y},E`
  return null
}

export function edgeCenter(key: EdgeKey): [number, number] {
  const [a, b, side] = key.split(',')
  const x = Number(a)
  const y = Number(b)
  return side === 'E' ? [x + 1, y + 0.5] : [x + 0.5, y + 1]
}

/** Cell centre moved half a cell towards `d`. */
export function portPoint(x: number, y: number, d: Dir): [number, number] {
  return [x + 0.5 + (DX[d] ?? 0) * 0.5, y + 0.5 + (DY[d] ?? 0) * 0.5]
}

export function placementOffset(id: ModuleId, r: Rotation): [number, number] {
  const s = shape(id, r)
  return [Math.floor((s.w - 1) / 2), Math.floor((s.h - 1) / 2)]
}

/** `screenW`×`screenH` is the size on screen; the result stores it in the module's own frame. */
export function resizePiece(p: Piece, screenW: number, screenH: number): Piece {
  const sw = Math.max(1, screenW)
  const sh = Math.max(1, screenH)
  const [w, h] = p.r % 2 === 0 ? [sw, sh] : [sh, sw]
  const base = baseSize(p.module)
  const next: Piece = { id: p.id, module: p.module, x: p.x, y: p.y, r: p.r }
  return w === base.w && h === base.h ? next : { ...next, w, h }
}
