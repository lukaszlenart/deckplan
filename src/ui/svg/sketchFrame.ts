import type { Rotation, Size } from '../../domain/types'

type Point = readonly [x: number, y: number]

function frame(x: number, y: number, r: Rotation, size: Size, base: Size) {
  const turn: readonly Point[] = [
    [0, 0],
    [size.h, 0],
    [size.w, size.h],
    [0, size.w],
  ]
  const [tx, ty] = turn[r] ?? [0, 0]
  return {
    tx: x + tx,
    ty: y + ty,
    deg: 90 * r,
    dx: (size.w - base.w) / 2,
    dy: (size.h - base.h) / 2,
  }
}

/** Places a sketch drawn in the module's own frame at catalogue size `base` onto the board. */
export function sketchTransform(x: number, y: number, r: Rotation, size: Size, base: Size): string {
  const f = frame(x, y, r, size, base)
  return `translate(${f.tx} ${f.ty}) rotate(${f.deg}) translate(${f.dx} ${f.dy})`
}

export function applySketchTransform(
  x: number,
  y: number,
  r: Rotation,
  size: Size,
  base: Size,
  [u, v]: Point,
): [number, number] {
  const f = frame(x, y, r, size, base)
  const [a, b] = [u + f.dx, v + f.dy]
  const turned: readonly Point[] = [
    [a, b],
    [-b, a],
    [-a, -b],
    [b, -a],
  ]
  const [rx, ry] = turned[r] ?? [a, b]
  return [rx + f.tx + 0, ry + f.ty + 0]
}
