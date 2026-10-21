# Room Sketches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every room a floor-plan sketch with the name and code laid over it, make the Lab a 2×2 rectangle, and stop the resize grip from shrinking a room below its catalogue size.

**Architecture:** Sketches are JSX fragments keyed by module id, drawn in the module's own frame at catalogue size. `RoomShape` places them on the board through one SVG transform, computed by a pure tested function that rotates them with the room and centres them in a resized one. The minimum size is one geometry helper, used by the drag reducer, `resizePiece` and the schema.

**Tech Stack:** TypeScript, Preact, SVG, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-21-room-sketches-design.md`

## Global Constraints

- No new dependencies; no hard-coded UI text (sketches carry no text; the label is the existing `short` + `code`).
- Components use role tokens, never raw colours; a token added to `app.css` is added to `print.css` too.
- Domain and storage never import from `ui/`.
- `migrate()` unchanged, `schemaVersion` stays `1`. No repair of existing saved plans.
- The sample plan and `examples/kestrel-4.json` must still load (neither contains `O2` or a resized room below catalogue size).
- Full check before every commit: `npm run typecheck && npm test && npm run lint`.
- Commits: conventional (`feat(domain): …`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A rotated room (r = 1, 2, 3): the sketch turns with it and stays inside the walls; the label reads upright. Pinned by `sketchTransform` tests in Task 3.
- A resized room bigger than catalogue size: the sketch stays at catalogue size, centred, including when rotated. Pinned in Task 3.
- Resize grip dragged above/left of a rotated room: clamps to the rotated catalogue size (screen axes swapped). Pinned in Task 2.
- A stored piece with `w`/`h` below catalogue size: the schema rejects it. Pinned in Task 2.
- A new room module added without a sketch: a test fails. Pinned in Task 4.

---

### Task 1: Lab becomes a 2×2 rectangle

**Files:**
- Modify: `src/domain/catalogue.ts` (the `O2` entry)
- Modify: `src/domain/catalogue.test.ts` (`keeps the legacy shapes`)
- Modify: `src/domain/geometry.test.ts` (`rotates an L-shaped room clockwise`, `lists every outer wall segment of a room`)
- Modify: `src/storage/schema.test.ts` (`rejects bad sizes`)

**Interfaces:**
- Produces: `MODULES.O2.cells` equals `rect(2, 2)`; `isResizable('O2') === true`.

- [ ] **Step 1: Update the tests to the new shape**

In `catalogue.test.ts` replace the `O2` expectation:

```ts
expect(MODULES.O2?.cells).toEqual([
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
])
```

Add to the same file: `expect(isResizable('O2')).toBe(true)` (import from `./geometry`).

In `geometry.test.ts` replace `rotates an L-shaped room clockwise` with `rotates a room clockwise`:

```ts
const s = shape('O3', 1)
expect(s.w).toBe(1)
expect(s.h).toBe(2)
expect(s.cells).toEqual([
  [0, 0],
  [0, 1],
])
expect(s.ports).toEqual([])
```

Keep `wallSegments(... 'O2' ...)` at length 8 (a 2×2 also has 8 outer segments).

In `schema.test.ts`, the non-resizable case `{ module: 'O2', …, w: 3, h: 3 }` becomes `{ module: 'K1', …, w: 3, h: 3 }`.

- [ ] **Step 2: Run to see the catalogue test fail**

Run: `npx vitest run src/domain`
Expected: FAIL in `keeps the legacy shapes` (O2 has 3 cells) and the `isResizable('O2')` assertion.

- [ ] **Step 3: Change `O2` to `rect(2, 2)` in `catalogue.ts`**

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS. If an `analysis` or `store` test relied on the L-shape, adapt its expectation, not the catalogue.

- [ ] **Step 5: Commit** — `feat(domain): make the laboratory a 2×2 room`

---

### Task 2: Catalogue size is the minimum size

**Files:**
- Modify: `src/domain/geometry.ts` (new `minScreenSize`, `resizePiece` clamp)
- Modify: `src/ui/pointer.ts` (resize `DragState` gets `minW`/`minH`; `beginResizeDrag`, `moveDrag`)
- Modify: `src/storage/schema.ts` (`PieceSchema` refine)
- Test: `src/domain/geometry.test.ts`, `src/ui/pointer.test.ts`, `src/storage/schema.test.ts`

**Interfaces:**
- Produces: `minScreenSize(id: ModuleId, r: Rotation): Size` in `geometry.ts` — `baseSize(id)` with `w`/`h` swapped for odd `r`.

- [ ] **Step 1: Write the failing tests**

`geometry.test.ts`:

```ts
it('takes the catalogue size, turned, as the minimum screen size', () => {
  expect(minScreenSize('T1', 0)).toEqual({ w: 2, h: 4 })
  expect(minScreenSize('T1', 1)).toEqual({ w: 4, h: 2 })
})

it('never resizes a room below its catalogue size', () => {
  const reactor = { id: 1, module: 'T1', x: 0, y: 0, r: 0 as const }
  expect(resizePiece(reactor, 1, 1)).toEqual(reactor)
  expect(resizePiece({ ...reactor, r: 1 }, 3, 1)).toEqual({ ...reactor, r: 1 })
  expect(resizePiece({ ...reactor, r: 1 }, 6, 1)).toEqual({ ...reactor, r: 1, w: 2, h: 6 })
})
```

`pointer.test.ts` — replace `clamps to 1×1 above or left of the origin` with:

```ts
it('clamps to the catalogue size above or left of the origin', () => {
  let d = beginResizeDrag(hangar, { x: 160, y: 90 })
  d = moveDrag(d, { x: 100, y: 50 }, [0, 0], null)
  expect(resolveDrop(d)).toEqual({ kind: 'resize', id: 7, w: 4, h: 2 })
})

it('clamps a rotated room to its turned catalogue size', () => {
  let d = beginResizeDrag({ ...hangar, r: 1 }, { x: 160, y: 90 })
  d = moveDrag(d, { x: 100, y: 50 }, [0, 0], null)
  expect(resolveDrop(d)).toEqual({ kind: 'resize', id: 7, w: 2, h: 4 })
})
```

`schema.test.ts` — add to `rejects bad sizes`:

```ts
expect(() => parsePlan(at({ w: 3, h: 2 }))).toThrow()
expect(() => parsePlan(at({ w: 4, h: 1 }))).toThrow()
expect(() =>
  parsePlan(makePlan([{ module: 'O4', x: 0, y: 0, r: 1, w: 4, h: 2 }])),
).not.toThrow()
```

(`w`/`h` are stored in the module's own frame, so rotation does not change the check.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain/geometry.test.ts src/ui/pointer.test.ts src/storage/schema.test.ts`
Expected: FAIL — `minScreenSize` not exported; drag resolves 1×1; schema accepts 3×2.

- [ ] **Step 3: Implement**

- `minScreenSize` as above.
- `resizePiece`: clamp `screenW`/`screenH` to `minScreenSize(p.module, p.r)` instead of `1`.
- Resize `DragState`: add `minW: number; minH: number`, set in `beginResizeDrag` from `minScreenSize(piece.module, piece.r)`; `moveDrag` clamps with them instead of `1`. Update the `starts at the current screen size…` test's `toMatchObject` only if it breaks.
- `PieceSchema`: a refine `'smaller than the catalogue size'` — when `w`/`h` are set and the module is resizable, `w >= baseSize.w && h >= baseSize.h`.

- [ ] **Step 4: Run the full suite** — `npm test`, expect PASS.

- [ ] **Step 5: Commit** — `feat(domain): keep resized rooms at least at catalogue size`

---

### Task 3: Sketch frame transform

**Files:**
- Create: `src/ui/svg/sketchFrame.ts`
- Test: `src/ui/svg/sketchFrame.test.ts`

**Interfaces:**
- Produces: `sketchTransform(x: number, y: number, r: Rotation, size: Size, base: Size): string` — an SVG `transform` that maps the module's own frame at catalogue size `base` onto the board, with `(x, y)` the top-left of the rotated bounding box and `size` the piece size in its own frame (rotation 0). Also `applySketchTransform(...same, point: [number, number]): [number, number]` used only by the tests, applying the same maths numerically, so the string and the maths cannot drift.

Maths: centre offset `dx = (size.w − base.w) / 2`, `dy = (size.h − base.h) / 2`; then rotate clockwise `r` quarter turns inside a `size.w × size.h` box: `(u, v) → r=1: (size.h − v, u)`, `r=2: (size.w − u, size.h − v)`, `r=3: (v, size.w − u)`; then add `(x, y)`. Emit as `translate(…) rotate(90·r) translate(dx dy)` with the rotation's translation folded into the first translate (`r=1: (h, 0)`, `r=2: (w, h)`, `r=3: (0, w)`).

- [ ] **Step 1: Write the failing tests**

```ts
const base = { w: 2, h: 4 }
it('leaves an unrotated catalogue-size room in place', () => {
  expect(applySketchTransform(3, 5, 0, base, base, [0, 0])).toEqual([3, 5])
  expect(applySketchTransform(3, 5, 0, base, base, [2, 4])).toEqual([5, 9])
})
it('turns the sketch with the room', () => {
  // top-left corner of the sketch goes to the screen top-right at r=1
  expect(applySketchTransform(0, 0, 1, base, base, [0, 0])).toEqual([4, 0])
  expect(applySketchTransform(0, 0, 2, base, base, [0, 0])).toEqual([2, 4])
  expect(applySketchTransform(0, 0, 3, base, base, [0, 0])).toEqual([0, 2])
})
it('centres the sketch in a resized room, rotated too', () => {
  const size = { w: 4, h: 6 }
  expect(applySketchTransform(0, 0, 0, size, base, [0, 0])).toEqual([1, 1])
  expect(applySketchTransform(0, 0, 1, size, base, [0, 0])).toEqual([5, 1])
})
it('emits the transform the maths describes', () => {
  expect(sketchTransform(0, 0, 1, base, base)).toBe('translate(4 0) rotate(90) translate(0 0)')
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/svg/sketchFrame.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Implement both functions in `sketchFrame.ts`.**

- [ ] **Step 4: Run** — expect PASS.

- [ ] **Step 5: Commit** — `feat(ui): place room sketches through rotation and resize`

---

### Task 4: Sketches drawn in every room

**Files:**
- Create: `src/ui/svg/roomSketches.tsx`
- Test: `src/ui/svg/roomSketches.test.ts`
- Modify: `src/ui/svg/RoomShape.tsx` (props + drawing order + label halo)
- Modify: `src/ui/svg/ModuleThumb.tsx`, `src/ui/svg/Ghost.tsx`, `src/ui/svg/PlanDrawing.tsx` (pass `r` and size)
- Modify: `src/styles/app.css`, `src/styles/print.css` (tokens)

**Interfaces:**
- Consumes: `sketchTransform` (Task 3); `baseSize`, `pieceSize` from `geometry.ts`.
- Produces: `ROOM_SKETCHES: Readonly<Record<ModuleId, () => JSX.Element>>` — each fragment in the module's own frame, `0…base.w × 0…base.h`, strokes only via `class`/`stroke="currentColor"` so the colour comes from the wrapping `<g>`.

- [ ] **Step 1: Write the failing test**

```ts
it('has a sketch for every room and nothing else', () => {
  const rooms = Object.values(MODULES).filter((d) => d.kind === 'room').map((d) => d.id).sort()
  expect(Object.keys(ROOM_SKETCHES).sort()).toEqual(rooms)
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/svg/roomSketches.test.ts` — expect FAIL (module missing).

- [ ] **Step 3: Write the ten sketches in `roomSketches.tsx`**

Port the geometry from the approved mockup
`.superpowers/brainstorm/57794-1792593672/content/all-rooms.html` (one `<svg>` per room, the `<g class="s">` contents), with the Lab at 2×2. The mockup draws the Airlock's outer door itself; drop that — `RoomShape` already draws `ext`. Line weight: `stroke-width` 0.03 (0.035 on technical rooms), `fill="none"`, `stroke-linejoin="round"`; the Reactor core dot is the only filled shape (`fill="currentColor"`).

- [ ] **Step 4: Run** the test — expect PASS.

- [ ] **Step 5: Tokens**

`app.css` `:root`: `--sketch-hab: #4fa868; --sketch-ops: #4fa868; --sketch-tech: #2f7a45;`
`print.css`: `--sketch-hab: #8fa9b4; --sketch-ops: #b0a68a; --sketch-tech: #bf9a80;`

- [ ] **Step 6: Draw the sketch in `RoomShape`**

- Props: `piece: Pick<Piece, 'module' | 'x' | 'y' | 'r' | 'w' | 'h'>` (was `module | x | y`).
- Between the class-fill `<rect>`s and the walls `<path>`: `<g transform={sketchTransform(p.x, p.y, p.r, pieceSize(p), baseSize(p.module))} color={`var(--sketch-${d.cls})`}>{ROOM_SKETCHES[p.module]?.()}</g>`.
- Labels: add `paint-order="stroke"`, `stroke={`var(--${d.cls})`}`, `stroke-width` ≈ `fs * 0.2` (name) / `fs * 0.15` (code) — tune by eye.
- Callers: `PlanDrawing` already passes the full piece; `Ghost` passes `placed` — make sure it carries `r` and its size (`placed.size` → `w`/`h`); `ModuleThumb` passes `{ module: id, x: 0, y: 0, r: 0 }`.

- [ ] **Step 7: Typecheck and lint** — `npm run typecheck && npm run lint`, expect clean.

- [ ] **Step 8: Verify by hand** (`npm run dev`, http://localhost:5173)

Check, and screenshot for the PR:
1. Every room placed once on the board — each recognisable, label readable over it.
2. The same rooms rotated 90°, 180°, 270° — sketch turns, label upright, nothing crosses a wall.
3. A Reactor resized to 4×6 — sketch at catalogue size, centred.
4. The Lab at 2×2, with the grip.
5. Palette thumbnails and the placement ghost show sketches, no labels.
6. Print preview (browser print dialog) — sketches in light tones on paper.
7. GIF: dragging the grip of a Hangar up-left stops at 4×2.

- [ ] **Step 9: Commit** — `feat(ui): draw a floor-plan sketch in every room`

---

## After the last task

Run `npm run typecheck && npm test && npm run lint && npm run build`, then `/security-review` on the branch diff, then open the draft PR with the screenshots and GIF from Task 4 Step 8 committed to the `pr-assets` branch under `pr-<number>/`.
