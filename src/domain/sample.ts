import type { Door, ModuleId, Piece, Plan, Rotation } from './types'

const LAYOUT: [ModuleId, number, number, Rotation][] = [
  ['K1', 4, 8, 1],
  ['K3', 5, 8, 3],
  ['K1', 6, 8, 1],
  ['K3', 7, 8, 1],
  ['K1', 8, 8, 1],
  ['K1', 9, 8, 1],
  ['K3', 10, 8, 3],
  ['K1', 11, 8, 1],
  ['K1', 12, 8, 1],
  ['K3', 13, 8, 1],
  ['K7', 14, 8, 1],
  ['K5', 15, 7, 0],
  ['K6', 16, 6, 2],
  ['K2', 3, 8, 1],
  ['K1', 3, 9, 0],
  ['M1', 5, 7, 0],
  ['T1', 6, 9, 0],
  ['O1', 9, 6, 0],
  ['O3', 12, 9, 2],
  ['M2', 2, 10, 2],
  ['T3', 16, 5, 0],
]

const DOORS: Record<number, Door[]> = {
  16: [{ x: 0, y: 0, dir: 4, type: 'door' }],
  17: [{ x: 1, y: 0, dir: 0, type: 'bulkhead' }],
  18: [{ x: 1, y: 1, dir: 4, type: 'door' }],
  19: [{ x: 0, y: 0, dir: 4, type: 'door' }],
  20: [{ x: 1, y: 1, dir: 4, type: 'bulkhead' }],
  21: [{ x: 0, y: 0, dir: 4, type: 'airlock' }],
}

/** The demo station shown on first run. Keep in sync with `examples/kestrel-4.json`. */
export function samplePlan(name: string): Plan {
  const pieces: Piece[] = LAYOUT.map(([module, x, y, r], i) => {
    const doors = DOORS[i + 1]
    return doors ? { id: i + 1, module, x, y, r, doors } : { id: i + 1, module, x, y, r }
  })
  return {
    schemaVersion: 1,
    name,
    pieces,
    bulkheads: {},
    nextId: pieces.length + 1,
  }
}
