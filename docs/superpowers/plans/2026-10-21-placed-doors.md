# Placed Doors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rooms get only the doors the game master places — on any outer wall segment, with a bulkhead type — instead of fixed catalogue doors.

**Architecture:** A room piece stores `doors` in its own frame (like `w`/`h`), so move/rotate/resize carry them. Catalogue rooms lose their `ports`; `analyze` connects corridors to rooms through placed doors and rooms to rooms through a door on a shared segment, and reports every door (connected or not) for drawing. The bulkhead tool places, retypes and (via selection + Delete) removes doors.

**Tech Stack:** TypeScript, Preact + @preact/signals, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-placed-doors-design.md`

## Global Constraints

- No new dependencies; no hard-coded UI text (en + pl keys); role tokens only (new token → `app.css` and `print.css`).
- Every plan mutation: `snapshot()` → new `Plan` → `commit()`.
- Domain and storage never import from `ui/`.
- `schemaVersion` stays `1`; `doors` is optional; no migration code. Old plans load with doorless rooms; room-edge entries in `bulkheads` are pruned on load (`importPlan`/store already prune).
- Corridors and the airlock's `ext` are unchanged.
- One door per wall segment across all rooms.
- PR proof per `CLAUDE.md`: GIF of placing, retyping, deleting a door; connection-rule tests failing on `main`, passing on the branch.
- Full check before each commit: `npm run typecheck && npm test && npm run lint`.

## Review Focus

1. Two rooms side by side: a door placed from either side is one door, connects them, and no dot remains on that segment. (Task 2, Task 4)
2. A rotated room (r = 1–3): clicking a wall dot places the door on exactly that on-screen segment. (Task 1)
3. Deleting a room's only door with a corridor attached: the corridor becomes an open end and the bulkhead on that edge is gone. (Task 4)
4. Shrinking a room with two doors on one wall to width 1: one door left, the first one's type kept. (Task 1)
5. An old plan from storage (rooms without `doors`, `bulkheads` on room edges) loads without error, rooms doorless, room-edge bulkheads pruned. (Task 3)

---

### Task 1: Door model and geometry

**Files:**

- Modify: `src/domain/types.ts`, `src/domain/catalogue.ts`, `src/domain/geometry.ts`
- Test: `src/domain/geometry.test.ts`, `src/domain/catalogue.test.ts`

**Interfaces:**

- Produces:
  - `type WallDir = 0 | 2 | 4 | 6`; `interface Door { x: number; y: number; dir: WallDir; type: BulkheadType }` (own frame, rotation 0); `Piece.doors?: Door[]`.
  - `interface PlacedDoor { x: number; y: number; dir: WallDir; type: BulkheadType; edge: EdgeKey }` — board coordinates of the room cell the door sits on.
  - Catalogue: `room()` no longer takes `ports`; every room `ModuleDef.ports` is `[]`. `ext` unchanged.
  - `isWallSegment(cells: readonly Cell[], x: number, y: number, dir: Dir): boolean` — `dir` orthogonal, `(x,y)` in `cells`, neighbour cell not in `cells`.
  - `wallSegments(p: Piece): EdgeKey[]` — every outer wall segment of a room in board coordinates (empty for corridors).
  - `pieceDoors(p: Piece): PlacedDoor[]` — the piece's doors rotated and translated to the board.
  - `doorAt(p: Piece, edge: EdgeKey): Omit<Door, 'type'> | null` — the own-frame position of the wall segment `edge` on room `p`, or `null` if `edge` is not one of its wall segments.
  - `resizePiece` (existing) also remaps `doors` from the current size to the new one with the existing wall rule (`remapPort`), dropping later duplicates.

- [ ] **Step 1: Write the failing tests.** Replace the resize tests that relied on catalogue room ports (`grows the hangar and moves south doors…`, `moves east doors…`, `merges doors…`, the O1 rotation-quirk test) with door-based ones; keep the T3 `ext` test.

```ts
describe('placed doors', () => {
  const hangar = (extra: Partial<Piece> = {}): Piece => ({
    id: 1,
    module: 'O4',
    x: 10,
    y: 5,
    r: 0,
    ...extra,
  })

  it('catalogue rooms have no doors of their own', () => {
    for (const def of Object.values(MODULES))
      if (def.kind === 'room') expect(def.ports, def.id).toEqual([])
  })

  it('lists every outer wall segment of a room', () => {
    expect(wallSegments({ id: 1, module: 'M3', x: 2, y: 1, r: 0 }).sort()).toEqual(
      ['1,1,E', '1,2,E', '2,0,S', '3,0,S', '2,2,S', '3,2,S', '3,1,E', '3,2,E'].sort(),
    )
    expect(wallSegments({ id: 1, module: 'O2', x: 0, y: 0, r: 0 })).toHaveLength(8)
    expect(wallSegments({ id: 1, module: 'K1', x: 0, y: 0, r: 0 })).toEqual([])
  })

  it('places doors on the board through rotation', () => {
    const door = { x: 0, y: 1, dir: 4 as const, type: 'door' as const }
    expect(pieceDoors(hangar({ doors: [door] }))).toEqual([
      { x: 10, y: 6, dir: 4, type: 'door', edge: '10,6,S' },
    ])
    expect(pieceDoors(hangar({ r: 1, doors: [door] }))).toEqual([
      { x: 10, y: 5, dir: 6, type: 'door', edge: '9,5,E' },
    ])
  })

  it('doorAt inverts pieceDoors for every rotation', () => {
    for (const r of [0, 1, 2, 3] as const) {
      const p = hangar({ r, w: 5, h: 3 })
      for (const edge of wallSegments(p)) {
        const pos = doorAt(p, edge)
        expect(pos, `${r} ${edge}`).not.toBeNull()
        expect(pieceDoors({ ...p, doors: [{ ...pos!, type: 'door' }] })[0]?.edge).toBe(edge)
      }
    }
    expect(doorAt(hangar(), '20,20,S')).toBeNull()
    expect(doorAt(hangar(), '11,5,E')).toBeNull() // inner edge between two hangar cells
  })

  it('resizing moves doors with their wall and merges doors that land together', () => {
    const p = hangar({
      doors: [
        { x: 0, y: 1, dir: 4, type: 'bulkhead' },
        { x: 3, y: 1, dir: 4, type: 'door' },
        { x: 3, y: 0, dir: 2, type: 'airlock' },
      ],
    })
    expect(resizePiece(p, 6, 3).doors).toEqual([
      { x: 0, y: 2, dir: 4, type: 'bulkhead' },
      { x: 3, y: 2, dir: 4, type: 'door' },
      { x: 5, y: 0, dir: 2, type: 'airlock' },
    ])
    expect(resizePiece(p, 1, 2).doors).toEqual([
      { x: 0, y: 1, dir: 4, type: 'bulkhead' },
      { x: 0, y: 0, dir: 2, type: 'airlock' },
    ])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/domain` — expected: the new tests FAIL (missing exports / rooms still have ports).

- [ ] **Step 3: Implement.** `pieceDoors` applies the same per-step rotation as `shape()` (`[x, y] → [h − 1 − y, x]`, `dir + 2`, swapping `w`/`h`) starting from `pieceSize(p)`; extract that step into one helper used by both. `doorAt` may search the piece's own-frame wall segments for the one whose `pieceDoors` edge equals `edge` (rooms are at most 40×28). Update `catalogue.test.ts` (ports non-empty → only for corridors; the T1 ports expectation goes). `remapPort` works from any source size already; `resizePiece` dedupes on `x,y,dir` keeping the first.

- [ ] **Step 4: Run** `npm run typecheck && npx vitest run src/domain/geometry.test.ts src/domain/catalogue.test.ts` — expected: PASS. (`analysis.test.ts` sample test may fail until Task 2; that is expected only for that file.)

- [ ] **Step 5: Commit** `feat(domain): doors placed on room walls`

---

### Task 2: Connections through placed doors; sample plan

**Files:**

- Modify: `src/domain/analysis.ts`, `src/domain/sample.ts`
- Test: `src/domain/analysis.test.ts`

**Interfaces:**

- Consumes: `pieceDoors`, `wallSegments`, `PlacedDoor` (Task 1).
- Produces:
  - `EdgeInfo` gains `door?: { pieceId: number; type: BulkheadType }` — set on room connections.
  - `Analysis` gains `doors: Map<EdgeKey, { pieceId: number; type: BulkheadType; connected: boolean }>` — every placed door, first by piece order when two rooms claim one segment.
  - `bulkheadAt(plan, key, info)` returns `info.door?.type ?? plan.bulkheads[key] ?? 'open'`.
  - `analyze` rules: corridor ↔ corridor unchanged; corridor port facing a room cell connects iff that segment holds a door (any room's); room ↔ room connects iff the shared segment holds a door; a corridor port with no connection is in `open` (`room: false`); room doors never appear in `open`.
  - `freeWallSegments(plan: Plan): EdgeKey[]` — all rooms' wall segments without a door, each segment once.
  - `pruneBulkheads` keeps only keys of corridor–corridor edges (`edges.get(k)?.door === undefined`).
  - `samplePlan` rooms carry these doors and `bulkheads` becomes `{}`:
    - 16 M1 `[{ x: 0, y: 0, dir: 4, type: 'door' }]`
    - 17 T1 `[{ x: 1, y: 0, dir: 0, type: 'bulkhead' }]`
    - 18 O1 `[{ x: 1, y: 1, dir: 4, type: 'door' }]`
    - 19 O3 `[{ x: 0, y: 0, dir: 4, type: 'door' }]`
    - 20 M2 `[{ x: 1, y: 1, dir: 4, type: 'bulkhead' }]`
    - 21 T3 `[{ x: 0, y: 0, dir: 4, type: 'airlock' }]`

- [ ] **Step 1: Write the failing tests.**

```ts
describe('placed door connections', () => {
  const corridorUp = { module: 'K1', x: 0, y: 2, r: 0 as const } // ports N and S at (0,2)
  const cabin = (doors?: Piece['doors']) => ({ module: 'M1', x: 0, y: 1, r: 0 as const, doors })

  it('a corridor meets a room only at a door', () => {
    const walled = analyze(makePlan([cabin(), corridorUp]))
    expect(walled.edges.size).toBe(0)
    expect(walled.fragments).toBe(2)
    expect(walled.open).toContainEqual({ x: 0, y: 2, dir: 0, room: false })
    const doored = analyze(
      makePlan([cabin([{ x: 0, y: 0, dir: 4, type: 'bulkhead' }]), corridorUp]),
    )
    expect(doored.edges.get('0,1,S')?.door).toEqual({ pieceId: 1, type: 'bulkhead' })
    expect(doored.fragments).toBe(1)
  })

  it('two rooms connect through one door on their shared wall', () => {
    const a = analyze(
      makePlan([
        { module: 'M1', x: 0, y: 0, r: 0, doors: [{ x: 0, y: 0, dir: 2, type: 'door' }] },
        { module: 'M1', x: 1, y: 0, r: 0 },
      ]),
    )
    expect(a.fragments).toBe(1)
    expect(a.doors.get('0,0,E')).toEqual({ pieceId: 1, type: 'door', connected: true })
  })

  it('an unconnected door is drawn, not reported open', () => {
    const a = analyze(makePlan([cabin([{ x: 0, y: 0, dir: 2, type: 'welded' }])]))
    expect(a.open).toEqual([])
    expect(a.doors.get('0,1,E')).toEqual({ pieceId: 1, type: 'welded', connected: false })
  })

  it('free wall segments exclude doors and count shared segments once', () => {
    const plan = makePlan([
      { module: 'M1', x: 0, y: 0, r: 0, doors: [{ x: 0, y: 0, dir: 4, type: 'door' }] },
      { module: 'M1', x: 1, y: 0, r: 0 },
    ])
    const free = freeWallSegments(plan)
    expect(free).not.toContain('0,0,S')
    expect(free.filter((k) => k === '0,0,E')).toHaveLength(1)
    expect(free).toHaveLength(6)
  })

  it('pruneBulkheads drops keys on room edges', () => {
    const plan = makePlan([cabin([{ x: 0, y: 0, dir: 4, type: 'door' }]), corridorUp], {
      '0,1,S': 'airlock',
    })
    expect(pruneBulkheads(plan).bulkheads).toEqual({})
  })
})
```

Extend the existing `samplePlan` test (`is placeable and connected`):

```ts
const roomEdges = [...a.edges]
  .filter(([, i]) => i.door)
  .map(([k, i]) => `${k}=${bulkheadAt(plan, k, i)}`)
  .sort()
expect(roomEdges).toEqual(
  [
    '5,7,S=door',
    '7,8,S=bulkhead',
    '10,7,S=door',
    '13,8,S=door',
    '16,5,S=airlock',
    '3,9,S=bulkhead',
  ].sort(),
)
expect(a.edges.size).toBe(18)
expect(a.open).toEqual([])
expect(plan.bulkheads).toEqual({})
```

- [ ] **Step 2: Run** `npx vitest run src/domain/analysis.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** the rules above in `analyze` (build an `occupancy` map, a corridor `portMap`, and a door map keyed by edge from `pieceDoors`), `freeWallSegments`, `bulkheadAt`, `pruneBulkheads`, and the sample doors.

- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: domain PASS; storage tests on `kestrel-4.json` may fail until Task 3.

- [ ] **Step 5: Commit** `feat(domain): connect rooms only through placed doors`

---

### Task 3: Saving and importing doors; example file

**Files:**

- Modify: `src/storage/schema.ts`, `src/storage/backup.ts`, `examples/kestrel-4.json`
- Test: `src/storage/schema.test.ts`, `src/storage/backup.test.ts`, `src/storage/localStorageRepo.test.ts`

**Interfaces:**

- Consumes: `isWallSegment`, `pieceSize`, `shape`, `pieceDoors` (Task 1).
- Produces: `PieceSchema.doors` optional array of `{ x: int, y: int, dir: 0|2|4|6, type: BulkheadType }`; refinements: only on `kind === 'room'`, each on a wall segment of the piece's own-frame cells (`shape(module, 0, pieceSize(p)).cells`), no two with the same `x,y,dir`. `importPlan` additionally rejects two rooms with doors on the same board edge (`pieceDoors(...).edge`). `examples/kestrel-4.json` equals `exportPlan(samplePlan('Kestrel-4 Outpost'))`.

- [ ] **Step 1: Write the failing tests.**

```ts
// schema.test.ts
it('accepts doors on room walls', () => {
  const plan = makePlan([
    { module: 'O4', x: 0, y: 0, r: 0, doors: [{ x: 3, y: 1, dir: 2, type: 'door' }] },
  ])
  expect(parsePlan(plan).pieces[0]?.doors).toHaveLength(1)
})
it('rejects doors off the wall, on corridors, diagonal or duplicated', () => {
  const at = (module: string, doors: unknown) =>
    makePlan([{ module, x: 0, y: 0, r: 0, doors } as never])
  expect(() => parsePlan(at('O4', [{ x: 1, y: 0, dir: 2, type: 'door' }]))).toThrow() // inner edge
  expect(() => parsePlan(at('O4', [{ x: 9, y: 0, dir: 0, type: 'door' }]))).toThrow()
  expect(() => parsePlan(at('O4', [{ x: 0, y: 0, dir: 1, type: 'door' }]))).toThrow()
  expect(() => parsePlan(at('K1', [{ x: 0, y: 0, dir: 2, type: 'door' }]))).toThrow()
  const d = { x: 0, y: 0, dir: 0, type: 'door' }
  expect(() => parsePlan(at('O4', [d, d]))).toThrow()
})

// backup.test.ts
it('rejects two rooms with a door on the same segment', () => {
  const plan = makePlan([
    { module: 'M1', x: 0, y: 0, r: 0, doors: [{ x: 0, y: 0, dir: 2, type: 'door' }] },
    { module: 'M1', x: 1, y: 0, r: 0, doors: [{ x: 0, y: 0, dir: 6, type: 'door' }] },
  ])
  expect(importPlan(JSON.stringify(plan))).toEqual({ ok: false, reason: 'invalid' })
})
it('imports the shipped example as the sample plan', () => {
  const result = importPlan(readFileSync('examples/kestrel-4.json', 'utf8'))
  expect(result.ok && result.plan).toEqual(samplePlan('Kestrel-4 Outpost'))
})

// localStorageRepo.test.ts
it('loads a plan saved before placed doors with doorless rooms and no room bulkheads', () => {
  // rooms without `doors`, bulkhead stored on the M1–corridor edge
  const old = makePlan(
    [
      { module: 'M1', x: 0, y: 1, r: 0 },
      { module: 'K1', x: 0, y: 2, r: 0 },
    ],
    { '0,1,S': 'airlock' },
  )
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEY, JSON.stringify(old))
  const loaded = new LocalStorageRepo({ storage, logger: { warn: () => {} } }).load()
  expect(loaded?.pieces[0]).not.toHaveProperty('doors')
  expect(storage.getItem(`${STORAGE_KEY}.corrupt`)).toBeNull()
})
```

The existing `imports the shipped example` assertion on `bulkheads['16,5,S']` is replaced by the new example test. Pruning of `0,1,S` on load is asserted in Task 4 (the store prunes on load); if `LocalStorageRepo.load` is where pruning belongs, assert it here instead and ledger the ruling.

- [ ] **Step 2: Run** `npx vitest run src/storage` — expected: FAIL.

- [ ] **Step 3: Implement** the schema fields and refinements (keep the `isModuleId` guard before any `moduleDef` call), the cross-room check in `importPlan`, and regenerate `examples/kestrel-4.json` with a one-off `npx vite-node` script writing `exportPlan(samplePlan('Kestrel-4 Outpost'))` (do not commit the script).

- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS.

- [ ] **Step 5: Commit** `feat(storage): save and validate placed doors`

---

### Task 4: Store — place, retype and delete doors

**Files:**

- Modify: `src/ui/store.ts`
- Test: `src/ui/store.test.ts`

**Interfaces:**

- Consumes: `doorAt`, `freeWallSegments`, `Analysis.doors`, `pruneBulkheads` (Tasks 1–2).
- Produces:
  - `setBulkhead(key: EdgeKey, type: BulkheadType): void` now: door at `key` → retype it on its piece; free wall segment → add `{ ...doorAt(room, key), type }` to the lowest-id room that has `key` as a wall segment; corridor–corridor edge → as today; anything else → no-op. One snapshot per change; toast `bulkhead.${type}` as today.
  - `deleteSelected()`: with `selectedEdge` on a door → remove that door, `commit(pruneBulkheads(...))`, clear `selectedEdge`; otherwise as today.
  - On load (initial and `loadPlan`), the plan is passed through `pruneBulkheads` (old room-edge keys disappear). Ledger it if this already holds.

- [ ] **Step 1: Write the failing tests.**

```ts
it('setBulkhead places a door on a free wall, retypes it, and Delete removes it', () => {
  const { store } = setup()
  store.loadPlan(
    makePlan([
      { module: 'M1', x: 0, y: 1, r: 0 },
      { module: 'K1', x: 0, y: 2, r: 0 },
    ]),
  )
  store.setBulkhead('0,1,S', 'door')
  expect(store.plan.value.pieces[0]?.doors).toEqual([{ x: 0, y: 0, dir: 4, type: 'door' }])
  expect(store.analysis.value.fragments).toBe(1)
  store.setBulkhead('0,1,S', 'welded')
  expect(store.plan.value.pieces[0]?.doors).toEqual([{ x: 0, y: 0, dir: 4, type: 'welded' }])
  store.selectEdge('0,1,S')
  store.deleteSelected()
  expect(store.plan.value.pieces[0]?.doors ?? []).toEqual([])
  expect(store.plan.value.pieces).toHaveLength(2)
  expect(store.analysis.value.open).toContainEqual({ x: 0, y: 2, dir: 0, room: false })
  store.undo()
  expect(store.plan.value.pieces[0]?.doors).toEqual([{ x: 0, y: 0, dir: 4, type: 'welded' }])
})

it('a door on a shared wall is placed once, on the lower-id room', () => {
  const { store } = setup()
  store.loadPlan(
    makePlan([
      { module: 'M1', x: 1, y: 0, r: 0 },
      { module: 'M1', x: 0, y: 0, r: 0 },
    ]),
  )
  store.setBulkhead('0,0,E', 'door')
  expect(store.plan.value.pieces.map((p) => p.doors ?? [])).toEqual([
    [{ x: 0, y: 0, dir: 6, type: 'door' }],
    [],
  ])
  expect(freeWallSegments(store.plan.value)).not.toContain('0,0,E')
})

it('loading drops bulkheads stored on room edges', () => {
  const { store } = setup()
  store.loadPlan(
    makePlan(
      [
        { module: 'M1', x: 0, y: 1, r: 0 },
        { module: 'K1', x: 0, y: 2, r: 0 },
      ],
      { '0,1,S': 'airlock' },
    ),
  )
  expect(store.plan.value.bulkheads).toEqual({})
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/store.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** as specified in Interfaces.

- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS.

- [ ] **Step 5: Commit** `feat(ui): place, retype and delete doors through the store`

---

### Task 5: Board, drawing and Inspector

**Files:**

- Modify: `src/ui/svg/RoomShape.tsx`, `src/ui/svg/PlanDrawing.tsx`, `src/ui/svg/Ghost.tsx`, `src/ui/Board.tsx`, `src/ui/Inspector.tsx`, `src/i18n/en.ts`, `src/i18n/pl.ts`

**Interfaces:**

- Consumes: `pieceDoors`, `Analysis.doors`, `freeWallSegments`, `store.setBulkhead`, `store.deleteSelected`.
- Produces: i18n `inspector.doorUnconnected` (en `'room door – not connected'`, pl `'drzwi pomieszczenia – bez połączenia'`), `inspector.deleteDoor` (en `'Remove door'`, pl `'Usuń drzwi'`); updated `inspector.placingBulkheadHint` (en `'Click a red dot on a room wall to place a door, or a circle between corridors. You can keep clicking. Esc finishes.'`, pl equivalent).

- [ ] **Step 1: Drawing.** `RoomShape` cuts its wall gaps from the room's placed doors (pass the `Piece`, use `pieceDoors`) instead of `shape.ports`. `PlanDrawing` draws a `BulkheadMark` for every entry of `analysis.doors` (connected or not, `hasRoom: true`) and for corridor–corridor edges; no edge is drawn twice. `PrintSheet` needs no change (shares `PlanDrawing`); check it.

- [ ] **Step 2: Tool mode.** In `Ghost`'s bulkhead branch, draw a red (`var(--bad)`) dot at `edgeCenter` of every `freeWallSegments(plan)` key alongside the existing dashed circles; the active (hover/drag) key is highlighted. In `Board`, the candidate set for `nearestEdge` in tool mode and bulkhead drags is `edges ∪ freeWallSegments ∪ doors` keys; a click calls `store.setBulkhead(key, tool)`.

- [ ] **Step 3: Inspector.** With a selected edge that is a door (`analysis.doors.get(edge)`): title = its type, meta = `inspector.connectionRoom` when connected else `inspector.doorUnconnected`, the type buttons (as today, via `setBulkhead`), and a `inspector.deleteDoor` button (`store.deleteSelected()`, `<kbd>Del</kbd>`). Corridor–corridor edges keep today's card without a delete button.

- [ ] **Step 4: Run** `npm run typecheck && npm test && npm run lint` — expected: PASS (includes en/pl parity).

- [ ] **Step 5: Verify by hand and record the PR proof** in `npm run dev`:
  - new sickbay from the palette has no doors; pick "Door" → red dots on its 8 segments
  - click east-wall dot → door appears, no corridor needed; click it again with "Welded shut" → retyped
  - click the door (no tool), press `Del` → wall closes; attached corridor shows as open end
  - two rooms side by side → one door on the shared wall connects them (status bar fragments)
  - rotate, move and resize a room with doors → doors follow
  - print preview shows the doors
  - record a GIF of place → retype → delete with the Chrome GIF tool; save it under the scratchpad and hand the path to the user for the PR.

- [ ] **Step 6: Commit** `feat(ui): place doors on room walls from the bulkhead palette`
