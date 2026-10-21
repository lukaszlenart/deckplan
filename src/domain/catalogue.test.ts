import { describe, expect, it } from 'vitest'
import { GROUPS, MODULES, isModuleId, moduleDef } from './catalogue'
import { isResizable } from './geometry'

describe('catalogue', () => {
  it('has 19 modules in 4 groups and every group member exists', () => {
    expect(GROUPS).toHaveLength(4)
    const members = GROUPS.flatMap((g) => g.modules).sort()
    expect(members).toEqual(Object.keys(MODULES).sort())
    expect(members).toHaveLength(19)
  })

  it('every port and ext lies on one of the module cells', () => {
    for (const def of Object.values(MODULES)) {
      const cells = new Set(def.cells.map(([x, y]) => `${x},${y}`))
      for (const [x, y] of [...def.ports, ...def.ext]) {
        expect(cells.has(`${x},${y}`), `${def.id} port ${x},${y}`).toBe(true)
      }
    }
  })

  it('every corridor has at least one port', () => {
    for (const def of Object.values(MODULES))
      if (def.kind === 'corridor') expect(def.ports.length, def.id).toBeGreaterThan(0)
  })

  it('rooms have a class and a short label, corridors have neither', () => {
    for (const def of Object.values(MODULES)) {
      if (def.kind === 'room') {
        expect(def.cls, def.id).toBeDefined()
        expect(def.short, def.id).toBeDefined()
      } else {
        expect(def.cls, def.id).toBeUndefined()
        expect(def.short, def.id).toBeUndefined()
      }
    }
  })

  it('moduleDef throws on an unknown id and isModuleId rejects it', () => {
    expect(() => moduleDef('Z9')).toThrow()
    expect(isModuleId('Z9')).toBe(false)
    expect(isModuleId(1)).toBe(false)
    expect(isModuleId('constructor')).toBe(false)
    expect(isModuleId('__proto__')).toBe(false)
    expect(isModuleId('K1')).toBe(true)
    expect(moduleDef('K1').code).toBe('WY-K1')
  })

  it('keeps the legacy shapes, with the lab as a 2×2 room', () => {
    expect(MODULES.O2?.cells).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
    expect(isResizable('O2')).toBe(true)
    expect(MODULES.T3?.ext).toEqual([[0, 0, 0]])
    expect(MODULES.K8?.ports).toEqual([
      [0, 0, 1],
      [0, 0, 7],
    ])
  })
})
