# Room resize — design

## Intent

Catalogue sizes are one-size-fits-all: the hangar (4×2) barely outsizes the bridge (3×2). A game
master wants each station to have its own hangar, bridge or mess hall — a cavernous 6×4 bay on one
station, a cramped 3×2 dock on another. Resizing is per placed piece; the catalogue stays as it is
and only supplies the starting size.

## Goals

- Every rectangular room on the board can be resized after placement by dragging a grip.
- The size is saved with the piece, survives reload, export/import, undo, move and rotate, and is
  drawn everywhere the plan is drawn (board, print view).
- Plans saved before this change load unchanged.

## Non-goals

- Resizing corridors (a longer corridor is more corridor pieces).
- Resizing non-rectangular rooms. Today that is only `O2` Laboratory (L-shape); it gets no grip.
- Redesigning doors. The user will remodel door placement as a separate feature later; this design
  only keeps existing doors sensible when a room changes size.
- Changing catalogue default sizes, the palette thumbnails, or adding a numeric size input.

## Anti-goals

- Breaking or silently altering existing saved plans or exported JSON files.
- A resize that leaves a room overlapping another piece or hanging off the 40×28 grid.

## Behaviour (decided with the user)

- **Grip:** selecting a resizable room shows a single grip at its bottom-right corner on screen
  (option B in the brainstorm mockup). Dragging it moves the right and bottom walls; the top-left
  corner stays anchored.
- **Doors:** a door stays on the same wall, the same number of cells from that wall's left/top end,
  and moves with its wall. "Good enough until doors are remodelled."

## Behaviour (my calls, accepted by the user in the playback)

- The size snaps to whole cells. While dragging, a dashed outline shows the new footprint with a
  `W×H` label. The outline turns red (`--bad`) when the footprint would overlap another piece or
  leave the grid; releasing there cancels the resize and the room keeps its old size.
- Minimum 1×1, no maximum beyond the grid.
- The grip is always at the screen bottom-right, whatever the room's rotation. Width and height
  shown and dragged are screen width and height.
- One resize drag is one undo step (`snapshot()` → new `Plan` → `commit()`, as every mutation).
- Resizable rooms: every room whose catalogue cells form a full rectangle — today M1, M2, M3, O1, O3,
  O4, T1, T2, T3. Derive this from the cells, don't hard-code the list.
- A drag that ends at the original size, or never passes `DRAG_THRESHOLD`, changes nothing and
  creates no undo step.

## Doors when the size changes

Ports and external ports (`ext`, e.g. the airlock's outer door) are remapped in the module's own
frame (rotation 0, before rotating):

- north port `(x, 0, 0)` → `(min(x, w−1), 0, 0)`
- south port `(x, h₀−1, 4)` → `(min(x, w−1), h−1, 4)`
- west port `(0, y, 6)` → `(0, min(y, h−1), 6)`
- east port `(w₀−1, y, 2)` → `(w−1, min(y, h−1), 2)`

where `w₀×h₀` is the catalogue size and `w×h` the new size. A door that would fall past the end of
its wall clamps to the wall's last cell. If two doors land on the same cell and direction, keep one.
All current resizable rooms only have orthogonal ports on their outer walls; a port that is not on
an outer wall is a catalogue error worth a test, not a case to handle.

Rotated pieces: the stored size is in the module's own frame (see Data). The grip works in screen
space, so for rotation 1 and 3 the screen width/height map to the stored height/width. Because the
anchor is the screen top-left and `piece.x/y` is already the top-left of the rotated bounding box,
this falls out of applying `shape()`'s rotation to the resized rectangle.

**Known quirk (accepted by the user):** doors are remapped in the module's own frame, so at
rotation 2 or 3 a door can slide along a wall that stays still on screen. Example: Bridge `O1` at
r=2 has its door on the screen's top wall at screen x=1; widening it to 5 puts the door at screen
x=3. At r=0 and r=1 doors behave as described above. The user accepted this until doors are
remodelled; it keeps the data to `w`/`h` only. Pin the behaviour with a test so the door remodel
changes it deliberately.

**Bulkheads** follow the existing move behaviour, not a new rule: after a resize, `pruneBulkheads`
runs; a bulkhead survives if its edge is still a connection, otherwise it is dropped. (During the
playback I guessed a bulkhead would "move with its door"; in practice a moved door no longer meets
the corridor it met before, so the edge disappears anyway. Same as dragging a piece today.)

## Data

- `Piece` gains optional `w?: number` and `h?: number` — the size in the module's own frame
  (rotation 0). Absent means catalogue size. Store them only when they differ from the catalogue
  size, so untouched plans and exports stay byte-identical. A resize back to catalogue size removes
  them again (my call).
- `PlanSchema` gets matching optional positive-integer fields; the compile-time schema/type check
  must still pass. `schemaVersion` stays `1`: the change is additive and old readers are not a
  concern (single-user, browser-only, no older deployed reader of new data that matters). Sizes on a
  non-resizable module are invalid data (reject in the schema). The schema also caps `w`/`h` at the
  grid size, because loading from `localStorage` does not run the overlap/off-grid check (my call).
- `shape()` takes the size into account and memoizes on `id|r|w|h`. Every caller that currently
  passes `(p.module, p.r)` for a placed piece must pass the piece's size — occupancy, `canPlace`,
  `analyze`, `planBounds`, drawing (`CorridorLayer`, `PlanDrawing`, `Ghost`, the `Board` selection
  outline), print, and the cell count in `ui/Inspector.tsx`. A helper taking a `Piece` is the obvious shape for this;
  builder's call.
- Import (`backup.ts`) already rejects overlapping/off-grid pieces via `canPlace`; it must use the
  resized footprint.
- Move and rotate of a resized piece keep its size. Placing a new piece from the palette uses the
  catalogue size.

## Drawing

Rooms are drawn from `shape()` cells and ports through `svg/PlanDrawing.tsx`, so the board and print
view pick up the new footprint without separate work. Check the room label still centres and that a
1×1 version of a multi-cell room still renders legibly. The grip and the dashed preview use existing
role tokens (`--accent`, `--bad`, …); if a new token is needed, add it to both `app.css` and
`print.css` (convention). The grip is not printed.

## Constraints

- Logic stays in pure, tested functions: the resize maths (screen size → stored size, port
  remapping, clamping, validity) in `domain/`; the drag in `ui/pointer.ts` as a new `'resize'`
  `DragState` kind with `beginResizeDrag` and handling in `moveDrag`/`resolveDrop` (a `'resize'`
  `DropOutcome`); `Board.tsx` only wires pointer events.
- No new dependencies. No hard-coded UI text — the `W×H` label and any toast/aria label go through
  `src/i18n/` (en + pl).
- Rotating a selected room with a pending resize drag (the `R` key mid-drag) is not supported — R
  during a resize drag is ignored. Builder's call if a nicer behaviour is trivial.

- Pressing the grip starts a resize, never a move drag (my call).

## Left to the builder

- Grip size and hit area (must be usable on touch; the board zooms 0.5–1.5).
- Exact preview styling and label placement.
- Whether a toast confirms a resize (moves don't have one; probably no).
- Internal API naming.
