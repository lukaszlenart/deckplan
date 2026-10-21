import { z } from 'zod'
import { isModuleId } from '../domain/catalogue'
import { moduleDef } from '../domain/catalogue'
import { baseSize, isResizable, isWallSegment, pieceSize, shape } from '../domain/geometry'
import { BULKHEAD_TYPES, GRID, type Plan } from '../domain/types'

export const CURRENT_SCHEMA_VERSION = 1

const int = z.number().int()

const DoorSchema = z.object({
  x: int,
  y: int,
  dir: z.union([z.literal(0), z.literal(2), z.literal(4), z.literal(6)]),
  type: z.enum(BULKHEAD_TYPES),
})

const PieceSchema = z
  .object({
    id: int,
    module: z.string().refine(isModuleId, 'unknown module'),
    x: int,
    y: int,
    r: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    w: int.min(1).optional(),
    h: int.min(1).optional(),
    doors: z.array(DoorSchema).optional(),
  })
  .refine((p) => (p.w === undefined) === (p.h === undefined), 'w and h go together')
  .refine((p) => {
    if (p.w === undefined || p.h === undefined) return true
    const [screenW, screenH] = p.r % 2 === 0 ? [p.w, p.h] : [p.h, p.w]
    return screenW <= GRID.width && screenH <= GRID.height
  }, 'larger than the grid')
  .refine(
    (p) => p.w === undefined || (isModuleId(p.module) && isResizable(p.module)),
    'module cannot be resized',
  )
  .refine((p) => {
    if (p.w === undefined || p.h === undefined || !isModuleId(p.module)) return true
    const base = baseSize(p.module)
    return p.w >= base.w && p.h >= base.h
  }, 'smaller than the catalogue size')
  .refine((p) => {
    if (!p.doors) return true
    if (!isModuleId(p.module) || moduleDef(p.module).kind !== 'room') return false
    const { cells } = shape(p.module, 0, pieceSize(p))
    const keys = p.doors.map((d) => `${d.x},${d.y},${d.dir}`)
    return (
      new Set(keys).size === keys.length &&
      p.doors.every((d) => isWallSegment(cells, d.x, d.y, d.dir))
    )
  }, 'doors must sit on distinct room wall segments')

export const PlanSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    name: z.string(),
    pieces: z.array(PieceSchema),
    bulkheads: z.record(z.string(), z.enum(BULKHEAD_TYPES)),
    nextId: int,
  })
  .refine((p) => new Set(p.pieces.map((piece) => piece.id)).size === p.pieces.length, {
    message: 'duplicate piece ids',
  })

// Compile-time check that the schema and the domain type agree in both directions.
type Parsed = z.infer<typeof PlanSchema>
const _toDomain = (p: Parsed): Plan => p
const _fromDomain = (c: Plan): Parsed => c
void _toDomain
void _fromDomain

/** Throws a `ZodError` when `raw` is not a current-format plan. `nextId` is raised above every piece id. */
export function parsePlan(raw: unknown): Plan {
  const plan = PlanSchema.parse(raw)
  const nextId = Math.max(plan.nextId, ...plan.pieces.map((p) => p.id + 1), 1)
  return nextId === plan.nextId ? plan : { ...plan, nextId }
}
