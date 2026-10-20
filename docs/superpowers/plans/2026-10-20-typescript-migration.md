# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the single-file Deckplan editor as a Vite + TypeScript + Preact project with the `crew-manifest` layout, an English/Polish UI, an English saved-plan format with migration, tests, CI, GitHub Pages deploy and offline support, with no change in editor behaviour.

**Architecture:** Pure domain code (`catalogue`, `geometry`, `analysis`) and storage (`schema`, `migrate`, repository, backup) land first with Vitest tests in the node environment. The UI is Preact + `@preact/signals`: one `store` holds the plan, selection and drag state and wraps every write in snapshot/commit; components are thin and the SVG board is JSX derived from signals. Pointer maths and the drag reducer are pure functions tested without a DOM.

**Tech Stack:** Vite 8, TypeScript 5.9, Preact 11, @preact/signals 2, Zod 4, Vitest 5, ESLint 10 + typescript-eslint, Prettier 3, Node 24. Exact versions copied from `../crew-manifest/package.json`.

**Spec:** `docs/superpowers/specs/2026-10-20-typescript-migration-design.md`

## Global Constraints

- Mirror `../crew-manifest` for every config file, script name, ESLint rule, Prettier setting and folder name. Copy, then adapt names. No dependencies beyond its stack.
- Prettier: no semicolons, single quotes, trailing commas, print width 100. `npm run lint` must pass after every task.
- Vitest runs in `node`; tests live next to source as `src/**/*.test.ts`. No DOM test library.
- `domain/` and `storage/` never import from `ui/` (ESLint `no-restricted-imports`).
- All code, comments, commit messages and docs in English. UI strings only via `src/i18n` keys; `pl.ts` must have exactly the keys of `en.ts`.
- Module ids `K1`–`K9`, `M1`–`M3`, `O1`–`O4`, `T1`–`T3` and codes `WY-<id>` unchanged.
- Grid is 40 × 28 cells; `CELL = 34`; `ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5]`, default zoom index 3 (1 on viewports narrower than 760px); undo history max 60.
- Storage keys: `deckplan/plan`, legacy `wy-stacja-v1`, corrupt backup `deckplan/plan.corrupt`, language `deckplan/lang`.
- Bulkhead types in palette and `1`–`5` order: `open`, `door`, `bulkhead`, `airlock`, `welded`.
- The Polish source text for every UI string is in the old app: `git show main:index.html`. Reuse it verbatim.
- Commit after every task with a conventional message (`feat:`, `chore:`, `docs:`, `ci:`) and the `Co-Authored-By: Claude Mythos 5.1 <noreply@anthropic.com>` trailer.

## Review Focus

- Pasted JSON whose pieces overlap or lie outside the 40 × 28 grid: a reasonable person expects "not a plan", not a board with invisible or stacked pieces. Test in Task 6 (`importPlan` rejects).
- Pasted JSON with two pieces sharing an id: selection and deletion would act on the wrong piece. Test in Task 6 (schema rejects duplicate ids).
- Pasted JSON whose `bulkheads` name an edge that does not exist: expected to load with that entry dropped, not to be rejected. Test in Task 6.
- Legacy data with `r` outside 0–3 or non-integer (the old app tolerated it with `(r|0)%4`): expected to load with the rotation normalised. Test in Task 6 (`migrate`).
- Undo right after loading a pasted plan: expected to bring the previous plan back. Test in Task 7.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `.prettierrc.json`, `.prettierignore`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/styles/app.css`
- Delete: the old root `index.html` (replaced by the Vite entry)

**Interfaces:**
- Produces: scripts `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `lint`, `format`; `src/main.tsx` renders `<App />` into `#app`.

- [ ] **Step 1: Copy config files from `../crew-manifest`**

Copy `.nvmrc`, `.gitignore`, `.prettierrc.json`, `.prettierignore`, `tsconfig.json`, `eslint.config.js` unchanged, except: in `eslint.config.js` the restricted-import block lists `src/domain/**` and `src/storage/**` only (no `generator`), and the `src/pwa/sw.js` override stays.

- [ ] **Step 2: Write `package.json`**

Name `deckplan`, version `0.1.0`, `"description": "Browser editor for modular space station deck plans, for Game Masters"`, `"private": true`, `"type": "module"`. Scripts and all dependency/devDependency entries copied verbatim from `../crew-manifest/package.json`.

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  base: './',
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

(The service worker plugin is added in Task 10.)

- [ ] **Step 4: Replace `index.html` with the Vite entry**

`<html lang="en">`, `<meta charset>`, viewport `width=device-width, initial-scale=1, viewport-fit=cover`, `<meta name="theme-color" content="#10181C">`, the two Google Fonts `<link>` tags from the old file (preconnect + stylesheet for Chakra Petch 500/600/700, IBM Plex Sans 400/500/600, IBM Plex Mono 400/500), `<title>Deckplan</title>`, `<div id="app"></div>`, `<script type="module" src="/src/main.tsx"></script>`. Drop the `claude:viewport-fit-sides` meta and the injected first `<style>` block. (Icon and manifest links are added in Task 10.)

- [ ] **Step 5: Write `src/main.tsx`, a placeholder `src/ui/App.tsx` and empty `src/styles/app.css`**

`main.tsx`: import `./styles/app.css`, render `<App />` into `#app` (same shape as crew-manifest, without router, store reload or service worker). `App.tsx`: `export function App()` returning `<h1>Deckplan</h1>`.

- [ ] **Step 6: Install and verify**

Run: `npm install && npm run lint && npm run typecheck && npm test && npm run build`
Expected: lint clean, typecheck clean, Vitest reports "No test files found" with exit code 0 (if it exits non-zero, add `passWithNoTests: true` to `test` in `vite.config.ts` and remove it in Task 2), `dist/index.html` exists.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Preact project"
```

---

### Task 2: Domain types and catalogue

**Files:**
- Create: `src/domain/types.ts`, `src/domain/catalogue.ts`, `src/domain/catalogue.test.ts`

**Interfaces:**
- Produces: every type from spec §2 (`Lang`, `LANGS`, `Localized`, `Dir`, `Rotation`, `Cell`, `Port`, `ModuleId`, `RoomClass`, `ModuleDef`, `ModuleGroup`, `BulkheadType`, `BULKHEAD_TYPES`, `EdgeKey`, `Piece`, `Plan`, `GRID`); `MODULES: Readonly<Record<ModuleId, ModuleDef>>`, `GROUPS: readonly ModuleGroup[]`, `moduleDef(id: ModuleId): ModuleDef` (throws on unknown id), `isModuleId(value: unknown): value is ModuleId`.

- [ ] **Step 1: Write `src/domain/types.ts`**

Exactly the declarations in spec §2 "Types". `BULKHEAD_TYPES = ['open', 'door', 'bulkhead', 'airlock', 'welded'] as const`.

- [ ] **Step 2: Write the failing test `src/domain/catalogue.test.ts`**

```ts
describe('catalogue', () => {
  it('has 19 modules in 4 groups and every group member exists', ...)
    // GROUPS.flatMap(g => g.modules).sort() equals Object.keys(MODULES).sort(); length 19
  it('every port and ext lies on one of the module cells', ...)
  it('every module has at least one port', ...)
  it('rooms have a class and a short label, corridors have neither', ...)
  it('moduleDef throws on an unknown id and isModuleId rejects it', ...)
  it('keeps the legacy shapes', () => {
    expect(MODULES.O2.cells).toEqual([[0, 0], [1, 0], [0, 1]])
    expect(MODULES.T1.ports).toEqual([[0, 3, 4], [1, 0, 0]])
    expect(MODULES.T3.ext).toEqual([[0, 0, 0]])
    expect(MODULES.K8.ports).toEqual([[0, 0, 1], [0, 0, 7]])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/domain/catalogue.test.ts`
Expected: FAIL, cannot resolve `./catalogue`.

- [ ] **Step 4: Write `src/domain/catalogue.ts`**

Helpers `corridor(id, name: Localized, dirs: Dir[])`, `room(id, name, cls, short, cells, ports, ext = [])`, `rect(w, h)`, `group(id, label, defs)`. Data is the old `index.html` catalogue with the names from the spec §2 table: corridor port dirs K1 `[0,4]`, K2 `[0,2]`, K3 `[0,2,4]`, K4 `[0,2,4,6]`, K5 `[1,5]`, K6 `[4,1]`, K7 `[4,7]`, K8 `[1,7]`, K9 `[4]`; rooms M1 `[[0,0]]`/`[[0,0,4]]`, M2 `rect(3,2)`/`[[1,1,4],[0,0,6],[2,0,2]]`, M3 `rect(2,2)`/`[[0,1,4],[0,0,6]]`, O1 `rect(3,2)`/`[[1,1,4]]`, O2 `[[0,0],[1,0],[0,1]]`/`[[0,1,4],[1,0,2]]`, O3 `rect(2,1)`/`[[0,0,4]]`, O4 `rect(4,2)`/`[[0,1,4],[3,1,4]]`, T1 `rect(2,4)`/`[[0,3,4],[1,0,0]]`, T2 `rect(4,1)`/`[[0,0,6],[3,0,2]]`, T3 `[[0,0]]`/`[[0,0,4]]`/ext `[[0,0,0]]`. `short` equals `name` except O2 (`Lab` / `Lab.`). Group ids `corridors`, `habitation`, `operations`, `technical` with labels Corridors/Korytarze, Habitation/Mieszkalne, Operations/Operacyjne, Technical/Techniczne. `code` is `` `WY-${id}` ``.

- [ ] **Step 5: Run tests, lint**

Run: `npx vitest run src/domain/catalogue.test.ts && npm run lint && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat(domain): add plan types and module catalogue"
```

---

### Task 3: Geometry

**Files:**
- Create: `src/domain/geometry.ts`, `src/domain/geometry.test.ts`

**Interfaces:**
- Consumes: `MODULES`, `moduleDef` (Task 2).
- Produces: `DX: readonly number[]`, `DY: readonly number[]` (index = `Dir`, north first, clockwise), `opposite(d: Dir): Dir`, `rotateDir(d: Dir): Dir` (+2 mod 8), `nextRotation(r: Rotation): Rotation`, `interface Shape { cells: Cell[]; ports: Port[]; ext: Port[]; w: number; h: number }`, `shape(id: ModuleId, r: Rotation): Shape` (memoized), `edgeKey(x: number, y: number, d: Dir): EdgeKey | null`, `edgeCenter(key: EdgeKey): [number, number]`, `portPoint(x: number, y: number, d: Dir): [number, number]` (cell centre plus half a cell towards `d`), `placementOffset(id: ModuleId, r: Rotation): [number, number]` (`[floor((w-1)/2), floor((h-1)/2)]`).

- [ ] **Step 1: Write the failing test**

```ts
it('rotates an L-shaped room clockwise', () => {
  const s = shape('O2', 1)
  expect(s.w).toBe(2); expect(s.h).toBe(2)
  expect(s.cells).toEqual([[1, 0], [1, 1], [0, 0]])
  expect(s.ports).toEqual([[0, 0, 6], [1, 1, 4]])
})
it('rotates corridor ports', () => {
  expect(shape('K1', 1).ports.map((p) => p[2])).toEqual([2, 6])
  expect(shape('K1', 3).ports.map((p) => p[2])).toEqual([6, 2])
  expect(shape('T3', 2).ext).toEqual([[0, 0, 4]])
})
it('returns the same object for the same id and rotation', ...)   // memoization
it('normalises north and west ports to the neighbouring S/E edge', () => {
  expect(edgeKey(5, 5, 2)).toBe('5,5,E'); expect(edgeKey(5, 5, 4)).toBe('5,5,S')
  expect(edgeKey(5, 5, 0)).toBe('5,4,S'); expect(edgeKey(5, 5, 6)).toBe('4,5,E')
  expect(edgeKey(5, 5, 1)).toBeNull()
})
it('edge centre and port point', () => {
  expect(edgeCenter('5,5,E')).toEqual([6, 5.5]); expect(edgeCenter('5,5,S')).toEqual([5.5, 6])
  expect(portPoint(2, 3, 2)).toEqual([3, 3.5])
})
it('placement offset centres the ghost', () => {
  expect(placementOffset('O4', 0)).toEqual([1, 0]); expect(placementOffset('T1', 1)).toEqual([1, 0])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/geometry.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/domain/geometry.ts`**

Rotation: for each of `r` turns, `rot = ([x, y]) => [h - 1 - y, x]`, ports/ext get `rotateDir`, then swap `w`/`h`. Cache key `` `${id}|${r}` ``.

- [ ] **Step 4: Run tests and lint** — Expected: PASS, clean.

- [ ] **Step 5: Commit** — `feat(domain): add shape rotation and edge geometry`

---

### Task 4: Analysis

**Files:**
- Create: `src/domain/analysis.ts`, `src/domain/analysis.test.ts`, `src/domain/testing.ts`, `src/domain/sample.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 3 `shape`, `edgeKey`, `DX`, `DY`, `opposite`.
- Produces:
  - `occupancy(plan: Plan, ignoreId?: number): Map<string, number>` keyed `"x,y"`.
  - `canPlace(plan: Plan, id: ModuleId, r: Rotation, x: number, y: number, ignoreId?: number): boolean`.
  - `interface EdgeInfo { hasRoom: boolean }`, `interface OpenPort { x: number; y: number; dir: Dir; room: boolean }`, `interface Analysis { edges: Map<EdgeKey, EdgeInfo>; open: OpenPort[]; fragments: number }`, `analyze(plan: Plan): Analysis`.
  - `bulkheadAt(plan: Plan, key: EdgeKey, info: EdgeInfo): BulkheadType`.
  - `pruneBulkheads(plan: Plan): Plan` (new object; unchanged keys kept).
  - `testing.ts`: `makePlan(pieces: Omit<Piece, 'id'>[], bulkheads?: Plan['bulkheads']): Plan` assigning ids 1..n.
  - `sample.ts`: `samplePlan(name: string): Plan` — the 21 pieces and 3 bulkheads of the old `sample()`, with `module` instead of `t` and `bulkheads: { '7,8,S': 'bulkhead', '16,5,S': 'airlock', '3,9,S': 'bulkhead' }`, `nextId: 22`, `schemaVersion: 1`.

- [ ] **Step 1: Write the failing test**

```ts
it('connects two facing corridors on one edge', () => {
  const plan = makePlan([{ module: 'K1', x: 0, y: 0, r: 1 }, { module: 'K1', x: 1, y: 0, r: 1 }])
  const a = analyze(plan)
  expect([...a.edges.keys()]).toEqual(['0,0,E']); expect(a.edges.get('0,0,E')).toEqual({ hasRoom: false })
  expect(a.open).toHaveLength(2); expect(a.fragments).toBe(1)
})
it('counts a port facing the grid edge as open', ...)        // K1 r=0 at 0,0 → open length 2
it('room to corridor edge defaults to door, corridor to corridor to open', () => {
  const plan = makePlan([{ module: 'M1', x: 0, y: 0, r: 0 }, { module: 'K1', x: 0, y: 1, r: 0 }])
  const a = analyze(plan)
  expect(bulkheadAt(plan, '0,0,S', a.edges.get('0,0,S')!)).toBe('door')
  expect(a.open).toEqual([{ x: 0, y: 1, dir: 4, room: false }])
})
it('uses the stored bulkhead when set', ...)
it('counts detached fragments', ...)                          // two K1 far apart → fragments 2
it('canPlace rejects off-grid and overlap, allows own cells via ignoreId', ...)
it('pruneBulkheads drops keys without an edge and keeps the rest', ...)
it('samplePlan is placeable and connected', () => {
  const a = analyze(samplePlan('X'))
  expect(a.fragments).toBe(1); expect(a.edges.size).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/domain/analysis.test.ts`

- [ ] **Step 3: Implement**

`analyze`: build `portMap` keyed `"x,y,d"` → piece id; union-find over piece ids; for each port look up the neighbour `(x+DX[d], y+DY[d], opposite(d))`; a match with a different piece unions them and records `edgeKey` (skip null) with `hasRoom`; no match pushes an `OpenPort`. `fragments` = number of roots (0 for an empty plan).

- [ ] **Step 4: Run tests and lint** — PASS, clean.

- [ ] **Step 5: Commit** — `feat(domain): add placement and connectivity analysis`

---

### Task 5: i18n

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/pl.ts`, `src/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `Lang`, `LANGS`, `Localized` (Task 2).
- Produces: as `../crew-manifest/src/i18n/index.ts` (`MessageKey`, `Messages`, `Params`, `TFunction`, `isLang`, `detectLang`, `translate`, `lang` signal, `setLang`, `useT`, `useLocalize`) with `STORAGE_KEY = 'deckplan/lang'`, plus `translatePlural(l: Lang, key: string, n: number): string` which translates `` `${key}.${new Intl.PluralRules(l).select(n)}` `` with `{ count: n }`, and `usePlural(): (key: string, n: number) => string`.

- [ ] **Step 1: Write the failing test**

Copy `../crew-manifest/src/i18n/i18n.test.ts` (keys-match and `detectLang` cases) and add:

```ts
it('picks Polish plural forms', () => {
  expect(translatePlural('pl', 'unit.cell', 1)).toBe('1 pole')
  expect(translatePlural('pl', 'unit.cell', 3)).toBe('3 pola')
  expect(translatePlural('pl', 'unit.cell', 5)).toBe('5 pól')
  expect(translatePlural('en', 'unit.cell', 1)).toBe('1 cell')
  expect(translatePlural('en', 'unit.cell', 2)).toBe('2 cells')
})
```

- [ ] **Step 2: Run to verify fail**

- [ ] **Step 3: Write `en.ts`, `pl.ts`, `index.ts`**

`index.ts` is crew-manifest's file with the storage key changed and `translatePlural`/`usePlural` added. `en.ts` keys and English copy (Polish copy from `git show main:index.html`):

| key | en |
| --- | --- |
| `app.title` | Deckplan |
| `lang.label` | Language |
| `header.stationName` | Station name |
| `header.undo` / `header.undoTitle` | Undo / Undo (Ctrl+Z) |
| `header.json` | Save / load JSON |
| `header.clear` | Clear plan |
| `storage.writeError` | Could not save to browser storage. Copy the JSON before closing this tab. |
| `palette.bulkheads` | Bulkheads |
| `palette.bulkheadHint` | A bulkhead sits on a connection: where a corridor meets a room or another corridor. Pick a type and click the connections marked with circles, or drag a type onto a connection. Keys 1–5 pick a type. |
| `palette.selection` | Selection |
| `bulkhead.open` / `.door` / `.bulkhead` / `.airlock` / `.welded` | Open passage / Door / Pressure bulkhead / Airlock / Welded shut |
| `bulkhead.title` | {name} (click to change) |
| `inspector.connectionRoom` / `inspector.connectionCorridor` | room – corridor connection / corridor – corridor connection |
| `inspector.placingBulkhead` | Placing: {name} |
| `inspector.placingBulkheadHint` | Click a connection marked with a circle. You can keep clicking. Esc finishes. |
| `inspector.finish` / `inspector.cancel` | Finish / Cancel |
| `inspector.rotate` / `inspector.delete` | Rotate 90° / Delete |
| `inspector.rotation` | rotation {deg}° |
| `inspector.placeHint` | Click the grid to place it. R rotates, Esc cancels. |
| `inspector.defaultHint` | Drag a module from the catalogue onto the grid, or click it and pick a spot. Click an element on the plan to select it. R rotates while dragging. Click a bulkhead on the plan to change its type. |
| `unit.cell.one` / `.few` / `.many` / `.other` | {count} cell / {count} cells / {count} cells / {count} cells (pl: {count} pole / {count} pola / {count} pól / {count} pola) |
| `status.rooms` / `.corridors` / `.cells` / `.openEnds` / `.fragments` | Rooms / Corridors / Cells / Open ends / Detached fragments |
| `status.zoomOut` / `status.zoomIn` | Zoom out / Zoom in |
| `toast.noFit` | It does not fit here: cell taken or outside the plan. |
| `toast.noFitShort` | It does not fit here. |
| `toast.noRotate` | No room to rotate. Move the module and try again. |
| `toast.dropOnConnection` | Drop the bulkhead on a connection marked with a circle. |
| `toast.noConnection` | No connection here. Click a circle between two modules. |
| `toast.cleared` | Plan cleared. "Undo" brings it back. |
| `toast.copied` | JSON copied. |
| `toast.selectedText` | Text selected. Copy it with the keyboard shortcut. |
| `toast.loaded` | Plan loaded. |
| `toast.invalidJson` | Not a plan. Check that the pasted text is the whole JSON. |
| `dialog.title` | Station plan as JSON |
| `dialog.hint` | Copy the text to keep the plan. To load another plan, paste its JSON and choose "Load". |
| `dialog.copy` / `dialog.load` / `dialog.close` | Copy / Load / Close |
| `sample.name` | Kestrel-4 Outpost (pl: Placówka Kestrel-4) |

- [ ] **Step 4: Run tests and lint** — PASS, clean.

- [ ] **Step 5: Commit** — `feat(i18n): add English and Polish dictionaries`

---

### Task 6: Storage

**Files:**
- Create: `src/storage/repository.ts`, `src/storage/schema.ts`, `src/storage/schema.test.ts`, `src/storage/migrate.ts`, `src/storage/migrate.test.ts`, `src/storage/memoryStorage.ts`, `src/storage/localStorageRepo.ts`, `src/storage/localStorageRepo.test.ts`, `src/storage/backup.ts`, `src/storage/backup.test.ts`
- Modify: `examples/kestrel-4.json` (convert to the new format, name `Kestrel-4 Outpost`)

**Interfaces:**
- Consumes: `Plan`, `BULKHEAD_TYPES`, `isModuleId` (Task 2); `canPlace`, `analyze`, `pruneBulkheads`, `makePlan`, `samplePlan` (Task 4).
- Produces:
  - `repository.ts`: `interface PlanRepository { load(): Plan | undefined; save(plan: Plan): void }`, `class StorageError extends Error`.
  - `schema.ts`: `CURRENT_SCHEMA_VERSION = 1`, `PlanSchema` (Zod; `module` refined with `isModuleId`, `r` in 0–3, integer coords, `nextId` integer, `bulkheads` record of `BULKHEAD_TYPES`, piece ids unique), `parsePlan(raw: unknown): Plan` (throws `ZodError`), the compile-time round-trip check from crew-manifest.
  - `migrate.ts`: `migrate(raw: unknown): unknown` — if `raw` is an object without `schemaVersion`: rename `t`→`module`, `doors`→`bulkheads` mapping `brak→open, drzwi→door, grodz→bulkhead, sluza→airlock, spaw→welded` (unknown values dropped), `r` → `((r | 0) % 4 + 4) % 4`, `nextId` → `max(ids) + 1` when missing, add `schemaVersion: 1`. Anything else returned untouched.
  - `memoryStorage.ts`: copy of crew-manifest's `MemoryStorage`.
  - `localStorageRepo.ts`: `STORAGE_KEY`, `LEGACY_STORAGE_KEY`, `CORRUPT_BACKUP_KEY`, `class LocalStorageRepo implements PlanRepository` with constructor `{ storage?: Storage | undefined; logger?: Pick<Console, 'warn'> }` (default `safeLocalStorage()`).
  - `backup.ts`: `exportPlan(plan: Plan): string` (`JSON.stringify(pruneBulkheads(plan), null, 1)`), `type ImportResult = { ok: true; plan: Plan } | { ok: false; reason: 'parse' | 'invalid' }`, `importPlan(text: string): ImportResult`.

- [ ] **Step 1: Write the failing tests**

`schema.test.ts`: accepts `samplePlan('X')`; rejects unknown module, `r: 4`, non-integer `x`, unknown bulkhead value, duplicate piece ids.

`migrate.test.ts`: the legacy example (inline fixture: the current `examples/kestrel-4.json` content before conversion, pieces with `t`, `doors` `{ '7,8,S': 'grodz', '16,5,S': 'sluza', '3,9,S': 'grodz' }`) migrates to a plan that `parsePlan` accepts, with `bulkheads` `{ '7,8,S': 'bulkhead', '16,5,S': 'airlock', '3,9,S': 'bulkhead' }` and `nextId: 22`; `r: 5` becomes `1`, `r: -1` becomes `3`, `r: 1.7` becomes `1`; unknown door value `'xyz'` is dropped; a current-format object passes through unchanged (`toBe` identity).

`localStorageRepo.test.ts` (using `MemoryStorage`): `load()` returns `undefined` on empty storage; `save` then `load` round-trips under `deckplan/plan`; a legacy value under `wy-stacja-v1` loads migrated and the legacy key is left in place; unparseable JSON under `deckplan/plan` is copied to `deckplan/plan.corrupt`, logged, and `load()` returns `undefined`; parseable-but-invalid JSON likewise; `storage: undefined` → `load()` undefined and `save()` throws `StorageError`; `setItem` throwing → `save()` throws `StorageError`.

`backup.test.ts`: `exportPlan` output parses back to the plan with dangling bulkheads removed; `importPlan('nope')` → `{ ok: false, reason: 'parse' }`; `importPlan('{"pieces":1}')` → `invalid`; legacy example text imports (`ok: true`, same assertions as the migrate test); overlapping pieces → `invalid`; a piece at `x: 40` → `invalid`; a bulkhead on a non-existent edge is dropped, `ok: true`.

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/storage`

- [ ] **Step 3: Implement the five source files**

`LocalStorageRepo.load()`: read `STORAGE_KEY`; if null read `LEGACY_STORAGE_KEY`; if both null return `undefined`; `JSON.parse` (on failure: write raw to corrupt key, warn, return undefined); `parsePlan(migrate(parsed))` (on failure: same). `save()`: throw `StorageError` when storage is undefined or `setItem` throws.

`importPlan`: parse (→ `parse`), `migrate`, `parsePlan` (→ `invalid`), then reject as `invalid` if any piece fails `canPlace` against a plan of the other pieces, then return `pruneBulkheads(plan)`.

- [ ] **Step 4: Convert `examples/kestrel-4.json`**

Run a one-off `npx tsx`/`node` script that reads the file, applies `migrate`, sets `name` to `Kestrel-4 Outpost`, and writes `exportPlan(parsePlan(...))` to it. Add to `backup.test.ts`: `importPlan(readFileSync('examples/kestrel-4.json', 'utf8'))` is `ok: true` with 21 pieces and `bulkheads['16,5,S'] === 'airlock'`.

- [ ] **Step 5: Run tests and lint** — `npm test && npm run lint && npm run typecheck` PASS.

- [ ] **Step 6: Commit** — `feat(storage): add plan schema, legacy migration, repository and JSON backup`

---

### Task 7: UI store

**Files:**
- Create: `src/ui/store.ts`, `src/ui/store.test.ts`

**Interfaces:**
- Consumes: Task 2–6 exports; `MessageKey`, `Params`, `lang`, `translate` (Task 5).
- Produces: `CELL`, `ZOOMS`, `HISTORY_LIMIT = 60`;

```ts
export type DragState =
  | { kind: 'new'; module: ModuleId; r: Rotation; off: [number, number]; sx: number; sy: number; moved: boolean; over: boolean; gx: number; gy: number }
  | { kind: 'move'; id: number; module: ModuleId; r: Rotation; off: [number, number]; sx: number; sy: number; moved: boolean; over: boolean; gx: number; gy: number }
  | { kind: 'bulkhead'; type: BulkheadType; sx: number; sy: number; moved: boolean; edge: EdgeKey | null }

export interface Store {
  plan: Signal<Plan>; analysis: ReadonlySignal<Analysis>; canUndo: Signal<boolean>
  selected: Signal<number | null>; selectedEdge: Signal<EdgeKey | null>
  pending: Signal<{ module: ModuleId; r: Rotation } | null>; bulkheadTool: Signal<BulkheadType | null>
  zoom: Signal<number>; drag: Signal<DragState | null>; hoverCell: Signal<Cell | null>; hoverEdge: Signal<EdgeKey | null>
  toast: Signal<{ id: number; key: MessageKey; params?: Params } | null>; storageError: Signal<boolean>
  placePiece(module: ModuleId, r: Rotation, x: number, y: number): boolean   // false + toast.noFit
  movePiece(id: number, x: number, y: number, r: Rotation): boolean          // false + toast.noFitShort; prunes bulkheads
  rotateSelected(): void            // toast.noRotate when blocked
  deleteSelected(): void
  setBulkhead(key: EdgeKey, type: BulkheadType): void   // ignored when key not in analysis.edges; toasts bulkhead.<type>
  clearPlan(): void                 // no-op on empty plan; toast.cleared
  undo(): void
  renameStation(name: string): void // persists, no snapshot
  loadPlan(plan: Plan): void        // snapshot, replace, clear selection
  selectPiece(id: number | null): void; selectEdge(key: EdgeKey | null): void
  togglePending(module: ModuleId): void; rotatePending(): void; toggleBulkheadTool(type: BulkheadType): void
  cancelAll(): void                 // drag, pending, selection, bulkhead tool, hover edge
  zoomIn(): void; zoomOut(): void; showToast(key: MessageKey, params?: Params): void
}
export function createStore(repo: PlanRepository, sampleName: () => string, initialZoom?: number): Store
export const store: Store   // createStore(new LocalStorageRepo(), () => translate(lang.value, 'sample.name'), window.innerWidth < 760 ? 1 : 3)
```

- [ ] **Step 1: Write the failing test**

Use `createStore(new LocalStorageRepo({ storage: new MemoryStorage() }), () => 'Sample')`.

```ts
it('starts from the sample plan when storage is empty', ...)        // plan.value.name === 'Sample', 21 pieces
it('placePiece adds, selects and persists; refuses an occupied cell', ...)   // second placePiece on same cell → false, toast key 'toast.noFit'
it('rotateSelected refuses when blocked and toasts', ...)
it('setBulkhead ignores unknown edges and stores known ones', ...)
it('undo restores the previous plan and is capped at 60 snapshots', ...)
it('undo after loadPlan brings the previous plan back', ...)
it('selection rules: pending clears selection, selecting an edge clears the piece', ...)
it('movePiece prunes bulkheads that lost their edge', ...)
it('storageError is set when save throws and cleared on the next success', ...)  // storage whose setItem throws once
```

- [ ] **Step 2: Run to verify fail**

- [ ] **Step 3: Implement `createStore`**

Private `snapshot()` pushes `JSON.stringify(plan.value)` and trims to 60; `commit(next: Plan)` sets `plan.value = next` then `repo.save(next)` inside try/catch setting `storageError`. Plan updates are immutable (`{ ...plan, pieces: [...] }`). `toast` ids increment so the same message twice re-triggers the component timer.

- [ ] **Step 4: Run tests and lint** — PASS, clean.

- [ ] **Step 5: Commit** — `feat(ui): add editor store with undo and persistence`

---

### Task 8: Pointer maths and shortcuts

**Files:**
- Create: `src/ui/pointer.ts`, `src/ui/pointer.test.ts`, `src/ui/shortcuts.ts`, `src/ui/shortcuts.test.ts`

**Interfaces:**
- Consumes: `DragState` (Task 7), `edgeCenter`, `placementOffset`, `nextRotation` (Task 3), `GRID`.
- Produces:

```ts
export interface Point { x: number; y: number }
export interface Box { left: number; top: number; right: number; bottom: number; width: number; height: number }
export const DRAG_THRESHOLD = 5
export const EDGE_SNAP = 0.6
export function cellAt(board: Box, wrap: Box, p: Point): Cell | null      // null outside either box
export function nearestEdge(board: Box, edges: Iterable<EdgeKey>, p: Point): EdgeKey | null
export function beginNewDrag(module: ModuleId, r: Rotation, p: Point): DragState
export function beginMoveDrag(piece: Piece, grabCell: Cell, p: Point): DragState
export function beginBulkheadDrag(type: BulkheadType, p: Point): DragState
export function moveDrag(drag: DragState, p: Point, cell: Cell | null, edge: EdgeKey | null): DragState
export function rotateDrag(drag: DragState): DragState   // 'new': re-centre on the new offset; 'move': rotation only; 'bulkhead': unchanged
export type DropOutcome =
  | { kind: 'click' }
  | { kind: 'place'; module: ModuleId; r: Rotation; x: number; y: number }
  | { kind: 'move'; id: number; x: number; y: number; r: Rotation }
  | { kind: 'bulkhead'; type: BulkheadType; edge: EdgeKey | null }
  | { kind: 'cancel' }
export function resolveDrop(drag: DragState): DropOutcome
```

`shortcuts.ts`: `isTypingTarget` and `shortcutKey` copied from crew-manifest with `mod+z` instead of `mod+s`.

- [ ] **Step 1: Write the failing tests**

```ts
it('cellAt maps client coordinates to grid cells and rejects points outside the wrapper', ...)
it('nearestEdge snaps within 0.6 cells and not beyond', ...)
it('a move under 5px keeps moved=false, over it sets moved and the target cell', ...)
it('rotateDrag on a new drag keeps the ghost centred', () => {
  // O4 (4x2) grabbed at off [1,0] over cell (10,10): gx=9, gy=10; after rotate (2x4) off [0,1]: gx=10, gy=9
})
it('resolveDrop: unmoved → click; moved over grid → place/move; bulkhead → edge or null; moved outside → cancel', ...)
```

`shortcuts.test.ts`: copy crew-manifest's cases, replacing `mod+s` with `mod+z`.

- [ ] **Step 2: Run to verify fail**

- [ ] **Step 3: Implement** — `cellAt` uses `floor((p.x - board.left) / board.width * GRID.width)`; `moveDrag` for piece drags sets `over = cell !== null` and `gx = cell.x - off[0]`, `gy = cell.y - off[1]`; for bulkhead drags sets `edge`.

- [ ] **Step 4: Run tests and lint** — PASS, clean.

- [ ] **Step 5: Commit** — `feat(ui): add pure pointer and shortcut helpers`

---

### Task 9: Components and styles

**Files:**
- Create: `src/ui/svg/RoomShape.tsx`, `src/ui/svg/CorridorLayer.tsx`, `src/ui/svg/BulkheadMark.tsx`, `src/ui/svg/ModuleThumb.tsx`, `src/ui/svg/Ghost.tsx`, `src/ui/Board.tsx`, `src/ui/Palette.tsx`, `src/ui/BulkheadPalette.tsx`, `src/ui/Inspector.tsx`, `src/ui/StatusBar.tsx`, `src/ui/JsonDialog.tsx`, `src/ui/Toast.tsx`, `src/ui/components/LangSwitch.tsx`
- Modify: `src/ui/App.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes: `store` (Task 7), pointer and shortcut helpers (Task 8), `useT`, `useLocalize`, `usePlural`, `lang` (Task 5), svg geometry (Task 3), `exportPlan`/`importPlan` (Task 6).
- Produces: a working app at `npm run dev`.

Component contracts (props only; each renders what the old `index.html` rendered for the same state):

- `RoomShape({ piece, shape, thumb?: boolean })` — cell rects filled `var(--<cls>)`, outer wall path, ext dashed yellow lines, port gaps, and (unless `thumb`) the `short` label (Chakra Petch) and `code` (IBM Plex Mono) centred on the cell centroid.
- `CorridorLayer({ pieces })` — one `<g pointer-events="none">` with every corridor's outer stroke (`var(--corr-edge)`, width .5) and centre dot, then every inner stroke (`var(--corr)`, width .38) and dot; followed by a `<g>` of transparent 1×1 hit rects `data-id`.
- `BulkheadMark({ edge, type, hasRoom })` — the mark per type exactly as `doorSVG` plus the transparent hit rect with `data-edge` and `<title>` from `bulkhead.title`.
- `ModuleThumb({ id })` — `<svg viewBox="-.08 -.08 w+.16 h+.16">` of the rotation-0 shape.
- `Ghost()` — reads `store.drag`, `store.pending`, `store.hoverCell`, `store.hoverEdge`, `store.bulkheadTool`: bulkhead mode shows a circle on every edge (filled on the active one); piece drags and pending mode show the module at 75% opacity with green/red cell overlays from `canPlace`.
- `Board()` — the `<svg id="board">` with `viewBox="0 0 40 28"`, width/height `GRID * CELL * ZOOMS[zoom]`, class `doormode` when `bulkheadTool` is set; layers: background, `g1`/`g5` grid patterns, rooms (`<g class="piece" data-id>`), `CorridorLayer`, bulkheads, open-end marks (room ports: hollow muted circle r .07; corridor ports: red filled r .11), selection outline (dashed accent rects per cell), selected-edge ring, `Ghost`. Pointer wiring per the old handlers: `pointerdown` on the board (bulkhead mode → `nearestEdge` → `setBulkhead` or `toast.noConnection`; `[data-edge]` → `selectEdge`; `[data-id]` → `beginMoveDrag`), `window` `pointermove`/`pointerup`/`pointercancel`, board `click` for pending placement and deselect with the `suppressClick` guard, `pointerleave` clears `hoverCell`, `contextmenu` during a moved drag rotates it.
- `Palette()` — groups from `GROUPS` with `useLocalize` labels; items `role="button" tabindex=0 aria-label title` with `ModuleThumb`, name and code; `pointerdown` → `beginNewDrag` (rotation taken from `pending` when the same module is pending); Enter/Space → `togglePending`; class `active` when pending.
- `BulkheadPalette()` — the five items with the inline 28×14 icons from the old `buildPalette`, `pointerdown` → `beginBulkheadDrag`, Enter/Space → `toggleBulkheadTool`, hint paragraph below.
- `Inspector()` — the four cards and default hint; bulkhead buttons show `<kbd>{i+1}</kbd>`; rotate/delete buttons show `<kbd>R</kbd>` / `<kbd>Del</kbd>`; the cells line uses `usePlural()('unit.cell', n)`.
- `StatusBar()` — rooms, corridors, cells, open ends (`warn` when > 0), detached fragments (`fragments - 1`, `warn` when > 0, 0 for an empty plan), zoom buttons.
- `JsonDialog({ open, onClose })` — textarea prefilled with `exportPlan(store.plan.value)` when opened; Copy (clipboard, fallback selects text), Load (`importPlan` → `loadPlan` + `toast.loaded`, else `toast.invalidJson`), Close. Hidden with the `hidden` attribute when closed.
- `Toast()` — shows `store.toast` for 1800 ms, re-triggered by `id`.
- `LangSwitch()` — copied from crew-manifest.
- `App()` — header (brand, station name `<input>` bound to `renameStation` on `change`, Undo (disabled when `!canUndo`), JSON, Clear, `LangSwitch`), error banner when `storageError`, aside (`Palette`, bulkheads section, selection section), main (`StatusBar`, `#boardWrap` > `Board`), `JsonDialog`, `Toast`; a `useEffect` sets `document.documentElement.lang` and `document.title`; a `window` `keydown` listener maps `shortcutKey` to store actions (`r`: rotate drag / pending / selected; `delete`/`backspace`; `1`–`5`; `escape`; `mod+z`).

- [ ] **Step 1: Move the CSS**

Copy the second `<style>` block of the old `index.html` into `src/styles/app.css`, keep the first block's `[hidden]`, `img`, safe-area rules, and add `.lang-switch` rules adapted from crew-manifest (`button[aria-pressed="true"]` uses `var(--accent)`).

- [ ] **Step 2: Write the svg helpers, then `Board`, then the side panels, then `App`**

Geometry constants (stroke widths, radii, font sizes) are copied from the old functions `corrStrokes`, `roomSVG`, `doorSVG`, `render`, `renderGhost`.

- [ ] **Step 3: Verify by hand with the dev server**

Run: `npm run dev` and in the browser check, in both languages: drag a module, click-to-place with `R`, bulkhead placement by click and by drag, `1`–`5`, `Esc`, `Delete`, undo, zoom, JSON copy and load of `examples/kestrel-4.json` and of the legacy example text, phone layout at 600px, dark theme, language switch persists after reload. Open the console: no errors.

- [ ] **Step 4: Run checks** — `npm run lint && npm run typecheck && npm test && npm run build` clean.

- [ ] **Step 5: Commit** — `feat(ui): port the editor to Preact components`

---

### Task 10: PWA

**Files:**
- Create: `src/pwa/sw.js`, `src/pwa/precache.ts`, `src/pwa/precache.test.ts`, `public/manifest.webmanifest`, `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`
- Modify: `vite.config.ts`, `src/main.tsx`, `index.html`

- [ ] **Step 1: Copy `sw.js`, `precache.ts`, `precache.test.ts` from crew-manifest** with `CACHE_PREFIX = 'deckplan-'`; adjust the test's expected prefix.

- [ ] **Step 2: Run the test** — PASS.

- [ ] **Step 3: Add the `serviceWorker()` plugin to `vite.config.ts`** (copied, plugin name `deckplan:service-worker`), register `./sw.js` in `main.tsx` under `import.meta.env.PROD`.

- [ ] **Step 4: Manifest and icons**

`manifest.webmanifest`: name/short_name `Deckplan`, description `Space station deck plan editor`, `start_url`/`scope` `./`, `display: standalone`, colours `#10181C`, same four icon entries as crew-manifest. `icon.svg`: 512×512, rounded square `#10181C`, faint 8×8 grid lines `#26373F`, a T-junction corridor in `#D9591A` three cells wide. Rasterise: `qlmanage -t -s 512 -o /tmp/x public/icon.svg` then rename, and the same with `-s 192` (fallback: open the SVG in Chrome via the `claude-in-chrome` tools and screenshot, or a small Node PNG writer). Add `<link rel="icon">`, `<link rel="apple-touch-icon">`, `<link rel="manifest">` to `index.html`.

- [ ] **Step 5: Verify** — `npm run build && ls dist/sw.js dist/manifest.webmanifest dist/icon-512.png`; `grep -c precache dist/sw.js` ≥ 1; `npm run preview` loads and the Application tab shows the service worker registered.

- [ ] **Step 6: Commit** — `feat(pwa): add offline service worker, manifest and icons`

---

### Task 11: CI, deploy, docs, repository

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Copy both workflows from crew-manifest unchanged.**

- [ ] **Step 2: Rewrite `README.md` in English** with these sections, in crew-manifest's style: intro (what it is, who for, browser-only, localStorage, EN/PL); Features (the bullet list from the old README, translated); Running (Node 24, `npm install`, `dev`, `build`, `preview`, note that `dist/` must be served over HTTP, checks command); Hosted version (`https://lukaszlenart.github.io/deckplan/`, deploy workflow, Add to Home Screen note, "plans live only on the device; move them with the JSON dialog"); Keyboard shortcuts table; Plan format (JSON example with `schemaVersion`, `module`, `bulkheads`; field descriptions; bulkhead values; default bulkhead rule; "plans exported by the previous single-file version, with `t` and `doors`, still load"); Example plan; License.

- [ ] **Step 3: Rewrite `CLAUDE.md`** for the new layout: commands (same list as crew-manifest's CLAUDE.md, adjusted), architecture by folder (`domain`, `storage`, `i18n`, `ui`, `styles`, `pwa`), conventions (snapshot/commit through the store; directions 0–7 clockwise from north, `opposite` = +4, `rotateDir` = +2; edge keys `x,y,E|S`, diagonals have none; pieces store module ids so language switch translates the plan; no hard-coded UI text; `pl.ts` matches `en.ts`; no new dependencies without asking; keep `samplePlan` and `examples/kestrel-4.json` in sync).

- [ ] **Step 4: Repository settings**

Run: `gh repo edit lukaszlenart/deckplan --description "Browser editor for modular space station deck plans, a game master aid for sci-fi tabletop RPGs"` and `gh api repos/lukaszlenart/deckplan/pages --jq .build_type` — Expected: `workflow`.

- [ ] **Step 5: Final checks** — `npm run lint && npm run typecheck && npm test && npm run build` clean; `git status` clean after commit.

- [ ] **Step 6: Commit** — `ci: add CI and GitHub Pages deploy; docs: English README and CLAUDE.md` (two commits: `ci:` for workflows, `docs:` for README and CLAUDE.md).
