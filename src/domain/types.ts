export type Lang = 'en' | 'pl'
export const LANGS: readonly Lang[] = ['en', 'pl']
export type Localized = Record<Lang, string>

/** 0 = north, clockwise in 45° steps. Corridors use even values except the 45° pieces. */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
/** Multiples of 90° clockwise. */
export type Rotation = 0 | 1 | 2 | 3
export type Cell = readonly [x: number, y: number]
export type Port = readonly [x: number, y: number, dir: Dir]

export type ModuleId = string
export type RoomClass = 'hab' | 'ops' | 'tech'

export interface ModuleDef {
  id: ModuleId
  code: string
  kind: 'corridor' | 'room'
  name: Localized
  /** Label drawn inside rooms. */
  short?: Localized
  cls?: RoomClass
  /** Relative to the top-left corner at rotation 0. */
  cells: readonly Cell[]
  ports: readonly Port[]
  /** External exits: drawn, never connect. */
  ext: readonly Port[]
}

export interface ModuleGroup {
  id: string
  label: Localized
  modules: readonly ModuleId[]
}

export const BULKHEAD_TYPES = ['open', 'door', 'bulkhead', 'airlock', 'welded'] as const
export type BulkheadType = (typeof BULKHEAD_TYPES)[number]

/** "x,y,E" (right edge of cell x,y) or "x,y,S" (bottom edge). Diagonals have no edge key. */
export type EdgeKey = string

export interface Piece {
  id: number
  module: ModuleId
  x: number
  y: number
  r: Rotation
}

export interface Plan {
  schemaVersion: 1
  name: string
  pieces: Piece[]
  /** Only explicitly set bulkheads; the rest take the default for their edge. */
  bulkheads: Record<EdgeKey, BulkheadType>
  nextId: number
}

export const GRID = { width: 40, height: 28 } as const
