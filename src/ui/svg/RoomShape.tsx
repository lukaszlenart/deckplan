import { moduleDef } from '../../domain/catalogue'
import { portPoint, type Shape } from '../../domain/geometry'
import type { Piece, PlacedDoor } from '../../domain/types'
import { useLocalize } from '../../i18n'

interface Props {
  piece: Pick<Piece, 'module' | 'x' | 'y'>
  shape: Shape
  /** Board-placed doors cut gaps in the wall. */
  doors?: readonly PlacedDoor[]
  thumb?: boolean
}

export function RoomShape({ piece: p, shape: s, doors = [], thumb = false }: Props) {
  const localize = useLocalize()
  const d = moduleDef(p.module)
  const cells = new Set(s.cells.map(([x, y]) => `${x},${y}`))
  let walls = ''
  for (const [x, y] of s.cells) {
    const X = p.x + x
    const Y = p.y + y
    if (!cells.has(`${x},${y - 1}`)) walls += `M${X} ${Y}h1`
    if (!cells.has(`${x},${y + 1}`)) walls += `M${X} ${Y + 1}h1`
    if (!cells.has(`${x - 1},${y}`)) walls += `M${X} ${Y}v1`
    if (!cells.has(`${x + 1},${y}`)) walls += `M${X + 1} ${Y}v1`
  }
  const cx = s.cells.reduce((a, c) => a + c[0] + 0.5, 0) / s.cells.length + p.x
  const cy = s.cells.reduce((a, c) => a + c[1] + 0.5, 0) / s.cells.length + p.y
  const fs = s.cells.length === 1 ? 0.2 : 0.3
  return (
    <>
      {s.cells.map(([x, y]) => (
        <rect
          key={`${x},${y}`}
          x={p.x + x}
          y={p.y + y}
          width="1.01"
          height="1.01"
          fill={`var(--${d.cls})`}
        />
      ))}
      <path
        d={walls}
        stroke="var(--room-edge)"
        stroke-width=".07"
        fill="none"
        stroke-linecap="square"
      />
      {s.ext.map(([x, y, dir]) => {
        const [X, Y] = portPoint(p.x + x, p.y + y, dir)
        const h = dir % 4 === 0
        return (
          <line
            key={`e${x},${y},${dir}`}
            x1={h ? X - 0.45 : X}
            y1={h ? Y : Y - 0.45}
            x2={h ? X + 0.45 : X}
            y2={h ? Y : Y + 0.45}
            stroke="var(--ext)"
            stroke-width=".14"
            stroke-dasharray=".12 .08"
          />
        )
      })}
      {doors.map(({ x, y, dir }) => {
        const [X, Y] = portPoint(x, y, dir)
        const h = dir % 4 === 0
        return (
          <line
            key={`p${x},${y},${dir}`}
            x1={h ? X - 0.2 : X}
            y1={h ? Y : Y - 0.2}
            x2={h ? X + 0.2 : X}
            y2={h ? Y : Y + 0.2}
            stroke="var(--board)"
            stroke-width=".11"
          />
        )
      })}
      {!thumb && (
        <>
          <text
            x={cx}
            y={cy - 0.02}
            text-anchor="middle"
            font-family="Chakra Petch, sans-serif"
            font-weight="600"
            font-size={fs}
            fill="var(--ink)"
          >
            {d.short ? localize(d.short) : ''}
          </text>
          <text
            x={cx}
            y={cy + fs * 0.95}
            text-anchor="middle"
            font-family="IBM Plex Mono, monospace"
            font-size={fs * 0.62}
            fill="var(--muted)"
          >
            {d.code}
          </text>
        </>
      )}
    </>
  )
}
