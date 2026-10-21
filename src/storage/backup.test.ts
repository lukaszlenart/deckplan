import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { samplePlan } from '../domain/sample'
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
    expect(result.plan.pieces.some((p) => p.doors)).toBe(false)
    expect(result.plan.bulkheads).toEqual({})
    expect(result.plan.nextId).toBe(22)
  })

  it('imports the shipped example as the sample plan', () => {
    const result = importPlan(readFileSync('examples/kestrel-4.json', 'utf8'))
    expect(result.ok && result.plan).toEqual(samplePlan('Kestrel-4 Outpost'))
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

  it('rejects resized pieces that overlap or leave the grid', () => {
    const overlap = makePlan([
      { module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2 },
      { module: 'M1', x: 5, y: 0, r: 0 },
    ])
    expect(importPlan(JSON.stringify(overlap))).toEqual({ ok: false, reason: 'invalid' })
    const off = makePlan([{ module: 'O4', x: 38, y: 0, r: 0, w: 6, h: 2 }])
    expect(importPlan(JSON.stringify(off))).toEqual({ ok: false, reason: 'invalid' })
  })

  it('round-trips a resized piece', () => {
    const plan = makePlan([{ module: 'O4', x: 0, y: 0, r: 1, w: 6, h: 3 }])
    const back = importPlan(exportPlan(plan))
    expect(back.ok && back.plan.pieces[0]).toMatchObject({ w: 6, h: 3 })
  })

  it('rejects two rooms with a door on the same segment', () => {
    const plan = makePlan([
      { module: 'M1', x: 0, y: 0, r: 0, doors: [{ x: 0, y: 0, dir: 2, type: 'door' }] },
      { module: 'M1', x: 1, y: 0, r: 0, doors: [{ x: 0, y: 0, dir: 6, type: 'door' }] },
    ])
    expect(importPlan(JSON.stringify(plan))).toEqual({ ok: false, reason: 'invalid' })
  })
})
