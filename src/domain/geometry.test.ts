import { describe, expect, it } from 'vitest'
import {
  edgeCenter,
  edgeKey,
  isResizable,
  placementOffset,
  portPoint,
  resizePiece,
  shape,
} from './geometry'

describe('geometry', () => {
  it('rotates an L-shaped room clockwise', () => {
    const s = shape('O2', 1)
    expect(s.w).toBe(2)
    expect(s.h).toBe(2)
    expect(s.cells).toEqual([
      [1, 0],
      [1, 1],
      [0, 0],
    ])
    expect(s.ports).toEqual([
      [0, 0, 6],
      [1, 1, 4],
    ])
  })

  it('rotates corridor ports', () => {
    expect(shape('K1', 1).ports.map((p) => p[2])).toEqual([2, 6])
    expect(shape('K1', 3).ports.map((p) => p[2])).toEqual([6, 2])
    expect(shape('T3', 2).ext).toEqual([[0, 0, 4]])
  })

  it('returns the same object for the same id and rotation', () => {
    expect(shape('T1', 2)).toBe(shape('T1', 2))
    expect(shape('T1', 2)).not.toBe(shape('T1', 0))
  })

  it('normalises north and west ports to the neighbouring S/E edge', () => {
    expect(edgeKey(5, 5, 2)).toBe('5,5,E')
    expect(edgeKey(5, 5, 4)).toBe('5,5,S')
    expect(edgeKey(5, 5, 0)).toBe('5,4,S')
    expect(edgeKey(5, 5, 6)).toBe('4,5,E')
    expect(edgeKey(5, 5, 1)).toBeNull()
  })

  it('edge centre and port point', () => {
    expect(edgeCenter('5,5,E')).toEqual([6, 5.5])
    expect(edgeCenter('5,5,S')).toEqual([5.5, 6])
    expect(portPoint(2, 3, 2)).toEqual([3, 3.5])
  })

  it('placement offset centres the ghost', () => {
    expect(placementOffset('O4', 0)).toEqual([1, 0])
    expect(placementOffset('T1', 1)).toEqual([1, 0])
  })
})

describe('resizable shapes', () => {
  it('derives which modules can be resized', () => {
    const ids = ['M1', 'M2', 'M3', 'O1', 'O2', 'O3', 'O4', 'T1', 'T2', 'T3', 'K1']
    expect(ids.filter((id) => isResizable(id))).toEqual([
      'M1',
      'M2',
      'M3',
      'O1',
      'O3',
      'O4',
      'T1',
      'T2',
      'T3',
    ])
  })

  it('treats the catalogue size as no resize', () => {
    expect(shape('O4', 1, { w: 4, h: 2 })).toBe(shape('O4', 1))
  })

  it('grows the hangar and moves south doors with the south wall', () => {
    const s = shape('O4', 0, { w: 6, h: 3 })
    expect([s.w, s.h, s.cells.length]).toEqual([6, 3, 18])
    expect(s.ports).toEqual([
      [0, 2, 4],
      [3, 2, 4],
    ])
  })

  it('moves east doors with the east wall and clamps doors past the wall end', () => {
    expect(shape('M2', 0, { w: 5, h: 2 }).ports).toEqual([
      [1, 1, 4],
      [0, 0, 6],
      [4, 0, 2],
    ])
    expect(shape('T1', 0, { w: 2, h: 2 }).ports).toEqual([
      [0, 1, 4],
      [1, 0, 0],
    ])
    expect(shape('T1', 0, { w: 1, h: 2 }).ports).toEqual([
      [0, 1, 4],
      [0, 0, 0],
    ])
  })

  it('merges doors that land on the same cell', () => {
    expect(shape('O4', 0, { w: 1, h: 2 }).ports).toEqual([[0, 1, 4]])
  })

  it('remaps external exits like ports', () => {
    expect(shape('T3', 0, { w: 3, h: 2 }).ext).toEqual([[0, 0, 0]])
    expect(shape('T3', 0, { w: 3, h: 2 }).ports).toEqual([[0, 1, 4]])
  })

  it('rotates after resizing, so a door keeps its own-frame offset (accepted quirk)', () => {
    expect(shape('O1', 2).ports).toEqual([[1, 0, 0]])
    expect(shape('O1', 2, { w: 5, h: 2 }).ports).toEqual([[3, 0, 0]])
  })

  it('resizePiece maps screen size to the own frame and normalises', () => {
    const p = { id: 1, module: 'O4', x: 0, y: 0, r: 0 as const }
    expect(resizePiece(p, 6, 3)).toEqual({ ...p, w: 6, h: 3 })
    expect(resizePiece({ ...p, r: 1 }, 5, 2)).toEqual({ ...p, r: 1, w: 2, h: 5 })
    expect(resizePiece({ ...p, w: 6, h: 3 }, 4, 2)).toEqual(p)
    expect(resizePiece(p, 0, -2)).toEqual({ ...p, w: 1, h: 1 })
  })
})
