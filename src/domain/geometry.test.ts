import { describe, expect, it } from 'vitest'
import { MODULES } from './catalogue'
import {
  doorAt,
  edgeCenter,
  edgeKey,
  isResizable,
  pieceDoors,
  placementOffset,
  portPoint,
  resizePiece,
  shape,
  wallSegments,
} from './geometry'
import type { Piece } from './types'

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
    expect(s.ports).toEqual([])
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

  it('remaps external exits with the wall', () => {
    expect(shape('T3', 0, { w: 3, h: 2 }).ext).toEqual([[0, 0, 0]])
  })

  it('rotates after resizing, so a door keeps its own-frame offset (accepted quirk)', () => {
    const bridge: Piece = { id: 1, module: 'O1', x: 0, y: 0, r: 2 }
    const door = { x: 1, y: 1, dir: 4 as const, type: 'door' as const }
    expect(pieceDoors({ ...bridge, doors: [door] })[0]).toMatchObject({ x: 1, y: 0, dir: 0 })
    expect(pieceDoors({ ...bridge, w: 5, h: 2, doors: [door] })[0]).toMatchObject({
      x: 3,
      y: 0,
      dir: 0,
    })
  })

  it('resizePiece maps screen size to the own frame and normalises', () => {
    const p = { id: 1, module: 'O4', x: 0, y: 0, r: 0 as const }
    expect(resizePiece(p, 6, 3)).toEqual({ ...p, w: 6, h: 3 })
    expect(resizePiece({ ...p, r: 1 }, 5, 2)).toEqual({ ...p, r: 1, w: 2, h: 5 })
    expect(resizePiece({ ...p, w: 6, h: 3 }, 4, 2)).toEqual(p)
    expect(resizePiece(p, 0, -2)).toEqual({ ...p, w: 1, h: 1 })
  })
})

describe('placed doors', () => {
  const hangar = (extra: Partial<Piece> = {}): Piece => ({
    id: 1,
    module: 'O4',
    x: 10,
    y: 5,
    r: 0,
    ...extra,
  })

  it('catalogue rooms have no doors of their own', () => {
    for (const def of Object.values(MODULES))
      if (def.kind === 'room') expect(def.ports, def.id).toEqual([])
  })

  it('lists every outer wall segment of a room', () => {
    expect(wallSegments({ id: 1, module: 'M3', x: 2, y: 1, r: 0 }).sort()).toEqual(
      ['1,1,E', '1,2,E', '2,0,S', '3,0,S', '2,2,S', '3,2,S', '3,1,E', '3,2,E'].sort(),
    )
    expect(wallSegments({ id: 1, module: 'O2', x: 0, y: 0, r: 0 })).toHaveLength(8)
    expect(wallSegments({ id: 1, module: 'K1', x: 0, y: 0, r: 0 })).toEqual([])
  })

  it('places doors on the board through rotation', () => {
    const door = { x: 0, y: 1, dir: 4 as const, type: 'door' as const }
    expect(pieceDoors(hangar({ doors: [door] }))).toEqual([
      { x: 10, y: 6, dir: 4, type: 'door', edge: '10,6,S' },
    ])
    expect(pieceDoors(hangar({ r: 1, doors: [door] }))).toEqual([
      { x: 10, y: 5, dir: 6, type: 'door', edge: '9,5,E' },
    ])
  })

  it('doorAt inverts pieceDoors for every rotation', () => {
    for (const r of [0, 1, 2, 3] as const) {
      const p = hangar({ r, w: 5, h: 3 })
      for (const edge of wallSegments(p)) {
        const pos = doorAt(p, edge)
        expect(pos, `${r} ${edge}`).not.toBeNull()
        if (pos) expect(pieceDoors({ ...p, doors: [{ ...pos, type: 'door' }] })[0]?.edge).toBe(edge)
      }
    }
    expect(doorAt(hangar(), '20,20,S')).toBeNull()
    expect(doorAt(hangar(), '11,5,E')).toBeNull()
  })

  it('resizing moves doors with their wall and merges doors that land together', () => {
    const p = hangar({
      doors: [
        { x: 0, y: 1, dir: 4, type: 'bulkhead' },
        { x: 3, y: 1, dir: 4, type: 'door' },
        { x: 3, y: 0, dir: 2, type: 'airlock' },
      ],
    })
    expect(resizePiece(p, 6, 3).doors).toEqual([
      { x: 0, y: 2, dir: 4, type: 'bulkhead' },
      { x: 3, y: 2, dir: 4, type: 'door' },
      { x: 5, y: 0, dir: 2, type: 'airlock' },
    ])
    expect(resizePiece(p, 1, 2).doors).toEqual([
      { x: 0, y: 1, dir: 4, type: 'bulkhead' },
      { x: 0, y: 0, dir: 2, type: 'airlock' },
    ])
  })
})
