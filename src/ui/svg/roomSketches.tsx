import type { JSX } from 'preact'
import type { ModuleId } from '../../domain/types'

const bed = (x: number, y: number) => (
  <>
    <rect x={x} y={y} width=".35" height=".75" rx=".04" />
    <rect x={x + 0.05} y={y + 0.05} width=".25" height=".15" />
  </>
)

const crate = (x: number, y: number) => (
  <>
    <rect x={x} y={y} width=".35" height=".35" />
    <path d={`M${x} ${y}l.35 .35M${x + 0.35} ${y}l-.35 .35`} />
  </>
)

const table = (x: number) => (
  <>
    <rect x={x} y=".75" width=".9" height=".3" />
    <rect x={x} y=".62" width=".9" height=".08" />
    <rect x={x} y="1.1" width=".9" height=".08" />
    <rect x={x} y="1.45" width=".9" height=".25" />
  </>
)

const PLANTS = [0.35, 0.75, 1.15, 2.75, 3.15, 3.55]

/** Floor-plan sketches in each room's own frame at catalogue size, stroked in `currentColor`. */
export const ROOM_SKETCHES: Readonly<Record<ModuleId, () => JSX.Element>> = {
  M1: () => (
    <>
      <rect x=".1" y=".1" width=".35" height=".75" rx=".03" />
      <rect x=".14" y=".14" width=".27" height=".14" />
      <rect x=".6" y=".1" width=".3" height=".25" />
      <path d="M.75 .1v.25" />
    </>
  ),
  M2: () => (
    <>
      <rect x=".15" y=".12" width="2.7" height=".25" />
      <path d="M.5 .12v.25M1.1 .12v.25" />
      <circle cx="2.2" cy=".245" r=".08" />
      <circle cx="2.5" cy=".245" r=".08" />
      {table(0.45)}
      {table(1.65)}
    </>
  ),
  M3: () => (
    <>
      {bed(0.15, 0.15)}
      {bed(1.5, 0.15)}
      <rect x=".7" y="1.15" width=".6" height=".55" rx=".05" />
      <path d="M1 1.27v.31M.85 1.43h.3" />
      <circle cx=".3" cy="1.6" r=".12" />
      <circle cx="1.7" cy="1.6" r=".12" />
    </>
  ),
  O1: () => (
    <>
      <path d="M.2 .12H2.8" />
      <path d="M.2 .2H2.8" stroke-dasharray=".06 .04" />
      <path d="M.35 .55Q1.5 .3 2.65 .55L2.6 .75Q1.5 .52 .4 .75Z" />
      <rect x=".25" y="1.2" width=".4" height=".55" />
      <rect x="2.35" y="1.2" width=".4" height=".55" />
      <circle cx="1.5" cy="1.5" r=".17" />
      <path d="M1.36 1.62Q1.5 1.75 1.64 1.62" />
    </>
  ),
  O2: () => (
    <>
      <path d="M.12 .12H1.88V.38H.38V1.88H.12Z" />
      <circle cx=".6" cy=".25" r=".06" />
      <circle cx="1" cy=".25" r=".06" />
      <circle cx="1.4" cy=".25" r=".06" />
      <circle cx="1.4" cy="1.4" r=".3" />
      <circle cx="1.4" cy="1.4" r=".2" />
      <rect x=".2" y=".7" width=".1" height=".2" />
    </>
  ),
  O3: () => (
    <>
      {crate(0.1, 0.1)}
      {crate(0.1, 0.55)}
      {crate(1.55, 0.1)}
      {crate(1.55, 0.55)}
      <rect x=".6" y=".72" width=".8" height=".18" />
    </>
  ),
  O4: () => (
    <>
      <path d="M3.88 .3V1.7" stroke-dasharray=".1 .06" />
      <path d="M.4 1H2.4" stroke-dasharray=".1 .08" />
      <path d="M2.9 1L2.3 .7H1.2L.9 .45H.7L.8 .7V1.3L.7 1.55H.9L1.2 1.3H2.3Z" />
      <path d="M.2 .2h.3M.2 .2v.3M.2 1.8h.3M.2 1.8v-.3" />
    </>
  ),
  T1: () => (
    <>
      <path d="M.25 0V1.4M1.75 0V1.4M.25 4V2.6M1.75 4V2.6" />
      <path d="M.25 1.4Q.25 2 .55 2M1.75 1.4Q1.75 2 1.45 2M.25 2.6Q.25 2 .55 2M1.75 2.6Q1.75 2 1.45 2" />
      <path d="M.15 .3h.2M1.65 .3h.2M.15 3.7h.2M1.65 3.7h.2" />
      <circle cx="1" cy="2" r=".45" />
      <circle cx="1" cy="2" r=".3" />
      <circle cx="1" cy="2" r=".12" fill="currentColor" />
      <path d="M1 1.55V.6M1 2.45V3.4M.8 .6h.4M.8 3.4h.4" />
    </>
  ),
  T2: () => (
    <>
      <rect x=".15" y=".15" width="3.7" height=".22" />
      <rect x=".15" y=".63" width="3.7" height=".22" />
      {PLANTS.map((x) => (
        <g key={x}>
          <circle cx={x} cy=".26" r=".07" />
          <circle cx={x} cy=".74" r=".07" />
        </g>
      ))}
    </>
  ),
  T3: () => (
    <>
      <path d="M.1 .2H.9M.1 .8H.9" />
      <path d="M.5 .2V.8" stroke-dasharray=".05 .04" />
      <rect x=".1" y=".3" width=".14" height=".4" />
      <rect x=".76" y=".3" width=".14" height=".4" />
    </>
  ),
}
