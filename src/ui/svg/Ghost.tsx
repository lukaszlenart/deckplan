import { canPlace } from '../../domain/analysis'
import { moduleDef } from '../../domain/catalogue'
import { edgeCenter, placementOffset, shape } from '../../domain/geometry'
import { store } from '../store'
import { CorridorStrokes } from './CorridorLayer'
import { RoomShape } from './RoomShape'

/** Placement preview: connection circles in bulkhead mode, otherwise the dragged or pending module. */
export function Ghost() {
  const drag = store.drag.value
  const bulkheadDrag = drag?.kind === 'bulkhead' && drag.moved
  if (store.bulkheadTool.value || bulkheadDrag) {
    const active = bulkheadDrag ? drag.edge : store.hoverEdge.value
    return (
      <>
        {[...store.analysis.value.edges.keys()].map((key) => {
          const [cx, cy] = edgeCenter(key)
          const on = key === active
          return (
            <circle
              key={key}
              cx={cx}
              cy={cy}
              r=".3"
              fill={on ? 'var(--accent)' : 'none'}
              fill-opacity=".35"
              stroke="var(--accent)"
              stroke-width={on ? '.08' : '.05'}
              stroke-dasharray={on ? undefined : '.12 .08'}
            />
          )
        })}
      </>
    )
  }
  if (drag?.kind === 'bulkhead') return null

  let placed: { module: string; r: 0 | 1 | 2 | 3; x: number; y: number; ignore?: number } | null =
    null
  if (drag && drag.moved && drag.over) {
    placed = { module: drag.module, r: drag.r, x: drag.gx, y: drag.gy }
    if (drag.kind === 'move') placed.ignore = drag.id
  } else if (!drag && store.pending.value && store.hoverCell.value) {
    const { module, r } = store.pending.value
    const [cx, cy] = store.hoverCell.value
    const [ox, oy] = placementOffset(module, r)
    placed = { module, r, x: cx - ox, y: cy - oy }
  }
  if (!placed) return null

  const s = shape(placed.module, placed.r)
  const ok = canPlace(store.plan.value, placed.module, placed.r, placed.x, placed.y, placed.ignore)
  const colour = ok ? 'var(--ok)' : 'var(--bad)'
  return (
    <>
      <g opacity=".75">
        {moduleDef(placed.module).kind === 'room' ? (
          <RoomShape piece={placed} shape={s} thumb />
        ) : (
          <CorridorStrokes piece={placed} shape={s} />
        )}
      </g>
      {s.cells.map(([x, y]) => (
        <rect
          key={`${x},${y}`}
          x={placed.x + x}
          y={placed.y + y}
          width="1"
          height="1"
          fill={colour}
          opacity=".18"
          stroke={colour}
          stroke-width=".05"
        />
      ))}
    </>
  )
}
