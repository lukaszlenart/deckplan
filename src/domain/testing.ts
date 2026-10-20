import type { Piece, Plan } from './types'

export function makePlan(pieces: Omit<Piece, 'id'>[], bulkheads: Plan['bulkheads'] = {}): Plan {
  return {
    schemaVersion: 1,
    name: 'Test',
    pieces: pieces.map((p, i) => ({ id: i + 1, ...p })),
    bulkheads,
    nextId: pieces.length + 1,
  }
}
