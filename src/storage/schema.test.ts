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
})
