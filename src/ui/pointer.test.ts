import { describe, expect, it } from 'vitest'
import {
  beginBulkheadDrag,
  beginMoveDrag,
  beginNewDrag,
  beginResizeDrag,
  cellAt,
  moveDrag,
  nearestEdge,
  resolveDrop,
  rotateDrag,
  type Box,
} from './pointer'

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
})
// 40×28 grid drawn at 10px per cell, board starting at (100, 50)
const board = box(100, 50, 400, 280)
const wrap = box(100, 50, 200, 280)

describe('cellAt', () => {
  it('maps client coordinates to grid cells', () => {
    expect(cellAt(board, wrap, { x: 100, y: 50 })).toEqual([0, 0])
    expect(cellAt(board, wrap, { x: 159, y: 79 })).toEqual([5, 2])
  })
  it('rejects points outside the board or the scroll wrapper', () => {
    expect(cellAt(board, wrap, { x: 99, y: 60 })).toBeNull()
    expect(cellAt(board, wrap, { x: 350, y: 60 })).toBeNull()
    expect(cellAt(board, board, { x: 350, y: 60 })).toEqual([25, 1])
  })
})

describe('nearestEdge', () => {
  it('snaps within 0.6 cells and not beyond', () => {
    const edges = ['4,4,E', '4,4,S']
    // '4,4,E' centre is grid (5, 4.5) → client (150, 95)
    expect(nearestEdge(board, edges, { x: 152, y: 97 })).toBe('4,4,E')
    expect(nearestEdge(board, edges, { x: 146, y: 100 })).toBe('4,4,S')
    expect(nearestEdge(board, edges, { x: 200, y: 200 })).toBeNull()
  })
})

describe('drag reducer', () => {
  it('a move under 5px keeps moved=false, over it sets moved and the target cell', () => {
    const d0 = beginNewDrag('K1', 0, { x: 10, y: 10 })
    const d1 = moveDrag(d0, { x: 13, y: 13 }, [1, 1], null)
    expect(d1.moved).toBe(false)
    const d2 = moveDrag(d1, { x: 20, y: 20 }, [7, 3], null)
    expect(d2.moved).toBe(true)
    if (d2.kind !== 'new') throw new Error('kind')
    expect(d2.over).toBe(true)
    expect([d2.gx, d2.gy]).toEqual([7, 3])
    const d3 = moveDrag(d2, { x: 500, y: 500 }, null, null)
    if (d3.kind !== 'new') throw new Error('kind')
    expect(d3.over).toBe(false)
  })

  it('a move drag keeps the grab offset', () => {
    const d0 = beginMoveDrag({ id: 9, module: 'O4', x: 10, y: 10, r: 0 }, [12, 11], { x: 0, y: 0 })
    const d1 = moveDrag(d0, { x: 30, y: 30 }, [20, 20], null)
    if (d1.kind !== 'move') throw new Error('kind')
    expect(d1.off).toEqual([2, 1])
    expect([d1.gx, d1.gy]).toEqual([18, 19])
    const d2 = rotateDrag(d1)
    if (d2.kind !== 'move') throw new Error('kind')
    expect(d2.r).toBe(1)
    expect([d2.gx, d2.gy]).toEqual([18, 19])
  })

  it('rotateDrag on a new drag keeps the ghost centred', () => {
    const d0 = beginNewDrag('O4', 0, { x: 0, y: 0 })
    expect(d0.kind === 'new' && d0.off).toEqual([1, 0])
    const d1 = moveDrag(d0, { x: 30, y: 30 }, [10, 10], null)
    if (d1.kind !== 'new') throw new Error('kind')
    expect([d1.gx, d1.gy]).toEqual([9, 10])
    const d2 = rotateDrag(d1)
    if (d2.kind !== 'new') throw new Error('kind')
    expect(d2.r).toBe(1)
    expect(d2.off).toEqual([0, 1])
    expect([d2.gx, d2.gy]).toEqual([10, 9])
  })

  it('a bulkhead drag tracks the nearest edge and ignores rotation', () => {
    const d0 = beginBulkheadDrag('door', { x: 0, y: 0 })
    const d1 = moveDrag(d0, { x: 30, y: 30 }, null, '4,4,E')
    expect(d1.kind === 'bulkhead' && d1.edge).toBe('4,4,E')
    expect(rotateDrag(d1)).toBe(d1)
  })

  it('resolveDrop', () => {
    const fresh = beginNewDrag('K1', 0, { x: 0, y: 0 })
    expect(resolveDrop(fresh)).toEqual({ kind: 'click' })
    const placed = moveDrag(fresh, { x: 30, y: 30 }, [3, 4], null)
    expect(resolveDrop(placed)).toEqual({ kind: 'place', module: 'K1', r: 0, x: 3, y: 4 })
    expect(resolveDrop(moveDrag(placed, { x: 900, y: 900 }, null, null))).toEqual({
      kind: 'cancel',
    })
    const moved = moveDrag(
      beginMoveDrag({ id: 9, module: 'K1', x: 1, y: 1, r: 2 }, [1, 1], { x: 0, y: 0 }),
      { x: 30, y: 30 },
      [5, 6],
      null,
    )
    expect(resolveDrop(moved)).toEqual({ kind: 'move', id: 9, x: 5, y: 6, r: 2 })
    const bulk = moveDrag(
      beginBulkheadDrag('door', { x: 0, y: 0 }),
      { x: 30, y: 30 },
      null,
      '4,4,E',
    )
    expect(resolveDrop(bulk)).toEqual({ kind: 'bulkhead', type: 'door', edge: '4,4,E' })
    expect(resolveDrop(moveDrag(bulk, { x: 31, y: 31 }, null, null))).toEqual({
      kind: 'bulkhead',
      type: 'door',
      edge: null,
    })
  })
})

describe('resize drag', () => {
  const hangar = { id: 7, module: 'O4', x: 2, y: 3, r: 0 as const }

  it('tracks the cell under the pointer as the bottom-right corner', () => {
    let d = beginResizeDrag(hangar, { x: 160, y: 90 })
    d = moveDrag(d, { x: 180, y: 110 }, [7, 5], null)
    expect(resolveDrop(d)).toEqual({ kind: 'resize', id: 7, w: 6, h: 3 })
  })

  it('clamps to 1×1 above or left of the origin', () => {
    let d = beginResizeDrag(hangar, { x: 160, y: 90 })
    d = moveDrag(d, { x: 100, y: 50 }, [0, 0], null)
    expect(resolveDrop(d)).toEqual({ kind: 'resize', id: 7, w: 1, h: 1 })
  })

  it('starts at the current screen size of a rotated, resized room', () => {
    const d = beginResizeDrag({ ...hangar, r: 1, w: 6, h: 3 }, { x: 0, y: 0 })
    expect(d).toMatchObject({ w: 3, h: 6 })
  })

  it('cancels off the board, ignores rotation, and is a click when not moved', () => {
    const d = beginResizeDrag(hangar, { x: 160, y: 90 })
    expect(rotateDrag(d)).toBe(d)
    expect(resolveDrop(d)).toEqual({ kind: 'click' })
    expect(resolveDrop(moveDrag(d, { x: 600, y: 600 }, null, null))).toEqual({ kind: 'cancel' })
  })
})
