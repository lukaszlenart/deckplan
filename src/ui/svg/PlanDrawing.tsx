import { bulkheadAt, type DoorInfo, type EdgeInfo } from '../../domain/analysis'
import { moduleDef } from '../../domain/catalogue'
import { pieceDoors, pieceShape } from '../../domain/geometry'
import type { EdgeKey, Plan } from '../../domain/types'
import { GRID } from '../../domain/types'
import { BulkheadMark } from './BulkheadMark'
import { CorridorLayer } from './CorridorLayer'
import { RoomShape } from './RoomShape'

interface Props {
  plan: Plan
  edges: Map<EdgeKey, EdgeInfo>
  doors: Map<EdgeKey, DoorInfo>
  /** Keeps grid pattern ids unique when several drawings share the page. */
  idPrefix: string
}

/** Background, grid, rooms, corridors and bulkheads: everything but the editor's hints. */
export function PlanDrawing({ plan, edges, doors, idPrefix }: Props) {
  const minor = `${idPrefix}-g1`
  const major = `${idPrefix}-g5`
  return (
    <>
      <defs>
        <pattern id={minor} width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" fill="none" stroke="var(--grid)" stroke-width=".025" />
        </pattern>
        <pattern id={major} width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0H0V5" fill="none" stroke="var(--grid-major)" stroke-width=".04" />
        </pattern>
      </defs>
      <rect data-bg="1" width={GRID.width} height={GRID.height} fill="var(--board)" />
      <rect width={GRID.width} height={GRID.height} fill={`url(#${minor})`} pointer-events="none" />
      <rect width={GRID.width} height={GRID.height} fill={`url(#${major})`} pointer-events="none" />
      <g>
        {plan.pieces
          .filter((p) => moduleDef(p.module).kind === 'room')
          .map((p) => (
            <g key={p.id} class="piece" data-id={p.id}>
              <RoomShape piece={p} shape={pieceShape(p)} doors={pieceDoors(p)} />
            </g>
          ))}
      </g>
      <CorridorLayer pieces={plan.pieces} />
      <g>
        {[...edges].map(([key, info]) => (
          <BulkheadMark
            key={key}
            edge={key}
            type={bulkheadAt(plan, key, info)}
            hasRoom={info.hasRoom}
          />
        ))}
        {[...doors]
          .filter(([, door]) => !door.connected)
          .map(([key, door]) => (
            <BulkheadMark key={key} edge={key} type={door.type} hasRoom />
          ))}
      </g>
    </>
  )
}
