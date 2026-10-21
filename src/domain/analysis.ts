import { moduleDef } from './catalogue'
import { DX, DY, edgeKey, opposite, pieceDoors, pieceShape, shape, wallSegments } from './geometry'
import type {
  BulkheadType,
  Dir,
  EdgeKey,
  ModuleId,
  PlacedDoor,
  Plan,
  Rotation,
  Size,
} from './types'
import { GRID } from './types'

export interface EdgeInfo {
  hasRoom: boolean
  /** Set on a connection through a room door. */
  door?: { pieceId: number; type: BulkheadType }
}

export interface DoorInfo {
  pieceId: number
  type: BulkheadType
  connected: boolean
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
  /** Every placed door, connected or not. */
  doors: Map<EdgeKey, DoorInfo>
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
  const occ = occupancy(plan)
  const roomAt = (x: number, y: number) => {
    const id = occ.get(`${x},${y}`)
    return id !== undefined && isRoom.get(id) === true ? id : undefined
  }
  const doors = new Map<EdgeKey, DoorInfo>()
  const placed: PlacedDoor[] = []
  for (const p of plan.pieces) {
    for (const door of pieceDoors(p)) {
      if (doors.has(door.edge)) continue
      doors.set(door.edge, { pieceId: p.id, type: door.type, connected: false })
      placed.push(door)
    }
  }
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
  const throughDoor = (a: number, b: number, key: EdgeKey) => {
    const door = doors.get(key)
    if (!door) return
    parent.set(find(a), find(b))
    door.connected = true
    edges.set(key, { hasRoom: true, door: { pieceId: door.pieceId, type: door.type } })
  }
  for (const [key, pid] of portMap) {
    const [x, y, d] = key.split(',').map(Number) as [number, number, Dir]
    const nx = x + (DX[d] ?? 0)
    const ny = y + (DY[d] ?? 0)
    const other = portMap.get(`${nx},${ny},${opposite(d)}`)
    const ek = edgeKey(x, y, d)
    const room = roomAt(nx, ny)
    if (other !== undefined && other !== pid) {
      parent.set(find(pid), find(other))
      if (ek && !edges.has(ek)) edges.set(ek, { hasRoom: false })
    } else if (room !== undefined && ek && doors.has(ek)) {
      throughDoor(pid, room, ek)
    } else {
      open.push({ x, y, dir: d, room: false })
    }
  }
  for (const door of placed) {
    const owner = doors.get(door.edge)?.pieceId
    const other = roomAt(door.x + (DX[door.dir] ?? 0), door.y + (DY[door.dir] ?? 0))
    if (owner !== undefined && other !== undefined && other !== owner)
      throughDoor(owner, other, door.edge)
  }
  const roots = new Set(plan.pieces.map((p) => find(p.id)))
  return { edges, open, fragments: roots.size, doors }
}

export function bulkheadAt(plan: Plan, key: EdgeKey, info: EdgeInfo): BulkheadType {
  return info.door?.type ?? plan.bulkheads[key] ?? 'open'
}

/** Room wall segments without a door, each once. */
export function freeWallSegments(plan: Plan): EdgeKey[] {
  const { doors } = analyze(plan)
  const free = new Set(plan.pieces.flatMap(wallSegments))
  for (const key of doors.keys()) free.delete(key)
  return [...free]
}

/** Drops doors of piece `id` that sit on a segment where another room already has a door. */
export function dropDoorClashes(plan: Plan, id: number): Plan {
  const piece = plan.pieces.find((p) => p.id === id)
  if (!piece?.doors?.length) return plan
  const taken = new Set(
    plan.pieces.filter((p) => p.id !== id).flatMap((p) => pieceDoors(p).map((d) => d.edge)),
  )
  const placed = pieceDoors(piece)
  const doors = piece.doors.filter((_, i) => !taken.has(placed[i]?.edge ?? ''))
  if (doors.length === piece.doors.length) return plan
  return { ...plan, pieces: plan.pieces.map((p) => (p.id === id ? { ...p, doors } : p)) }
}

/** Returns a plan without bulkheads whose edge no longer exists. */
export function pruneBulkheads(plan: Plan): Plan {
  const { edges } = analyze(plan)
  const bulkheads: Plan['bulkheads'] = {}
  for (const [key, type] of Object.entries(plan.bulkheads))
    if (edges.has(key) && !edges.get(key)?.door) bulkheads[key] = type
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
