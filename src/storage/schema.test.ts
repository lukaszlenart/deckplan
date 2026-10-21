import { describe, expect, it } from 'vitest'
import { samplePlan } from '../domain/sample'
import { makePlan } from '../domain/testing'
import { ZodError } from 'zod'
import { parsePlan } from './schema'

describe('PlanSchema', () => {
  it('accepts the sample plan', () => {
    const plan = samplePlan('X')
    expect(parsePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan)
  })

  it('rejects an unknown module', () => {
    expect(() => parsePlan(makePlan([{ module: 'Z9', x: 0, y: 0, r: 0 }]))).toThrow()
  })

  it('rejects a rotation outside 0–3', () => {
    const plan = makePlan([{ module: 'K1', x: 0, y: 0, r: 0 }])
    expect(() => parsePlan({ ...plan, pieces: [{ ...plan.pieces[0], r: 4 }] })).toThrow()
  })

  it('rejects a non-integer coordinate', () => {
    const plan = makePlan([{ module: 'K1', x: 0, y: 0, r: 0 }])
    expect(() => parsePlan({ ...plan, pieces: [{ ...plan.pieces[0], x: 1.5 }] })).toThrow()
  })

  it('rejects an unknown bulkhead value', () => {
    const plan = makePlan([{ module: 'K1', x: 0, y: 0, r: 0 }])
    expect(() => parsePlan({ ...plan, bulkheads: { '0,0,S': 'grodz' } })).toThrow()
  })

  it('rejects duplicate piece ids', () => {
    const plan = makePlan([
      { module: 'K1', x: 0, y: 0, r: 0 },
      { module: 'K1', x: 5, y: 5, r: 0 },
    ])
    const dup = { ...plan, pieces: plan.pieces.map((p) => ({ ...p, id: 1 })) }
    expect(() => parsePlan(dup)).toThrow()
  })

  it('raises a nextId that is not above every piece id', () => {
    const plan = makePlan([
      { module: 'K1', x: 0, y: 0, r: 0 },
      { module: 'K1', x: 5, y: 5, r: 0 },
    ])
    expect(parsePlan({ ...plan, nextId: 1 }).nextId).toBe(3)
    expect(parsePlan({ ...plan, nextId: 2 }).nextId).toBe(3)
    expect(parsePlan({ ...plan, nextId: 10 }).nextId).toBe(10)
    expect(parsePlan({ ...plan, pieces: [], nextId: 0 }).nextId).toBe(1)
  })

  it('accepts a size on a resizable room', () => {
    const plan = makePlan([{ module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 3 }])
    expect(parsePlan(plan).pieces[0]).toMatchObject({ w: 6, h: 3 })
  })

  it('rejects bad sizes', () => {
    const at = (size: { w?: number; h?: number }) =>
      makePlan([{ module: 'O4', x: 0, y: 0, r: 0, ...size }])
    expect(() => parsePlan(at({ w: 0, h: 2 }))).toThrow()
    expect(() => parsePlan(at({ w: 41, h: 2 }))).toThrow()
    expect(() => parsePlan(at({ w: 6, h: 29 }))).toThrow()
    expect(() => parsePlan(at({ w: 6 }))).toThrow()
    expect(() => parsePlan(makePlan([{ module: 'O2', x: 0, y: 0, r: 0, w: 3, h: 3 }]))).toThrow()
    expect(() => parsePlan(makePlan([{ module: 'Z9', x: 0, y: 0, r: 0, w: 3, h: 3 }]))).toThrow(
      ZodError,
    )
  })

  it('caps sizes by the screen size of rotated rooms', () => {
    const at = (r: 0 | 1, w: number, h: number) => makePlan([{ module: 'O4', x: 0, y: 0, r, w, h }])
    expect(parsePlan(at(1, 2, 30)).pieces[0]).toMatchObject({ w: 2, h: 30 })
    expect(() => parsePlan(at(1, 29, 2))).toThrow()
    expect(() => parsePlan(at(0, 2, 30))).toThrow()
  })

  it('accepts doors on room walls', () => {
    const plan = makePlan([
      { module: 'O4', x: 0, y: 0, r: 0, doors: [{ x: 3, y: 1, dir: 2, type: 'door' }] },
    ])
    expect(parsePlan(plan).pieces[0]?.doors).toHaveLength(1)
  })

  it('rejects doors off the wall, on corridors, diagonal or duplicated', () => {
    const at = (module: string, doors: unknown) =>
      makePlan([{ module, x: 0, y: 0, r: 0, doors } as never])
    expect(() => parsePlan(at('O4', [{ x: 1, y: 0, dir: 2, type: 'door' }]))).toThrow()
    expect(() => parsePlan(at('O4', [{ x: 9, y: 0, dir: 0, type: 'door' }]))).toThrow()
    expect(() => parsePlan(at('O4', [{ x: 0, y: 0, dir: 1, type: 'door' }]))).toThrow()
    expect(() => parsePlan(at('K1', [{ x: 0, y: 0, dir: 2, type: 'door' }]))).toThrow()
    const d = { x: 0, y: 0, dir: 0, type: 'door' }
    expect(() => parsePlan(at('O4', [d, d]))).toThrow()
    expect(() => parsePlan(at('Z9', [d]))).toThrow(ZodError)
  })

  it('checks doors against the resized footprint', () => {
    const plan = makePlan([
      { module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2, doors: [{ x: 5, y: 0, dir: 2, type: 'door' }] },
    ])
    expect(parsePlan(plan).pieces[0]?.doors).toHaveLength(1)
  })
})
