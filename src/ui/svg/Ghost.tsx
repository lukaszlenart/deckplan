import { canPlace, freeWallSegments } from '../../domain/analysis'
import { moduleDef } from '../../domain/catalogue'
import { edgeCenter, pieceSize, placementOffset, resizePiece, shape } from '../../domain/geometry'
import type { Size } from '../../domain/types'
import { useT } from '../../i18n'
import { store } from '../store'
import { CorridorStrokes } from './CorridorLayer'
import { RoomShape } from './RoomShape'

/** Placement preview: connection circles in bulkhead mode, otherwise the dragged or pending module. */
export function Ghost() {
  const t = useT()
  const drag = store.drag.value
  const bulkheadDrag = drag?.kind === 'bulkhead' && drag.moved
  if (store.bulkheadTool.value || bulkheadDrag) {
    const active = bulkheadDrag ? drag.edge : store.hoverEdge.value
    return (
      <>
        {freeWallSegments(store.plan.value).map((key) => {
          const [cx, cy] = edgeCenter(key)
          return (
            <circle
              key={`w${key}`}
              cx={cx}
              cy={cy}
              r={key === active ? '.17' : '.11'}
              fill="var(--bad)"
              stroke={key === active ? 'var(--bh-door)' : 'none'}
              stroke-width=".05"
            />
          )
        })}
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
  if (drag?.kind === 'resize') {
    const piece = store.plan.value.pieces.find((p) => p.id === drag.id)
    if (!drag.moved || !piece) return null
    const { x, y, w, h } = drag
    const size = pieceSize(resizePiece(piece, w, h))
    const fits =
      drag.over && canPlace(store.plan.value, piece.module, piece.r, x, y, piece.id, size)
    const colour = fits ? 'var(--ok)' : 'var(--bad)'
    return (
      <>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={colour}
          fill-opacity=".12"
          stroke={colour}
          stroke-width=".06"
          stroke-dasharray=".18 .1"
        />
        <text
          x={x + w - 0.15}
          y={y + h - 0.2}
          text-anchor="end"
          font-family="IBM Plex Mono, monospace"
          font-size=".45"
          fill={colour}
        >
          {t('board.size', { w, h })}
        </text>
      </>
    )
  }

  let placed: {
    module: string
    r: 0 | 1 | 2 | 3
    x: number
    y: number
    ignore?: number
    size?: Size
  } | null = null
  if (drag && drag.moved && drag.over) {
    placed = { module: drag.module, r: drag.r, x: drag.gx, y: drag.gy }
    if (drag.kind === 'move') {
      const id = drag.id
      const piece = store.plan.value.pieces.find((p) => p.id === id)
      placed.ignore = id
      if (piece) placed.size = pieceSize(piece)
    }
  } else if (!drag && store.pending.value && store.hoverCell.value) {
    const { module, r } = store.pending.value
    const [cx, cy] = store.hoverCell.value
    const [ox, oy] = placementOffset(module, r)
    placed = { module, r, x: cx - ox, y: cy - oy }
  }
  if (!placed) return null

  const s = shape(placed.module, placed.r, placed.size)
  const ok = canPlace(
    store.plan.value,
    placed.module,
    placed.r,
    placed.x,
    placed.y,
    placed.ignore,
    placed.size,
  )
  const colour = ok ? 'var(--ok)' : 'var(--bad)'
  return (
    <>
      <g opacity=".75">
        {moduleDef(placed.module).kind === 'room' ? (
          <RoomShape piece={{ ...placed, ...placed.size }} shape={s} thumb />
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
