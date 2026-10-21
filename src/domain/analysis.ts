import { moduleDef } from './catalogue'
import { DX, DY, edgeKey, opposite, pieceShape, shape } from './geometry'
import type { BulkheadType, Dir, EdgeKey, ModuleId, Plan, Rotation, Size } from './types'
import { GRID } from './types'

export interface EdgeInfo {
  hasRoom: boolean
}

export interface OpenPort {
  x: number
  y: number
  dir: Dir
  room: boolean
}

export interface Analysis {
  edges: Map<EdgeKey, EdgeInfo>
  open: OpenPort[]
  fragments: number
}

/** Map of "x,y" → piece id for every occupied cell. */
export function occupancy(plan: Plan, ignoreId?: number): Map<string, number> {
  const occ = new Map<string, number>()
  for (const p of plan.pieces) {
    if (p.id === ignoreId) continue
    for (const [cx, cy] of pieceShape(p).cells) occ.set(`${p.x + cx},${p.y + cy}`, p.id)
  }
  return occ
}

export function canPlace(
  plan: Plan,
  id: ModuleId,
  r: Rotation,
  x: number,
  y: number,
  ignoreId?: number,
  size?: Size,
): boolean {
  const occ = occupancy(plan, ignoreId)
  return shape(id, r, size).cells.every(([cx, cy]) => {
    const X = x + cx
    const Y = y + cy
    return X >= 0 && Y >= 0 && X < GRID.width && Y < GRID.height && !occ.has(`${X},${Y}`)
  })
}

export function analyze(plan: Plan): Analysis {
  const isRoom = new Map(plan.pieces.map((p) => [p.id, moduleDef(p.module).kind === 'room']))
  const portMap = new Map<string, number>()
  for (const p of plan.pieces) {
    for (const [x, y, d] of pieceShape(p).ports) {
      portMap.set(`${p.x + x},${p.y + y},${d}`, p.id)
    }
  }
  const parent = new Map(plan.pieces.map((p) => [p.id, p.id]))
  const find = (a: number): number => {
    let root = a
    while (parent.get(root) !== root) root = parent.get(root) ?? root
    parent.set(a, root)
    return root
  }
  const edges = new Map<EdgeKey, EdgeInfo>()
  const open: OpenPort[] = []
  for (const [key, pid] of portMap) {
    const [x, y, d] = key.split(',').map(Number) as [number, number, Dir]
    const nx = x + (DX[d] ?? 0)
    const ny = y + (DY[d] ?? 0)
    const other = portMap.get(`${nx},${ny},${opposite(d)}`)
    if (other !== undefined && other !== pid) {
      parent.set(find(pid), find(other))
      const ek = edgeKey(x, y, d)
      if (ek && !edges.has(ek)) {
        edges.set(ek, { hasRoom: isRoom.get(pid) === true || isRoom.get(other) === true })
      }
    } else {
      open.push({ x, y, dir: d, room: isRoom.get(pid) === true })
    }
  }
  const roots = new Set(plan.pieces.map((p) => find(p.id)))
  return { edges, open, fragments: roots.size }
}

export function bulkheadAt(plan: Plan, key: EdgeKey, info: EdgeInfo): BulkheadType {
  return plan.bulkheads[key] ?? (info.hasRoom ? 'door' : 'open')
}

/** Returns a plan without bulkheads whose edge no longer exists. */
export function pruneBulkheads(plan: Plan): Plan {
  const { edges } = analyze(plan)
  const bulkheads: Plan['bulkheads'] = {}
  for (const [key, type] of Object.entries(plan.bulkheads))
    if (edges.has(key)) bulkheads[key] = type
  return { ...plan, bulkheads }
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

/** The cells the plan uses plus `margin` on every side, clamped to the grid; the whole grid when empty. */
export function planBounds(plan: Plan, margin = 1): Bounds {
  const cells = plan.pieces.flatMap((p) =>
    pieceShape(p).cells.map(([cx, cy]) => [p.x + cx, p.y + cy] as const),
  )
  if (!cells.length) return { x: 0, y: 0, w: GRID.width, h: GRID.height }
  const x0 = Math.max(0, Math.min(...cells.map((c) => c[0])) - margin)
  const y0 = Math.max(0, Math.min(...cells.map((c) => c[1])) - margin)
  const x1 = Math.min(GRID.width, Math.max(...cells.map((c) => c[0])) + 1 + margin)
  const y1 = Math.min(GRID.height, Math.max(...cells.map((c) => c[1])) + 1 + margin)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
