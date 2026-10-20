import { describe, expect, it } from 'vitest'
import { analyze, bulkheadAt, canPlace, planBounds, pruneBulkheads } from './analysis'
import { samplePlan } from './sample'
import { makePlan } from './testing'

describe('analyze', () => {
  it('connects two facing corridors on one edge', () => {
    const plan = makePlan([
      { module: 'K1', x: 0, y: 0, r: 1 },
      { module: 'K1', x: 1, y: 0, r: 1 },
    ])
    const a = analyze(plan)
    expect([...a.edges.keys()]).toEqual(['0,0,E'])
    expect(a.edges.get('0,0,E')).toEqual({ hasRoom: false })
    expect(a.open).toHaveLength(2)
    expect(a.fragments).toBe(1)
  })

  it('counts a port facing the grid edge as open', () => {
    const a = analyze(makePlan([{ module: 'K1', x: 0, y: 0, r: 0 }]))
    expect(a.open).toHaveLength(2)
    expect(a.edges.size).toBe(0)
    expect(a.fragments).toBe(1)
  })

  it('room to corridor edge defaults to door, corridor to corridor to open', () => {
    const plan = makePlan([
      { module: 'M1', x: 0, y: 0, r: 0 },
      { module: 'K1', x: 0, y: 1, r: 0 },
    ])
    const a = analyze(plan)
    expect(a.edges.get('0,0,S')).toEqual({ hasRoom: true })
    expect(bulkheadAt(plan, '0,0,S', { hasRoom: true })).toBe('door')
    expect(bulkheadAt(plan, '0,0,S', { hasRoom: false })).toBe('open')
    expect(a.open).toEqual([{ x: 0, y: 1, dir: 4, room: false }])
  })

  it('uses the stored bulkhead when set', () => {
    const plan = makePlan(
      [
        { module: 'M1', x: 0, y: 0, r: 0 },
        { module: 'K1', x: 0, y: 1, r: 0 },
      ],
      { '0,0,S': 'welded' },
    )
    expect(bulkheadAt(plan, '0,0,S', { hasRoom: true })).toBe('welded')
  })

  it('counts detached fragments and an empty plan has none', () => {
    const plan = makePlan([
      { module: 'K1', x: 0, y: 0, r: 0 },
      { module: 'K1', x: 10, y: 10, r: 0 },
    ])
    expect(analyze(plan).fragments).toBe(2)
    expect(analyze(makePlan([])).fragments).toBe(0)
  })

  it('reports room open ports with room: true', () => {
    const a = analyze(makePlan([{ module: 'M1', x: 3, y: 3, r: 0 }]))
    expect(a.open).toEqual([{ x: 3, y: 3, dir: 4, room: true }])
  })
})

describe('canPlace', () => {
  const plan = makePlan([{ module: 'O4', x: 10, y: 10, r: 0 }])

  it('rejects off-grid and overlap, allows own cells via ignoreId', () => {
    expect(canPlace(plan, 'K1', 0, -1, 0)).toBe(false)
    expect(canPlace(plan, 'O4', 0, 37, 0)).toBe(false)
    expect(canPlace(plan, 'K1', 0, 11, 11)).toBe(false)
    expect(canPlace(plan, 'K1', 0, 5, 5)).toBe(true)
    expect(canPlace(plan, 'O4', 1, 10, 10)).toBe(false)
    expect(canPlace(plan, 'O4', 1, 10, 10, 1)).toBe(true)
  })
})

describe('pruneBulkheads', () => {
  it('drops keys without an edge and keeps the rest', () => {
    const plan = makePlan(
      [
        { module: 'K1', x: 0, y: 0, r: 1 },
        { module: 'K1', x: 1, y: 0, r: 1 },
      ],
      { '0,0,E': 'bulkhead', '5,5,S': 'airlock' },
    )
    const pruned = pruneBulkheads(plan)
    expect(pruned.bulkheads).toEqual({ '0,0,E': 'bulkhead' })
    expect(plan.bulkheads['5,5,S']).toBe('airlock')
  })
})

describe('samplePlan', () => {
  it('is placeable and connected', () => {
    const plan = samplePlan('X')
    expect(plan.name).toBe('X')
    expect(plan.pieces).toHaveLength(21)
    expect(plan.nextId).toBe(22)
    const a = analyze(plan)
    expect(a.fragments).toBe(1)
    expect(a.edges.size).toBeGreaterThan(0)
    for (const p of plan.pieces) {
      const others = { ...plan, pieces: plan.pieces.filter((q) => q.id !== p.id) }
      expect(canPlace(others, p.module, p.r, p.x, p.y), `piece ${p.id}`).toBe(true)
    }
    expect(Object.keys(plan.bulkheads).every((k) => a.edges.has(k))).toBe(true)
  })
})

describe('planBounds', () => {
  it('covers every cell of every piece plus a one-cell margin', () => {
    const plan = makePlan([
      { module: 'K1', x: 5, y: 6, r: 0 },
      { module: 'T1', x: 10, y: 8, r: 1 },
    ])
    // T1 rotated is 4×2, so it spans x 10–13, y 8–9
    expect(planBounds(plan)).toEqual({ x: 4, y: 5, w: 11, h: 6 })
  })

  it('clamps the margin to the grid', () => {
    const plan = makePlan([
      { module: 'K1', x: 0, y: 0, r: 0 },
      { module: 'K1', x: 39, y: 27, r: 0 },
    ])
    expect(planBounds(plan)).toEqual({ x: 0, y: 0, w: 40, h: 28 })
  })

  it('returns the whole grid for an empty plan', () => {
    expect(planBounds(makePlan([]))).toEqual({ x: 0, y: 0, w: 40, h: 28 })
  })
})
