import { moduleDef } from '../../domain/catalogue'
import { shape } from '../../domain/geometry'
import type { ModuleId } from '../../domain/types'
import { CorridorStrokes } from './CorridorLayer'
import { RoomShape } from './RoomShape'

export function ModuleThumb({ id }: { id: ModuleId }) {
  const s = shape(id, 0)
  const piece = { module: id, x: 0, y: 0 }
  const w = s.w + 0.16
  const h = s.h + 0.16
  return (
    <svg viewBox={`-.08 -.08 ${w} ${h}`} style={{ aspectRatio: `${w / h}` }}>
      {moduleDef(id).kind === 'room' ? (
        <RoomShape piece={piece} shape={s} thumb />
      ) : (
        <>
          <rect width="1" height="1" fill="none" stroke="var(--grid-major)" stroke-width=".03" />
          <CorridorStrokes piece={piece} shape={s} />
        </>
      )}
    </svg>
  )
}
