import { describe, expect, it } from 'vitest'
import { edgeCenter, edgeKey, placementOffset, portPoint, shape } from './geometry'

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
