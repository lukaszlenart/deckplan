import { describe, expect, it } from 'vitest'
import { samplePlan } from '../domain/sample'
import { LEGACY_KESTREL } from './legacyFixture'
import { migrate } from './migrate'
import { parsePlan } from './schema'

describe('migrate', () => {
  it('converts the legacy example into a valid current plan', () => {
    const plan = parsePlan(migrate(LEGACY_KESTREL))
    expect(plan.schemaVersion).toBe(1)
    expect(plan.name).toBe('Placówka Kestrel-4')
    expect(plan.pieces).toHaveLength(21)
    expect(plan.pieces[0]).toEqual({ id: 1, module: 'K1', x: 4, y: 8, r: 1 })
    expect(plan.bulkheads).toEqual({
      '7,8,S': 'bulkhead',
      '16,5,S': 'airlock',
      '3,9,S': 'bulkhead',
    })
    expect(plan.nextId).toBe(22)
  })

  it('normalises rotation like the old app did', () => {
    const legacy = (r: number) => ({
      name: 'x',
      pieces: [{ id: 1, t: 'K1', x: 0, y: 0, r }],
      doors: {},
    })
    expect(parsePlan(migrate(legacy(5))).pieces[0]?.r).toBe(1)
    expect(parsePlan(migrate(legacy(-1))).pieces[0]?.r).toBe(3)
    expect(parsePlan(migrate(legacy(1.7))).pieces[0]?.r).toBe(1)
  })

  it('drops unknown door values', () => {
    const legacy = {
      name: 'x',
      pieces: [{ id: 1, t: 'K1', x: 0, y: 0, r: 0 }],
      doors: { '0,0,S': 'xyz' },
    }
    expect(parsePlan(migrate(legacy)).bulkheads).toEqual({})
  })

  it('keeps a legacy nextId when present', () => {
    const legacy = { ...LEGACY_KESTREL, nextId: 40 }
    expect(parsePlan(migrate(legacy)).nextId).toBe(40)
  })

  it('passes a current-format object through untouched', () => {
    const plan = samplePlan('X')
    expect(migrate(plan)).toBe(plan)
    expect(migrate('nope')).toBe('nope')
    expect(migrate(null)).toBeNull()
  })
})
