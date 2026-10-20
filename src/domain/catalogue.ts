import type {
  Cell,
  Dir,
  Localized,
  ModuleDef,
  ModuleGroup,
  ModuleId,
  Port,
  RoomClass,
} from './types'

const defs: Record<ModuleId, ModuleDef> = {}
const groups: ModuleGroup[] = []

const corridor = (id: ModuleId, name: Localized, dirs: Dir[]): ModuleDef => ({
  id,
  code: `WY-${id}`,
  kind: 'corridor',
  name,
  cells: [[0, 0]],
  ports: dirs.map((d): Port => [0, 0, d]),
  ext: [],
})

const room = (
  id: ModuleId,
  name: Localized,
  cls: RoomClass,
  short: Localized,
  cells: Cell[],
  ports: Port[],
  ext: Port[] = [],
): ModuleDef => ({ id, code: `WY-${id}`, kind: 'room', name, short, cls, cells, ports, ext })

const rect = (w: number, h: number): Cell[] => {
  const cells: Cell[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y])
  return cells
}

const group = (id: string, label: Localized, items: ModuleDef[]) => {
  for (const d of items) defs[d.id] = d
  groups.push({ id, label, modules: items.map((d) => d.id) })
}

const l = (en: string, pl: string): Localized => ({ en, pl })

group('corridors', l('Corridors', 'Korytarze'), [
  corridor('K1', l('Straight corridor', 'Korytarz prosty'), [0, 4]),
  corridor('K2', l('Corner 90°', 'Zakręt 90°'), [0, 2]),
  corridor('K3', l('T-junction', 'Rozgałęzienie T'), [0, 2, 4]),
  corridor('K4', l('Crossing', 'Skrzyżowanie'), [0, 2, 4, 6]),
  corridor('K5', l('Diagonal corridor 45°', 'Korytarz 45°'), [1, 5]),
  corridor('K6', l('Diagonal transition (R)', 'Przejście na skos (P)'), [4, 1]),
  corridor('K7', l('Diagonal transition (L)', 'Przejście na skos (L)'), [4, 7]),
  corridor('K8', l('Diagonal corner', 'Zakręt skośny'), [1, 7]),
  corridor('K9', l('End cap', 'Zaślepka'), [4]),
])
group('habitation', l('Habitation', 'Mieszkalne'), [
  room('M1', l('Cabin', 'Kajuta'), 'hab', l('Cabin', 'Kajuta'), [[0, 0]], [[0, 0, 4]]),
  room('M2', l('Mess hall', 'Mesa'), 'hab', l('Mess hall', 'Mesa'), rect(3, 2), [
    [1, 1, 4],
    [0, 0, 6],
    [2, 0, 2],
  ]),
  room('M3', l('Sickbay', 'Ambulatorium'), 'hab', l('Sickbay', 'Ambulatorium'), rect(2, 2), [
    [0, 1, 4],
    [0, 0, 6],
  ]),
])
group('operations', l('Operations', 'Operacyjne'), [
  room('O1', l('Bridge', 'Mostek'), 'ops', l('Bridge', 'Mostek'), rect(3, 2), [[1, 1, 4]]),
  room(
    'O2',
    l('Laboratory', 'Laboratorium'),
    'ops',
    l('Lab', 'Lab.'),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 1, 4],
      [1, 0, 2],
    ],
  ),
  room('O3', l('Storage', 'Magazyn'), 'ops', l('Storage', 'Magazyn'), rect(2, 1), [[0, 0, 4]]),
  room('O4', l('Hangar', 'Hangar'), 'ops', l('Hangar', 'Hangar'), rect(4, 2), [
    [0, 1, 4],
    [3, 1, 4],
  ]),
])
group('technical', l('Technical', 'Techniczne'), [
  room('T1', l('Reactor', 'Reaktor'), 'tech', l('Reactor', 'Reaktor'), rect(2, 4), [
    [0, 3, 4],
    [1, 0, 0],
  ]),
  room('T2', l('Hydroponics', 'Hydroponika'), 'tech', l('Hydroponics', 'Hydroponika'), rect(4, 1), [
    [0, 0, 6],
    [3, 0, 2],
  ]),
  room(
    'T3',
    l('Airlock', 'Śluza'),
    'tech',
    l('Airlock', 'Śluza'),
    [[0, 0]],
    [[0, 0, 4]],
    [[0, 0, 0]],
  ),
])

export const MODULES: Readonly<Record<ModuleId, ModuleDef>> = defs
export const GROUPS: readonly ModuleGroup[] = groups

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && Object.hasOwn(defs, value)
}

export function moduleDef(id: ModuleId): ModuleDef {
  const def = defs[id]
  if (!def) throw new Error(`Unknown module: ${id}`)
  return def
}
