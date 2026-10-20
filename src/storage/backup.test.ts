import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makePlan } from '../domain/testing'
import { exportPlan, importPlan } from './backup'
import { LEGACY_KESTREL } from './legacyFixture'

const twoCorridors = () =>
  makePlan(
    [
      { module: 'K1', x: 0, y: 0, r: 1 },
      { module: 'K1', x: 1, y: 0, r: 1 },
    ],
    { '0,0,E': 'bulkhead', '9,9,S': 'airlock' },
  )

describe('exportPlan', () => {
  it('writes pretty JSON without dangling bulkheads', () => {
    const text = exportPlan(twoCorridors())
    expect(text).toContain('\n "pieces"')
    expect(JSON.parse(text).bulkheads).toEqual({ '0,0,E': 'bulkhead' })
  })
})

describe('importPlan', () => {
  it('reports unparseable text', () => {
    expect(importPlan('nope')).toEqual({ ok: false, reason: 'parse' })
  })

  it('reports invalid plans', () => {
    expect(importPlan('{"pieces":1}')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('imports a legacy export', () => {
    const result = importPlan(JSON.stringify(LEGACY_KESTREL))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.pieces).toHaveLength(21)
    expect(result.plan.bulkheads['16,5,S']).toBe('airlock')
    expect(result.plan.nextId).toBe(22)
  })

  it('imports the shipped example', () => {
    const result = importPlan(readFileSync('examples/kestrel-4.json', 'utf8'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.name).toBe('Kestrel-4 Outpost')
    expect(result.plan.pieces).toHaveLength(21)
    expect(result.plan.bulkheads['16,5,S']).toBe('airlock')
  })

  it('rejects overlapping pieces', () => {
    const plan = makePlan([
      { module: 'K1', x: 0, y: 0, r: 0 },
      { module: 'K1', x: 0, y: 0, r: 1 },
    ])
    expect(importPlan(JSON.stringify(plan))).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects a piece outside the grid', () => {
    const plan = makePlan([{ module: 'K1', x: 40, y: 0, r: 0 }])
    expect(importPlan(JSON.stringify(plan))).toEqual({ ok: false, reason: 'invalid' })
  })

  it('drops a bulkhead on an edge that does not exist', () => {
    const result = importPlan(JSON.stringify(twoCorridors()))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.bulkheads).toEqual({ '0,0,E': 'bulkhead' })
  })
})
