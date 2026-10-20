import { describe, expect, it } from 'vitest'
import { samplePlan } from '../domain/sample'
import { makePlan } from '../domain/testing'
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
})
