# Placed doors — design

## Intent

Room doors come from the catalogue: every sickbay has a door on its south wall and one on its west
wall, at fixed cells. Connect a corridor to only one of them and the other is drawn as an opening
into nothing, which looks wrong. The game master wants to decide where each room's doors are — any
wall, any number — and to have a room show only the doors they put there.

## Goals

- The game master places doors on any outer wall segment of any room, and removes them.
- A room shows exactly the doors placed on it, connected or not.
- Rooms dropped from the catalogue start with no doors.
- The first-run sample and `examples/kestrel-4.json` show the same station as today, with doors
  placed only where something connects.

## Non-goals

- Changing corridors. Corridors keep their fixed openings from the catalogue.
- Changing the airlock's outer exit (`ext` ports). It stays fixed. Only inner doors are placed.
- Doors on diagonal connections (none exist today; diagonals hold no bulkhead).
- A per-room "door count" in the catalogue, door templates, or copy/paste of doors.
- Migrating old data (user: "don't bother migrating old data"). Plans saved before this change
  still load, but their rooms have no doors until the game master places them; room-edge entries
  in their `bulkheads` are pruned on load like any other dangling bulkhead.

## Anti-goals

- A door that can only be removed by deleting the room.

## Behaviour (decided with the user)

- **Placing:** pick a type in the existing bulkhead palette (open passage, door, pressure bulkhead,
  airlock, welded shut). A red dot appears on every free outer wall segment of every room, whether
  or not anything is on the other side. Clicking a dot places a door of the picked type there.
- **Removing:** click a door on the plan to select it, then press `Del`/`Backspace` or the
  Inspector's delete button. The wall segment becomes plain wall.
- **New rooms** from the catalogue (drag or click-to-place) have no doors.

## Behaviour (my calls, accepted by the user in the playback)

- With a type picked, clicking an **existing** door retypes it, as clicking a connection does with
  the bulkhead tool today. Clicking a corridor–corridor connection keeps working as today.
- A door with nothing on the other side is drawn as a door of its type on the wall — an intended
  door, not an error. It is not counted in the status bar's open ends, and gets no "open port"
  circle.
- **Connections:**
  - corridor ↔ room: the corridor's port faces a room wall segment that holds a door;
  - room ↔ room: two rooms share a wall segment and at least one of them has a door on it;
  - corridor ↔ corridor: unchanged.
  - A corridor port facing a room wall without a door is an open end (red dot, counted), as a
    dangling corridor is today.
- Doors belong to their room: moving or rotating a room carries its doors.
- **Resizing** keeps the existing rule, applied to the room's placed doors instead of catalogue
  ports: a door stays on the same wall, the same number of cells from that wall's left/top end,
  clamped to the wall's last cell; doors landing on the same segment merge (first kept). The
  accepted rotation quirk from the resize design (`2026-10-21-room-resize-design.md`) carries over
  unchanged.
  Shrinking saves the clamped and merged doors; growing the room back does not restore them, and
  undo is the way back (my call — positions are ordinary plan data now, like everything else the
  game master edits).
- **Deleting a door** leaves any corridor that was attached in place, now unconnected.
- **Sample data** (decided with the user: unused catalogue doors are dropped): the first-run
  sample (`src/domain/sample.ts`) and `examples/kestrel-4.json` are rewritten by hand to place a
  door only where a room connects today, with the bulkhead type that connection has today. A test
  pins that the sample's connections and fragment count are unchanged.

## Data (my calls)

- A placed door is stored on its room piece, in the module's own frame (rotation 0), like the size:
  `Piece.doors?: { x: number; y: number; dir: 0 | 2 | 4 | 6; type: BulkheadType }[]` (exact shape
  is the builder's call). Own frame means rotation and movement carry doors for free and resizing
  remaps them with the existing function. A corridor piece never has `doors`.
- A door's type lives on the door, not in `plan.bulkheads`, because an unconnected door has no
  connection edge to key it by. `plan.bulkheads` keeps only corridor–corridor connections.
  `bulkheadAt` for a room connection returns the door's type.
- **One door per segment (my call).** A wall segment shared by two rooms holds at most one door,
  stored on whichever room it was placed from. The placement dot shows once per segment, and
  selecting, retyping and deleting act on that one door, so a selected door is identified by its
  edge key. Validation rejects a plan with doors on both sides of one shared segment.
- Wall segments that can hold a door: every edge between a room cell and a cell outside that room
  (this includes the L-shaped lab). Validation rejects a door not on such a segment, a diagonal
  `dir`, or two doors on the same segment of one room.
- `ModuleDef.ports` stays in the catalogue for corridors and `ext`; room entries can be emptied
  or removed (builder's call). It no longer gives rooms their doors.
- `doors` is an optional field, so `schemaVersion` stays `1` and there is no migration step (my
  call, following "don't bother migrating").

## Interaction details

- The red placement dots replace nothing: in bulkhead mode the board shows the dots on free room
  wall segments and the existing dashed circles on connections, so both can be clicked.
- Doors on the plan must be selectable even when unconnected (today only connection edges are).
  The Inspector shows the selected door's type and a delete button, reusing the connection card's
  layout where it fits.
- The Inspector hint text and `inspector.placingBulkheadHint` change to mention placing doors on
  walls (en + pl).

## Constraints

- Logic in pure, tested functions: door wall segments, connection rules, resize remap in
  `domain/` and `storage/`; `ui/` only wires them.
- Every plan mutation `snapshot()` → new `Plan` → `commit()`.
- No hard-coded UI text; no new dependencies; role tokens only (a new token goes into both
  `app.css` and `print.css`).
- Print view draws placed doors exactly as the board does (it already shares `PlanDrawing`).
- Every PR carries proof per `CLAUDE.md`: a GIF of placing, retyping and deleting a door, plus the
  the connection-rule tests failing on `main` and passing on the branch.

## Left to the builder

- Exact data shape and naming.
- Dot size, hover style and hit area (touch-usable at zoom 0.5–1.5, like the resize grip).
- Whether the Inspector's door card is a new component or an extension of the connection card.
