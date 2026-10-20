import { moduleDef } from './catalogue'
import type { Cell, Dir, EdgeKey, ModuleId, Port, Rotation } from './types'

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

export function shape(id: ModuleId, r: Rotation): Shape {
  const key = `${id}|${r}`
  const cached = cache.get(key)
  if (cached) return cached
  const def = moduleDef(id)
  let cells: Cell[] = [...def.cells]
  let ports: Port[] = [...def.ports]
  let ext: Port[] = [...def.ext]
  let w = Math.max(...cells.map((c) => c[0])) + 1
  let h = Math.max(...cells.map((c) => c[1])) + 1
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
