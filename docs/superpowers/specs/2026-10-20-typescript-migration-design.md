# TypeScript migration and English/Polish UI — design

Request: switch the project to English (repository description, README, code, comments,
commits), make the app available in English and Polish, and rebuild it as a TypeScript project
with the same folder and file structure as `crew-manifest`, including its tooling, CI, GitHub
Pages deploy and PWA support.

## Intent

Deckplan is a browser editor for space station deck plans built from catalogue modules on a
square grid, used by one game master at the table. Today it is one `index.html` with inline
CSS and JavaScript, UI in Polish only, with no build, tests or lint. The goal is to bring it to
the same engineering baseline as `crew-manifest` so both projects are developed the same way,
and to make the UI usable by English-speaking players.

## Goals

- Same user-visible behaviour as the current `index.html`: catalogue, drag and click-to-place,
  rotation, bulkheads on connections, open-end and fragment counters, undo, localStorage
  autosave, JSON export/import, keyboard shortcuts, zoom, light/dark theme, phone layout.
- UI available in English and Polish, switchable at runtime, choice persisted.
- Vite + TypeScript + Preact + `@preact/signals` + Zod + Vitest + ESLint + Prettier, with the
  `crew-manifest` folder layout, scripts, CI workflow, GitHub Pages deploy and offline service
  worker.
- Everything written in English: README, code identifiers, comments, commit messages, GitHub
  repository description. No Polish outside `src/i18n/pl.ts` and the `pl` halves of localized
  catalogue data.

## Non-goals

- New editor features, new catalogue modules, multiple saved plans, a router with several
  screens, printing.
- Visual redesign. The current colours, fonts and layout are ported as they are.
- Keeping the single-file, no-build distribution. After this change the app is served from
  `dist/` or GitHub Pages.

## Anti-goals

- Losing a plan someone already has in localStorage. The old storage key and the old JSON format
  must still load.
- Breaking a keyboard shortcut or pointer interaction that works today.

## Constraints

- Mirror `crew-manifest` (`../crew-manifest`) for tooling, config files, scripts, folder names,
  ESLint rules, Prettier settings, Node version (24 via `.nvmrc`), i18n module shape, storage
  patterns and workflows. Copy and adapt rather than reinvent. Do not add dependencies beyond
  that stack.
- Vitest runs in the `node` environment with tests next to source as `src/**/*.test.ts`. No DOM
  testing library; keep logic in pure functions so it is testable without a DOM.
- Catalogue module ids (`K1`…`K9`, `M1`…`M3`, `O1`…`O4`, `T1`…`T3`) and the displayed codes
  (`WY-K1`, …) are kept unchanged. They are stable identifiers in saved plans.

## 1. Project layout

```
.github/workflows/ci.yml, deploy.yml   # copied from crew-manifest, names adjusted
.nvmrc, .gitignore, .prettierrc.json, .prettierignore, eslint.config.js, tsconfig.json
package.json, package-lock.json, vite.config.ts
index.html                              # Vite entry: fonts link, <div id="app">, main.tsx
public/icon.svg, icon-192.png, icon-512.png, manifest.webmanifest
docs/superpowers/specs/, docs/superpowers/plans/
examples/kestrel-4.json                 # converted to the new format
src/main.tsx
src/domain/   types.ts, catalogue.ts, geometry.ts, analysis.ts (+ tests)
src/storage/  schema.ts, migrate.ts, localStorageRepo.ts, memoryStorage.ts, repository.ts, backup.ts (+ tests)
src/i18n/     index.ts, en.ts, pl.ts (+ test)
src/ui/       App.tsx, Board.tsx, Palette.tsx, BulkheadPalette.tsx, Inspector.tsx, StatusBar.tsx,
              JsonDialog.tsx, Toast.tsx, store.ts, pointer.ts, shortcuts.ts, components/LangSwitch.tsx,
              svg/ (pure JSX helpers for pieces, bulkhead marks, thumbnails)
src/styles/   app.css
src/pwa/      sw.js, precache.ts (+ test)
```

`package.json` name `deckplan`, description "Browser editor for modular space station deck
plans, for Game Masters". Scripts identical to `crew-manifest` (`dev`, `build`, `preview`,
`test`, `test:watch`, `typecheck`, `lint`, `format`). ESLint keeps the rule that `domain/` and
`storage/` never import from `ui/`. There is no `generator/` folder.

## 2. Domain

### Types (`src/domain/types.ts`)

```ts
export type Lang = 'en' | 'pl'
export const LANGS: readonly Lang[] = ['en', 'pl']
export type Localized = Record<Lang, string>

/** 0 = north, clockwise in 45° steps. Corridors use even values except the 45° pieces. */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type Rotation = 0 | 1 | 2 | 3 // multiples of 90° clockwise
export type Cell = readonly [x: number, y: number]
export type Port = readonly [x: number, y: number, dir: Dir]

export type ModuleId = string // 'K1' … 'T3'
export type RoomClass = 'hab' | 'ops' | 'tech'

export interface ModuleDef {
  id: ModuleId
  code: string // 'WY-K1'
  kind: 'corridor' | 'room'
  name: Localized
  short?: Localized // label drawn inside rooms
  cls?: RoomClass
  cells: readonly Cell[] // relative to top-left, rotation 0
  ports: readonly Port[]
  ext: readonly Port[] // external exits, drawn, never connect
}

export interface ModuleGroup {
  id: string
  label: Localized
  modules: readonly ModuleId[]
}

export type BulkheadType = 'open' | 'door' | 'bulkhead' | 'airlock' | 'welded'
export const BULKHEAD_TYPES: readonly BulkheadType[] // palette and 1–5 key order

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
  bulkheads: Record<EdgeKey, BulkheadType> // only explicitly set ones
  nextId: number
}

export const GRID = { width: 40, height: 28 } as const
```

### Catalogue (`src/domain/catalogue.ts`)

`MODULES: Record<ModuleId, ModuleDef>` and `GROUPS: ModuleGroup[]`, built with the same
`corridor()` / `room()` / `rect()` helpers as today, with the same cells and ports. Names:

| Group                   | Id  | en                      | pl                         |
| ----------------------- | --- | ----------------------- | -------------------------- |
| Corridors / Korytarze   | K1  | Straight corridor       | Korytarz prosty            |
|                         | K2  | Corner 90°              | Zakręt 90°                 |
|                         | K3  | T-junction              | Rozgałęzienie T            |
|                         | K4  | Crossing                | Skrzyżowanie               |
|                         | K5  | Diagonal corridor 45°   | Korytarz 45°               |
|                         | K6  | Diagonal transition (R) | Przejście na skos (P)      |
|                         | K7  | Diagonal transition (L) | Przejście na skos (L)      |
|                         | K8  | Diagonal corner         | Zakręt skośny              |
|                         | K9  | End cap                 | Zaślepka                   |
| Habitation / Mieszkalne | M1  | Cabin                   | Kajuta                     |
|                         | M2  | Mess hall               | Mesa                       |
|                         | M3  | Sickbay                 | Ambulatorium               |
| Operations / Operacyjne | O1  | Bridge                  | Mostek                     |
|                         | O2  | Laboratory (short: Lab) | Laboratorium (short: Lab.) |
|                         | O3  | Storage                 | Magazyn                    |
|                         | O4  | Hangar                  | Hangar                     |
| Technical / Techniczne  | T1  | Reactor                 | Reaktor                    |
|                         | T2  | Hydroponics             | Hydroponika                |
|                         | T3  | Airlock                 | Śluza                      |

Bulkhead labels: open → Open passage / Otwarte przejście, door → Door / Drzwi, bulkhead →
Pressure bulkhead / Grodź ciśnieniowa, airlock → Airlock / Śluza powietrzna, welded → Welded
shut / Zaspawane. These live in `src/i18n` as `bulkhead.<type>` keys, not in the catalogue.

`catalogue.test.ts` checks every module has at least one port, every port lies on one of its
cells, and ids match group membership.

### Geometry (`src/domain/geometry.ts`)

`DX`/`DY` tables, `opposite(dir)`, `rotateDir(dir)`, `shape(moduleId, r): Shape` memoized per
`(id, r)` returning `{ cells, ports, ext, w, h }`, identical maths to the current `shape()`.
`edgeKey(x, y, dir): EdgeKey | null`, `edgeCenter(key): [number, number]`,
`placementOffset(id, r)` (the current `centerOff`). Tests cover rotation of an L-shaped room
through four turns and the edge-key normalisation of north/west ports.

### Analysis (`src/domain/analysis.ts`)

```ts
occupancy(plan, ignoreId?): Map<string, number>
canPlace(plan, moduleId, r, x, y, ignoreId?): boolean
analyze(plan): { edges: Map<EdgeKey, { hasRoom: boolean }>, open: OpenPort[], fragments: number }
bulkheadAt(plan, key, info): BulkheadType     // stored, else 'door' if hasRoom else 'open'
pruneBulkheads(plan): Plan                     // drops keys whose edge no longer exists
```

Same union-find connectivity as today. Tests: two corridors facing each other connect; a corridor
facing a wall is an open end; a room-corridor edge defaults to `door`; disconnected pieces count
as fragments; pruning removes a bulkhead after its corridor is deleted.

## 3. Storage

- `repository.ts`: `PlanRepository { load(): Plan | undefined; save(plan: Plan): void }` and
  `StorageError`. Synchronous; there is one plan.
- `schema.ts`: Zod `PlanSchema` with the same compile-time round-trip check against `Plan` as
  `crew-manifest`. `CURRENT_SCHEMA_VERSION = 1`. Piece modules must exist in `MODULES`, `r` in
  0–3, coordinates integers.
- `migrate.ts`: `migrate(raw: unknown): unknown` turns the legacy shape into the current one
  before validation. Legacy is detected by a missing `schemaVersion`: pieces `{ id, t, x, y, r }`
  become `{ id, module, x, y, r }`; `doors` becomes `bulkheads` with values mapped
  `brak→open`, `drzwi→door`, `grodz→bulkhead`, `sluza→airlock`, `spaw→welded`; `nextId` is
  recomputed if missing. Unknown door values are dropped. Tests round-trip the current
  `examples/kestrel-4.json` content in its old form.
- `localStorageRepo.ts`: `STORAGE_KEY = 'deckplan/plan'`, `LEGACY_STORAGE_KEY = 'wy-stacja-v1'`,
  `CORRUPT_BACKUP_KEY = 'deckplan/plan.corrupt'`. `load()` reads the new key; if absent, reads
  the legacy key, migrates, and returns it (the legacy key is left in place; the next `save`
  writes the new key). Unparseable JSON and parseable-but-invalid JSON are both copied to the
  corrupt key (before anything overwrites them), logged, and ignored; the app then starts from
  the sample plan. Constructor takes `{ storage?, logger? }` like `crew-manifest`; `memoryStorage.ts`
  for tests.
- `backup.ts`: `exportPlan(plan): string` (pretty JSON after pruning bulkheads) and
  `importPlan(text): { ok: true; plan } | { ok: false; reason: 'parse' | 'invalid' }`. Import
  runs `migrate` first so old exports and the old example still load.
- Language preference: `deckplan/lang`, handled inside `src/i18n` as in `crew-manifest`.
- localStorage is per origin. A plan saved by the old single-file app (opened from `file://` or
  an artifact host) is not visible to the app served from GitHub Pages; it moves by exporting
  JSON from the old app and pasting it into the new one, which `importPlan` + `migrate` cover.
  The README says so. The legacy-key read stays for the same-origin case.

## 4. i18n

Same module as `crew-manifest`: `en.ts` defines keys and the `Messages` type, `pl.ts` must match
(test), `detectLang(stored, browserLanguage)`, `translate(lang, key, params)`, `lang` signal,
`setLang`, `useT()`, `useLocalize()`. One addition for Polish plural forms: `translatePlural(lang,
key, n)` picks `` `${key}.${new Intl.PluralRules(lang).select(n)}` `` and passes `{ count: n }`,
used for the inspector's "3 cells / 3 pola" line (keys `unit.cell.one|few|many|other`).

Every string in the current UI becomes a key: header buttons, palette group names (from the
catalogue via `useLocalize`), bulkhead names, inspector cards and hints, status bar labels,
toasts, JSON dialog, aria-labels and titles, the default station name of the sample plan
("Kestrel-4 Outpost" / "Placówka Kestrel-4"). `document.documentElement.lang` and
`document.title` follow the language, as in `crew-manifest`.

The language switch is `components/LangSwitch.tsx` copied from `crew-manifest`, placed at the
right end of the header.

## 5. UI

Preact + signals, no router: the app is one screen.

### `store.ts`

Signals: `plan`, `selected: number | null`, `selectedEdge: EdgeKey | null`,
`pending: { module, r } | null` (click-to-place mode), `bulkheadTool: BulkheadType | null`,
`zoom` (index into `ZOOMS`), `drag: DragState | null`, `hoverCell`, `hoverEdge`, `toast`,
`storageError`. `analysis = computed(() => analyze(plan.value))`. Undo `history` is an in-memory
array of JSON snapshots, max 60, as today.

Actions, each `snapshot(); mutate; commit()` where `commit` saves through the repository (errors
become `storageError`, shown as a banner) and sets the signal: `placePiece`, `movePiece`,
`rotateSelected`, `deleteSelected`, `setBulkhead`, `clearPlan`, `undo`, `renameStation`
(no snapshot, as today), `loadPlan`. Selection rules stay: `selected` and `selectedEdge` are
mutually exclusive; starting `pending` or `bulkheadTool` clears both.

`store.test.ts` exercises the actions against `MemoryStorage` and checks undo depth and the
selection rules.

### Pointer and keyboard

`pointer.ts` holds the pure parts: `cellAt(rect, clientX, clientY)`, `nearestEdge(edges, point)`,
and the drag reducer (`beginDrag`, `moveDrag`, `endDrag`) that decides click-vs-drag with the
5px threshold, computes the target cell from the grab offset, and re-centres on rotation. Tested
without a DOM. `Board.tsx` wires them to `pointerdown`/`pointermove`/`pointerup`/`pointercancel`
on `window`, `contextmenu` during a drag (rotate), and keeps the `suppressClick` guard.

`shortcuts.ts` copied from `crew-manifest` (`isTypingTarget`, `shortcutKey`) with the Deckplan
map: `r` rotate (drag, pending, or selected), `Delete`/`Backspace` delete, `1`–`5` bulkhead type
(sets the selected edge, otherwise enters bulkhead mode), `Escape` cancel everything,
`mod+z` undo.

### Components

- `App.tsx`: header (brand, station name input, undo / JSON / clear buttons, `LangSwitch`),
  storage error banner, `<aside>` with `Palette`, `BulkheadPalette`, `Inspector`, `<main>` with
  `StatusBar` and `Board`, plus `JsonDialog` and `Toast`.
- `Board.tsx`: the SVG. `viewBox` is `0 0 40 28` in grid units, `width`/`height` scaled by
  `CELL * ZOOMS[zoom]`. Layers in this order: background, minor and major grid patterns, rooms,
  corridor strokes, corridor hit rects, bulkhead marks and hit rects, open-end markers and
  selection outline, ghost. All drawn from signals; no `innerHTML`.
- `ui/svg/`: `RoomShape`, `CorridorShape`, `BulkheadMark`, `ModuleThumb`, each a function of a
  piece/shape returning JSX, same geometry and stroke widths as today.
- `Palette.tsx`, `BulkheadPalette.tsx`: items are focusable (`role="button"`, Enter/Space
  toggles pending mode), `pointerdown` begins a drag.
- `Inspector.tsx`: the four cards (selected bulkhead, bulkhead mode, selected piece, pending
  piece) and the default hint.
- `StatusBar.tsx`: counts and zoom buttons.
- `JsonDialog.tsx`: textarea with export text, Copy (clipboard with select-text fallback),
  Load (via `importPlan`), Close.
- `Toast.tsx`: 1.8 s message.

### Styles

`app.css` is the current inline CSS moved over, class names kept, with the `.lang-switch` rules
from `crew-manifest` adapted to this palette. Fonts stay as the Google Fonts link in
`index.html`; offline the declared system fallbacks apply.

## 6. PWA, CI, deploy

- `src/pwa/sw.js` copied verbatim; `precache.ts` with `CACHE_PREFIX = 'deckplan-'`; the
  `serviceWorker()` Vite plugin copied into `vite.config.ts`; registration in `main.tsx` in
  production builds only.
- `public/manifest.webmanifest`: name "Deckplan", theme and background `#10181C`, same icon
  entries. `icon.svg`: a dark rounded tile with a grid and an orange (`#D9591A`) T-junction
  corridor; the builder picks any way to rasterise `icon-192.png` and `icon-512.png`
  (`qlmanage`, headless Chrome, or a small Node PNG writer).
- `.github/workflows/ci.yml` and `deploy.yml` copied; concurrency group names unchanged. GitHub
  Pages source is already set to GitHub Actions on the repository; delivery only verifies it.

## 7. Documentation and repository

- `README.md` rewritten in English following `crew-manifest`'s structure: what it is, features,
  running (`npm install`, `dev`, `build`, `preview`), hosted version on GitHub Pages and the
  Add-to-Home-Screen note, checks, keyboard shortcuts table, JSON format (new field names and
  bulkhead values, note that the old format still imports), example plan, licence.
- `CLAUDE.md` rewritten for the new layout: commands, architecture by folder, the mutation
  pattern, direction and edge-key conventions, i18n rules (no hard-coded UI text; `pl.ts` must
  match `en.ts`), the "don't add dependencies" rule.
- `examples/kestrel-4.json` converted to the new format with name "Kestrel-4 Outpost".
- GitHub repository description set to "Browser editor for modular space station deck plans, a
  game master aid for sci-fi tabletop RPGs".
- The old `index.html` is replaced by the Vite entry file.

## Left to the builder

- Exact i18n key names and the split of `app.css` into sections.
- Whether `Board.tsx` is one component or splits the layers into sub-components.
- Icon artwork details and the rasterisation method.
- Order of implementation, as long as domain and storage land with tests before the UI.
