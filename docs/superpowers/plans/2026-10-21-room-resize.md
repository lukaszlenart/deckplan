# Room Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every rectangular room placed on the board be resized per piece by dragging a bottom-right corner grip.

**Architecture:** A piece optionally stores its size `w`/`h` in the module's own frame (rotation 0). `shape()` builds the resized rectangle, remaps its doors along their walls, then rotates as today; every caller that draws or checks a placed piece goes through a `pieceShape(piece)` helper. The grip drag is a new `'resize'` kind in the pure pointer reducer, committed by a new `store.resizePiece`.

**Tech Stack:** TypeScript, Preact + @preact/signals, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-room-resize-design.md`

## Global Constraints

- No new dependencies.
- No hard-coded UI text: every visible string or aria label goes through `src/i18n/en.ts` + `pl.ts`.
- Every plan mutation: `snapshot()` → new `Plan` → `commit()`; never mutate `plan.value`.
- Domain and storage never import from `ui/`.
- Components use role tokens only (`--accent`, `--ok`, `--bad`, …); a new token goes into both `app.css` and `print.css`.
- `schemaVersion` stays `1`; `w`/`h` are absent unless they differ from the catalogue size.
- Minimum size 1×1; maximum is the grid (`GRID.width` × `GRID.height`).
- Resizable = `kind === 'room'` and catalogue cells fill their bounding rectangle (derived, not listed). Today: M1, M2, M3, O1, O3, O4, T1, T2, T3; not O2.
- Full check before each commit: `npm run typecheck && npm test && npm run lint`.

## Review Focus

1. Shrinking the hangar (two south doors) to width 1 must leave one door, not two ports on the same cell — duplicates would show as two open ports and break `analyze`. (Task 1)
2. A room at rotation 1 or 3: dragging to screen 5×2 must store own-frame `w=2, h=5`. (Task 1, Task 5)
3. Dragging the grip above or left of the room's top-left clamps to 1×1, never 0 or negative. (Task 4)
4. Stored or imported data with `w` on `O2`, `w: 0`, or `w: 41` is rejected (storage then keeps its existing corrupt-copy path). (Task 3)
5. Rotating a resized room checks the resized footprint and keeps its size; undo after a resize restores the old size; a resize back to the same size adds no undo entry. (Task 5)

---

### Task 1: Resizable shapes in geometry

**Files:**

- Modify: `src/domain/types.ts` (`Piece`)
- Modify: `src/domain/geometry.ts`
- Test: `src/domain/geometry.test.ts`

**Interfaces:**

- Produces:
  - `Piece` gains `w?: number; h?: number` (own frame, rotation 0).
  - `export interface Size { w: number; h: number }` in `types.ts`.
  - `baseSize(id: ModuleId): Size` — catalogue bounding size at rotation 0.
  - `isResizable(id: ModuleId): boolean`
  - `shape(id: ModuleId, r: Rotation, size?: Size): Shape` — `size` omitted or equal to `baseSize` returns exactly today's shape (same cached object as `shape(id, r)`); memo key `${id}|${r}|${w}x${h}`.
  - `pieceShape(p: Pick<Piece, 'module' | 'r' | 'w' | 'h'>): Shape`
  - `pieceSize(p: Pick<Piece, 'module' | 'w' | 'h'>): Size` — stored size or `baseSize`.
  - `resizePiece(p: Piece, screenW: number, screenH: number): Piece` — clamps each to ≥1, swaps to own frame when `r` is odd, returns the piece with `w`/`h` set, or with `w`/`h` removed (not `undefined`-valued keys) when equal to `baseSize`. Does not check fit.

- [ ] **Step 1: Write the failing tests** in `geometry.test.ts`:

```ts
describe('resizable shapes', () => {
  it('derives which modules can be resized', () => {
    const ids = ['M1', 'M2', 'M3', 'O1', 'O2', 'O3', 'O4', 'T1', 'T2', 'T3', 'K1']
    expect(ids.filter(isResizable)).toEqual(['M1', 'M2', 'M3', 'O1', 'O3', 'O4', 'T1', 'T2', 'T3'])
  })

  it('treats the catalogue size as no resize', () => {
    expect(shape('O4', 1, { w: 4, h: 2 })).toBe(shape('O4', 1))
  })

  it('grows the hangar and moves south doors with the south wall', () => {
    const s = shape('O4', 0, { w: 6, h: 3 })
    expect([s.w, s.h, s.cells.length]).toEqual([6, 3, 18])
    expect(s.ports).toEqual([
      [0, 2, 4],
      [3, 2, 4],
    ])
  })

  it('moves east doors with the east wall and clamps doors past the wall end', () => {
    expect(shape('M2', 0, { w: 5, h: 2 }).ports).toEqual([
      [1, 1, 4],
      [0, 0, 6],
      [4, 0, 2],
    ])
    expect(shape('T1', 0, { w: 2, h: 2 }).ports).toEqual([
      [0, 1, 4],
      [1, 0, 0],
    ])
    expect(shape('T1', 0, { w: 1, h: 2 }).ports).toEqual([
      [0, 1, 4],
      [0, 0, 0],
    ])
  })

  it('merges doors that land on the same cell', () => {
    expect(shape('O4', 0, { w: 1, h: 2 }).ports).toEqual([[0, 1, 4]])
  })

  it('remaps external exits like ports', () => {
    expect(shape('T3', 0, { w: 3, h: 2 }).ext).toEqual([[0, 0, 0]])
    expect(shape('T3', 0, { w: 3, h: 2 }).ports).toEqual([[0, 1, 4]])
  })

  it('rotates after resizing (accepted quirk: door keeps its own-frame offset)', () => {
    // Bridge at r=2: door on the screen top wall; widening moves it from screen x=1 to x=3
    expect(shape('O1', 2).ports).toEqual([[1, 0, 0]])
    expect(shape('O1', 2, { w: 5, h: 2 }).ports).toEqual([[3, 0, 0]])
  })

  it('resizePiece maps screen size to the own frame and normalises', () => {
    const p = { id: 1, module: 'O4', x: 0, y: 0, r: 0 as const }
    expect(resizePiece(p, 6, 3)).toEqual({ ...p, w: 6, h: 3 })
    expect(resizePiece({ ...p, r: 1 }, 5, 2)).toEqual({ ...p, r: 1, w: 2, h: 5 })
    expect(resizePiece({ ...p, w: 6, h: 3 }, 4, 2)).toEqual(p)
    expect(resizePiece(p, 0, -2)).toEqual({ ...p, w: 1, h: 1 })
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/domain/geometry.test.ts` — expected: FAIL (missing exports).

- [ ] **Step 3: Implement** in `geometry.ts`. The resized base (before the existing rotation loop) is `rect(w, h)` cells plus each port/ext remapped by its direction, then deduplicated by `x,y,d` keeping first occurrence:

```ts
// own frame, (w0, h0) = baseSize, (w, h) = requested size
d === 0: [min(x, w-1), 0, 0]      d === 4: [min(x, w-1), h-1, 4]
d === 6: [0, min(y, h-1), 6]      d === 2: [w-1, min(y, h-1), 2]
```

Only reached for resizable modules whose size differs from `baseSize`; throw on a diagonal port (catalogue error). Keep `placementOffset(id, r)` on catalogue size.

- [ ] **Step 4: Run** `npx vitest run src/domain/geometry.test.ts` — expected: PASS.

- [ ] **Step 5: Commit** `feat(domain): resizable room shapes`

---

### Task 2: Placed pieces use their own size everywhere

**Files:**

- Modify: `src/domain/analysis.ts` (`occupancy`, `canPlace`, `analyze`, `planBounds`)
- Modify: `src/ui/Inspector.tsx:56`, `src/ui/StatusBar.tsx:11`, `src/ui/svg/CorridorLayer.tsx:56,59`, `src/ui/svg/PlanDrawing.tsx:39`, `src/ui/Board.tsx:199`
- Test: `src/domain/analysis.test.ts`

**Interfaces:**

- Consumes: `pieceShape`, `Size` (Task 1).
- Produces: `canPlace(plan, id, r, x, y, ignoreId?: number, size?: Size): boolean` — `size` in own frame, omitted = catalogue.

- [ ] **Step 1: Write the failing tests** in `analysis.test.ts`:

```ts
it('a resized room occupies and connects at its new size', () => {
  const plan = makePlan([
    { module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 3 },
    { module: 'K1', x: 0, y: 3, r: 0 },
  ])
  expect(occupancy(plan).get('5,2')).toBe(1)
  expect(canPlace(plan, 'M1', 0, 5, 2)).toBe(false)
  expect(analyze(plan).edges.has('0,2,S')).toBe(true)
  expect(planBounds(plan, 0)).toEqual({ x: 0, y: 0, w: 6, h: 4 })
})

it('canPlace checks a given size', () => {
  const plan = makePlan([{ module: 'M1', x: 5, y: 0, r: 0 }])
  expect(canPlace(plan, 'O4', 0, 0, 0)).toBe(true)
  expect(canPlace(plan, 'O4', 0, 0, 0, undefined, { w: 6, h: 2 })).toBe(false)
})
```

- [ ] **Step 2: Run** `npx vitest run src/domain/analysis.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement**: domain callers use `pieceShape(p)`; `canPlace` uses `shape(id, r, size)`. Switch every listed UI caller from `shape(p.module, p.r)` to `pieceShape(p)`. `Ghost.tsx` and `ModuleThumb.tsx` stay on catalogue size here (Ghost changes in Task 6).

- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS.

- [ ] **Step 5: Commit** `feat(domain): use each piece's size for placement and analysis`

---

### Task 3: Persist and validate sizes

**Files:**

- Modify: `src/storage/schema.ts`
- Modify: `src/storage/backup.ts` (pass `pieceSize`-derived `size` to `canPlace`)
- Test: `src/storage/schema.test.ts`, `src/storage/backup.test.ts`

**Interfaces:**

- Consumes: `isResizable`, `Size`, `canPlace(..., size?)`.
- Produces: `PieceSchema` with `w`/`h` as `int.min(1).max(GRID.width)` / `int.min(1).max(GRID.height)`, both optional, both-or-neither, only on resizable modules. The compile-time schema/type check must still compile.

- [ ] **Step 1: Write the failing tests**:

```ts
// schema.test.ts
it('accepts a size on a resizable room', () => {
  const plan = makePlan([{ module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 3 }])
  expect(parsePlan(plan).pieces[0]).toMatchObject({ w: 6, h: 3 })
})
it('rejects bad sizes', () => {
  const at = (p: object) => makePlan([{ module: 'O4', x: 0, y: 0, r: 0, ...p }])
  expect(() => parsePlan(at({ w: 0, h: 2 }))).toThrow()
  expect(() => parsePlan(at({ w: 41, h: 2 }))).toThrow()
  expect(() => parsePlan(at({ w: 6 }))).toThrow()
  expect(() => parsePlan(makePlan([{ module: 'O2', x: 0, y: 0, r: 0, w: 3, h: 3 }]))).toThrow()
})

// backup.test.ts
it('rejects resized pieces that overlap or leave the grid', () => {
  const overlap = makePlan([
    { module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2 },
    { module: 'M1', x: 5, y: 0, r: 0 },
  ])
  expect(importPlan(JSON.stringify(overlap))).toEqual({ ok: false, reason: 'invalid' })
  const off = makePlan([{ module: 'O4', x: 38, y: 0, r: 0, w: 6, h: 2 }])
  expect(importPlan(JSON.stringify(off))).toEqual({ ok: false, reason: 'invalid' })
})
it('round-trips a resized piece', () => {
  const plan = makePlan([{ module: 'O4', x: 0, y: 0, r: 1, w: 6, h: 3 }])
  const back = importPlan(exportPlan(plan))
  expect(back.ok && back.plan.pieces[0]).toMatchObject({ w: 6, h: 3 })
})
```

- [ ] **Step 2: Run** `npx vitest run src/storage` — expected: the new tests FAIL.

- [ ] **Step 3: Implement** the schema fields and refinements, and `backup.ts` passing the piece's size.

- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS (existing legacy/migrate tests unchanged).

- [ ] **Step 5: Commit** `feat(storage): save and validate room sizes`

---

### Task 4: Resize drag in the pointer reducer

**Files:**

- Modify: `src/ui/store.ts` (`DragState` union only)
- Modify: `src/ui/pointer.ts`
- Test: `src/ui/pointer.test.ts`

**Interfaces:**

- Produces:
  - `DragState` member `{ kind: 'resize'; id: number; x: number; y: number; w: number; h: number; sx: number; sy: number; moved: boolean; over: boolean }` — `x`/`y` the piece's top-left, `w`/`h` the current **screen** size.
  - `beginResizeDrag(piece: Piece, p: Point): DragState` — starts at the piece's current screen size (`pieceShape(piece).w/h`), `over: true`.
  - `moveDrag`: for `'resize'` with a cell, `w = max(1, cell[0] − x + 1)`, `h = max(1, cell[1] − y + 1)`, `over: true`; with no cell, `over: false`, size unchanged.
  - `rotateDrag`: returns a `'resize'` drag unchanged.
  - `DropOutcome` member `{ kind: 'resize'; id: number; w: number; h: number }` (screen size); `resolveDrop` returns it when moved and over, `cancel` when moved and not over, `click` when not moved.

- [ ] **Step 1: Write the failing tests** (board helper as in the file: 10 px per cell at (100, 50)):

```ts
describe('resize drag', () => {
  const hangar = { id: 7, module: 'O4', x: 2, y: 3, r: 0 as const }
  it('tracks the cell under the pointer as the bottom-right corner', () => {
    let d = beginResizeDrag(hangar, { x: 160, y: 90 })
    d = moveDrag(d, { x: 180, y: 110 }, [7, 5], null)
    expect(resolveDrop(d)).toEqual({ kind: 'resize', id: 7, w: 6, h: 3 })
  })
  it('clamps to 1×1 above or left of the origin', () => {
    let d = beginResizeDrag(hangar, { x: 160, y: 90 })
    d = moveDrag(d, { x: 100, y: 50 }, [0, 0], null)
    expect(resolveDrop(d)).toEqual({ kind: 'resize', id: 7, w: 1, h: 1 })
  })
  it('starts at the current screen size of a rotated, resized room', () => {
    const d = beginResizeDrag({ ...hangar, r: 1, w: 6, h: 3 }, { x: 0, y: 0 })
    expect(d).toMatchObject({ w: 3, h: 6 })
  })
  it('cancels off the board, ignores rotation, and is a click when not moved', () => {
    const d = beginResizeDrag(hangar, { x: 160, y: 90 })
    expect(rotateDrag(d)).toBe(d)
    expect(resolveDrop(d)).toEqual({ kind: 'click' })
    expect(resolveDrop(moveDrag(d, { x: 600, y: 600 }, null, null))).toEqual({ kind: 'cancel' })
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/pointer.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** the new union members and reducer branches. Narrow existing `'new' | 'move'` code paths (e.g. `Ghost.tsx`, `Board.tsx` `onUp`, `App.tsx`) only as far as typecheck requires; their behaviour for `'resize'` comes in Tasks 5–6.

- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS.

- [ ] **Step 5: Commit** `feat(ui): resize drag in the pointer reducer`

---

### Task 5: `store.resizePiece`, size kept on move and rotate

**Files:**

- Modify: `src/ui/store.ts`
- Test: `src/ui/store.test.ts`

**Interfaces:**

- Consumes: `resizePiece`, `pieceSize`, `canPlace(..., size?)`.
- Produces: `Store.resizePiece(id: number, screenW: number, screenH: number): boolean` — unknown id → `false`; result equal to current size → `true`, no snapshot, no commit; does not fit → toast `'toast.noFitShort'`, `false`; otherwise `snapshot()` → `commit(pruneBulkheads(...))`, keeps selection. `movePiece` and `rotateSelected` pass the piece's size to `canPlace` and keep `w`/`h` (they already spread `p`).

- [ ] **Step 1: Write the failing tests** (use a store loaded with a small plan via `loadPlan(makePlan([...]))`, then note `canUndo` resets only through `undo`):

```ts
it('resizePiece grows a room, undo restores it, same size is a no-op', () => {
  const { store } = setup()
  store.loadPlan(makePlan([{ module: 'O4', x: 0, y: 0, r: 0 }]))
  expect(store.resizePiece(1, 6, 3)).toBe(true)
  expect(store.plan.value.pieces[0]).toMatchObject({ w: 6, h: 3 })
  const before = store.plan.value
  expect(store.resizePiece(1, 6, 3)).toBe(true)
  expect(store.plan.value).toBe(before)
  store.undo()
  expect(store.plan.value.pieces[0]).not.toHaveProperty('w')
})

it('resizePiece refuses to overlap and stores rotated sizes in the own frame', () => {
  const { store } = setup()
  store.loadPlan(
    makePlan([
      { module: 'O4', x: 0, y: 0, r: 1 },
      { module: 'M1', x: 0, y: 6, r: 0 },
    ]),
  )
  expect(store.resizePiece(1, 2, 7)).toBe(false)
  expect(store.toast.value?.key).toBe('toast.noFitShort')
  expect(store.resizePiece(1, 3, 5)).toBe(true)
  expect(store.plan.value.pieces[0]).toMatchObject({ w: 5, h: 3 })
})

it('rotateSelected checks and keeps the resized footprint', () => {
  const { store } = setup()
  store.loadPlan(
    makePlan([
      { module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2 },
      { module: 'M1', x: 1, y: 4, r: 0 },
    ]),
  )
  store.selectPiece(1)
  store.rotateSelected()
  expect(store.toast.value?.key).toBe('toast.noRotate')
  store.loadPlan(makePlan([{ module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2 }]))
  store.selectPiece(1)
  store.rotateSelected()
  expect(store.plan.value.pieces[0]).toMatchObject({ r: 1, w: 6, h: 2 })
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/store.test.ts` — expected: FAIL.

- [ ] **Step 3: Implement** `resizePiece` and the `size` argument in `movePiece`/`rotateSelected`.

- [ ] **Step 4: Run** `npm run typecheck && npm test` — expected: PASS.

- [ ] **Step 5: Commit** `feat(ui): resize rooms through the store`

---

### Task 6: Grip, preview and wiring on the board

**Files:**

- Modify: `src/ui/Board.tsx`, `src/ui/svg/Ghost.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/pl.ts`
- Modify: `src/styles/app.css` (and `print.css` only if a new token is added)

**Interfaces:**

- Consumes: `beginResizeDrag`, `'resize'` `DropOutcome`, `store.resizePiece`, `isResizable`, `pieceShape`, `resizePiece`, `canPlace(..., size?)`.
- Produces: i18n keys `'board.size': '{w}×{h}'` (pl identical) and `'board.resizeGrip': 'Resize'` / `'Zmień rozmiar'`.

- [ ] **Step 1: Grip.** In `Board.tsx`, when a piece is selected, `isResizable(piece.module)`, no drag is active and no bulkhead tool is on, draw a grip in the bottom-right cell of `pieceShape(piece)` — a triangle like the brainstorm mockup option B, filled `var(--bh-door)` / stroked `var(--bg)`, with a hit area of at least a third of a cell, `data-grip`, and an aria label from `board.resizeGrip`. It must sit outside the `pointer-events="none"` group. In `onPointerDown`, check `[data-grip]` **before** `[data-id]` and start `beginResizeDrag(piece, e)`. In `onUp`, `drop.kind === 'resize'` → `store.resizePiece(drop.id, drop.w, drop.h)`; a `'click'` from a resize drag does nothing.

- [ ] **Step 2: Preview.** In `Ghost.tsx`, for a moved `'resize'` drag look up `piece` by `drag.id` and draw a dashed rectangle at `x, y, w, h`, stroke `var(--ok)` when `drag.over` and `canPlace(plan, piece.module, piece.r, x, y, piece.id, pieceSize(resizePiece(piece, w, h)))`, else `var(--bad)`, plus a `board.size` label at its bottom-right. Hide the selection outline and grip while resizing.

- [ ] **Step 3: i18n.** Add both keys to `en.ts` and `pl.ts`.

- [ ] **Step 4: Run** `npm run typecheck && npm test && npm run lint` — expected: PASS (includes the en/pl key-parity test).

- [ ] **Step 5: Verify by hand** in `npm run dev`:
  - select the hangar → grip shows; lab → no grip; corridor → no grip
  - drag grip to 6×3 → dashed preview with `6×3`, release → room grows, south doors on the new south wall
  - drag into another piece → red preview, release → unchanged
  - drag up-left → 1×1
  - rotate a resized room (R), move it, undo, reload the page → size kept / restored as expected
  - right-click and `R` during a resize drag do nothing
  - print preview (Cmd+P) draws the resized room, no grip
  - zoom 0.5 and 1.5 → grip still easy to grab; touch emulation in devtools → grip draggable

- [ ] **Step 6: Commit** `feat(ui): resize rooms with a corner grip`
