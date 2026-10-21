import {
  edgeCenter,
  minScreenSize,
  nextRotation,
  pieceShape,
  placementOffset,
} from '../domain/geometry'
import type { BulkheadType, Cell, EdgeKey, ModuleId, Piece, Rotation } from '../domain/types'
import { GRID } from '../domain/types'
import type { DragState } from './store'

export interface Point {
  x: number
  y: number
}

/** The subset of `DOMRect` the pointer maths needs. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

/** Pixels a pointer must travel before a press becomes a drag. */
export const DRAG_THRESHOLD = 5
/** Distance in cells within which a connection circle catches the pointer. */
export const EDGE_SNAP = 0.6

const inside = (b: Box, p: Point) =>
  p.x >= b.left && p.y >= b.top && p.x <= b.right && p.y <= b.bottom

const toGrid = (board: Box, p: Point): [number, number] => [
  ((p.x - board.left) / board.width) * GRID.width,
  ((p.y - board.top) / board.height) * GRID.height,
]

/** Grid cell under the pointer, or null outside the board or its scroll wrapper. */
export function cellAt(board: Box, wrap: Box, p: Point): Cell | null {
  if (!inside(board, p) || !inside(wrap, p)) return null
  const [fx, fy] = toGrid(board, p)
  return [Math.floor(fx), Math.floor(fy)]
}

export function nearestEdge(board: Box, edges: Iterable<EdgeKey>, p: Point): EdgeKey | null {
  const [fx, fy] = toGrid(board, p)
  let best: EdgeKey | null = null
  let bestDistance = EDGE_SNAP
  for (const key of edges) {
    const [cx, cy] = edgeCenter(key)
    const distance = Math.hypot(fx - cx, fy - cy)
    if (distance < bestDistance) {
      bestDistance = distance
      best = key
    }
  }
  return best
}

export function beginNewDrag(module: ModuleId, r: Rotation, p: Point): DragState {
  return {
    kind: 'new',
    module,
    r,
    off: placementOffset(module, r),
    sx: p.x,
    sy: p.y,
    moved: false,
    over: false,
    gx: 0,
    gy: 0,
  }
}

export function beginMoveDrag(piece: Piece, grabCell: Cell, p: Point): DragState {
  return {
    kind: 'move',
    id: piece.id,
    module: piece.module,
    r: piece.r,
    off: [grabCell[0] - piece.x, grabCell[1] - piece.y],
    sx: p.x,
    sy: p.y,
    moved: false,
    over: false,
    gx: piece.x,
    gy: piece.y,
  }
}

export function beginBulkheadDrag(type: BulkheadType, p: Point): DragState {
  return { kind: 'bulkhead', type, sx: p.x, sy: p.y, moved: false, edge: null }
}

export function beginResizeDrag(piece: Piece, p: Point): DragState {
  const { w, h } = pieceShape(piece)
  const min = minScreenSize(piece.module, piece.r)
  return {
    kind: 'resize',
    id: piece.id,
    x: piece.x,
    y: piece.y,
    w,
    h,
    minW: min.w,
    minH: min.h,
    sx: p.x,
    sy: p.y,
    moved: false,
    over: true,
  }
}

export function moveDrag(
  drag: DragState,
  p: Point,
  cell: Cell | null,
  edge: EdgeKey | null,
): DragState {
  const moved = drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > DRAG_THRESHOLD
  if (!moved) return drag
  if (drag.kind === 'bulkhead') return { ...drag, moved, edge }
  if (drag.kind === 'resize') {
    if (!cell) return { ...drag, moved, over: false }
    const w = Math.max(drag.minW, cell[0] - drag.x + 1)
    const h = Math.max(drag.minH, cell[1] - drag.y + 1)
    return { ...drag, moved, over: true, w, h }
  }
  if (!cell) return { ...drag, moved, over: false }
  return { ...drag, moved, over: true, gx: cell[0] - drag.off[0], gy: cell[1] - drag.off[1] }
}

/** Rotates the dragged piece; a new piece is re-centred under the pointer, a moved one keeps its grab offset. */
export function rotateDrag(drag: DragState): DragState {
  if (drag.kind === 'bulkhead' || drag.kind === 'resize') return drag
  const r = nextRotation(drag.r)
  if (drag.kind === 'move') return { ...drag, r }
  const off = placementOffset(drag.module, r)
  return {
    ...drag,
    r,
    off,
    gx: drag.gx + drag.off[0] - off[0],
    gy: drag.gy + drag.off[1] - off[1],
  }
}

export type DropOutcome =
  | { kind: 'click' }
  | { kind: 'place'; module: ModuleId; r: Rotation; x: number; y: number }
  | { kind: 'move'; id: number; x: number; y: number; r: Rotation }
  | { kind: 'bulkhead'; type: BulkheadType; edge: EdgeKey | null }
  | { kind: 'resize'; id: number; w: number; h: number }
  | { kind: 'cancel' }

export function resolveDrop(drag: DragState): DropOutcome {
  if (!drag.moved) return { kind: 'click' }
  if (drag.kind === 'bulkhead') return { kind: 'bulkhead', type: drag.type, edge: drag.edge }
  if (!drag.over) return { kind: 'cancel' }
  if (drag.kind === 'resize') return { kind: 'resize', id: drag.id, w: drag.w, h: drag.h }
  if (drag.kind === 'new')
    return { kind: 'place', module: drag.module, r: drag.r, x: drag.gx, y: drag.gy }
  return { kind: 'move', id: drag.id, x: drag.gx, y: drag.gy, r: drag.r }
}
