import { moduleDef } from '../../domain/catalogue'
import { pieceShape, portPoint, type Shape } from '../../domain/geometry'
import type { Piece } from '../../domain/types'

type Placed = Pick<Piece, 'module' | 'x' | 'y'>

export function corridorPath(p: Placed, s: Shape): string {
  let d = ''
  for (const [x, y, dir] of s.ports) {
    const [px, py] = portPoint(p.x + x, p.y + y, dir)
    d += `M${p.x + x + 0.5} ${p.y + y + 0.5}L${px} ${py}`
  }
  return d
}

const STYLES = {
  outer: { stroke: 'var(--corr-edge)', width: 0.5, dot: 0.25 },
  inner: { stroke: 'var(--corr)', width: 0.38, dot: 0.19 },
} as const

export function CorridorStroke({
  piece: p,
  shape: s,
  layer,
}: {
  piece: Placed
  shape: Shape
  layer: keyof typeof STYLES
}) {
  const style = STYLES[layer]
  return (
    <>
      <path d={corridorPath(p, s)} stroke={style.stroke} stroke-width={style.width} fill="none" />
      <circle cx={p.x + 0.5} cy={p.y + 0.5} r={style.dot} fill={style.stroke} />
    </>
  )
}

/** Both strokes of one corridor piece, for thumbnails and the ghost. */
export function CorridorStrokes({ piece, shape }: { piece: Placed; shape: Shape }) {
  return (
    <>
      <CorridorStroke piece={piece} shape={shape} layer="outer" />
      <CorridorStroke piece={piece} shape={shape} layer="inner" />
    </>
  )
}

/** All corridors: every outer stroke first, then every inner one, so joins read as one network. */
export function CorridorLayer({ pieces }: { pieces: Piece[] }) {
  const corridors = pieces.filter((p) => moduleDef(p.module).kind === 'corridor')
  return (
    <>
      <g pointer-events="none">
        {corridors.map((p) => (
          <CorridorStroke key={`o${p.id}`} piece={p} shape={pieceShape(p)} layer="outer" />
        ))}
        {corridors.map((p) => (
          <CorridorStroke key={`i${p.id}`} piece={p} shape={pieceShape(p)} layer="inner" />
        ))}
      </g>
      <g>
        {corridors.map((p) => (
          <rect
            key={p.id}
            class="hit"
            data-id={p.id}
            x={p.x}
            y={p.y}
            width="1"
            height="1"
            fill="transparent"
          />
        ))}
      </g>
    </>
  )
}
