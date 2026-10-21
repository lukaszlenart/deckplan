import { canPlace, pruneBulkheads } from '../domain/analysis'
import { pieceDoors, pieceSize } from '../domain/geometry'
import type { Plan } from '../domain/types'
import { migrate } from './migrate'
import { parsePlan } from './schema'

export type ImportResult = { ok: true; plan: Plan } | { ok: false; reason: 'parse' | 'invalid' }

export function exportPlan(plan: Plan): string {
  return JSON.stringify(pruneBulkheads(plan), null, 1)
}

/** Accepts current and legacy exports. Rejects plans whose pieces overlap or leave the grid. */
export function importPlan(text: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'parse' }
  }
  let plan: Plan
  try {
    plan = parsePlan(migrate(raw))
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  const placeable = plan.pieces.every((p) => {
    const others = { ...plan, pieces: plan.pieces.filter((q) => q.id !== p.id) }
    return canPlace(others, p.module, p.r, p.x, p.y, undefined, pieceSize(p))
  })
  if (!placeable) return { ok: false, reason: 'invalid' }
  const doorEdges = plan.pieces.flatMap((p) => pieceDoors(p).map((d) => d.edge))
  if (new Set(doorEdges).size !== doorEdges.length) return { ok: false, reason: 'invalid' }
  return { ok: true, plan: pruneBulkheads(plan) }
}
