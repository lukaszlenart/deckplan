import type { BulkheadType } from '../domain/types'
import { CURRENT_SCHEMA_VERSION } from './schema'

/** Door values written by the single-file version of the app. */
export const LEGACY_BULKHEADS: Record<string, BulkheadType> = {
  brak: 'open',
  drzwi: 'door',
  grodz: 'bulkhead',
  sluza: 'airlock',
  spaw: 'welded',
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Turns a plan written by the single-file version (`t`, `doors`, Polish values) into the current shape. */
export function migrate(raw: unknown): unknown {
  if (!isRecord(raw) || 'schemaVersion' in raw || !Array.isArray(raw.pieces)) return raw
  const pieces = raw.pieces.filter(isRecord).map((p) => ({
    id: p.id,
    module: p.t,
    x: p.x,
    y: p.y,
    r: (((Number(p.r) | 0) % 4) + 4) % 4,
  }))
  const bulkheads: Record<string, BulkheadType> = {}
  if (isRecord(raw.doors)) {
    for (const [key, value] of Object.entries(raw.doors)) {
      const type = typeof value === 'string' ? LEGACY_BULKHEADS[value] : undefined
      if (type) bulkheads[key] = type
    }
  }
  const ids = pieces.map((p) => (typeof p.id === 'number' ? p.id : 0))
  const nextId = typeof raw.nextId === 'number' ? raw.nextId : Math.max(0, ...ids) + 1
  const name = typeof raw.name === 'string' ? raw.name : ''
  return { schemaVersion: CURRENT_SCHEMA_VERSION, name, pieces, bulkheads, nextId }
}
