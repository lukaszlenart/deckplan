import type { ModuleId, Piece, Plan, Rotation } from './types'

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

/** The demo station shown on first run. Keep in sync with `examples/kestrel-4.json`. */
export function samplePlan(name: string): Plan {
  const pieces: Piece[] = LAYOUT.map(([module, x, y, r], i) => ({ id: i + 1, module, x, y, r }))
  return {
    schemaVersion: 1,
    name,
    pieces,
    bulkheads: { '7,8,S': 'bulkhead', '16,5,S': 'airlock', '3,9,S': 'bulkhead' },
    nextId: pieces.length + 1,
  }
}
