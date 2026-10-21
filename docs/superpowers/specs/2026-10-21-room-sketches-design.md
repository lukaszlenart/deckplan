# Room sketches — design

## Intent

Now that doors are placed on walls, every room on the board looks the same: a filled rectangle in
its class colour with a name and a code. A game master glancing at a plan, on screen or printed,
should know which room is the Reactor and which is the Sickbay from the drawing alone, without
reading the label.

Each room gets a floor-plan sketch of what is inside it: beds, consoles, pipes, crates. The name and
code are laid over the sketch.

## Goals

- Every room module has its own sketch, drawn in the style of furniture on an architect's floor
  plan. Thin, dim lines, so the name and code stay readable on top of it.
- The sketch appears wherever a room is drawn: on the board, on the printed sheet, in the palette
  thumbnails and in the placement ghost.
- The Laboratory `O2` becomes a plain 2×2 rectangle instead of an L-shape.
- A room's catalogue size becomes its minimum size. The resize grip (PR #7) no longer shrinks a room
  below it.

## Non-goals

- Sketches for corridors.
- Rearranging or scaling a sketch when a room is resized. The user said "keep it as is for now".
- New rooms, or changes to any catalogue size other than the Lab's.
- Changing how doors or bulkheads are drawn.

## Anti-goals

- A sketch loud enough to compete with the label, the walls or the doors. The mockup's style A
  (dim lines on the class fill) is the target. Style B, a big filled symbol, was rejected.
- Hard-coded colours. Sketch strokes use role tokens defined in both `app.css` and `print.css`.
- Breaking the sample plan or `examples/kestrel-4.json`. Other saved plans are not protected (see "Saved plans").

## The sketches (agreed with the user from the mockup)

The mockup lives in
`.superpowers/brainstorm/57794-1792593672/content/all-rooms.html`. It is not committed, so treat its
SVG as a reference to copy from, not as a contract. The user approved it with "looks good".

| Module | Room | Size | Sketch |
|---|---|---|---|
| M1 | Cabin | 1×1 | bunk with pillow, locker |
| M2 | Mess hall | 3×2 | galley counter on the top wall, two tables with benches, a second counter row |
| M3 | Sickbay | 2×2 | two beds in the top corners, surgery table with a cross, two med carts |
| O1 | Bridge | 3×2 | viewscreen along the top wall, curved console arc, command chair, two side consoles |
| O2 | Laboratory | 2×2 | L-shaped bench along two walls, sample racks, round specimen tank |
| O3 | Storage | 2×1 | four crosshatched crates at the short walls, a shelf |
| O4 | Hangar | 4×2 | shuttle silhouette, dashed pad line, dashed bay-door marking on the right wall, corner marks |
| T1 | Reactor | 2×4 | concentric core rings, coolant pipes running into the top and bottom walls |
| T2 | Hydroponics | 4×1 | two planter rows with plants |
| T3 | Airlock | 1×1 | inner and outer hatch lines, suit racks |

The name and code are drawn over the sketch, centred as they are today, with a halo in the board
colour (`paint-order: stroke`) so they stay readable where they cross a line. The user wanted to
"see how it looks", so the label's position and size are open to tuning after the first build.

## Behaviour (my calls, said to the user)

- **Rotation.** The sketch is drawn in the module's own frame at rotation 0 and turns with the room,
  so pipes stay on their walls. Today the label is drawn after rotation and reads upright. Keep it
  that way.
- **Resized rooms.** The sketch keeps its catalogue size and sits centred in the bigger room. A
  Reactor stretched to 3×5 therefore has pipes that stop short of the walls. That is accepted for
  now.
- **Thumbnails and ghost.** Today they hide the label (`thumb`). They show the sketch without the
  label.

## Lab becomes 2×2

`O2`'s cells become `rect(2, 2)`. It becomes resizable automatically, because `isResizable` is
derived from the cells. Update the tests that pin the L-shape: `catalogue.test.ts`,
`geometry.test.ts` (rotated shape and wall-segment count) and `schema.test.ts`, which currently
relies on `O2` being non-resizable. Move that schema case to a module that still cannot be resized,
such as a corridor.

Saved plans are affected. A stored Lab gains a fourth cell, and in an existing plan that cell may
already be taken by another piece. See "Saved plans" below.

## Catalogue size as minimum

The resize drag clamps to the module's `baseSize` in its own frame instead of to 1×1.
`ui/pointer.ts` currently clamps with `Math.max(1, …)`, and rotation 1 and 3 must swap the screen
axes. `PieceSchema` must reject a stored `w`/`h` below the catalogue size.

## Saved plans

**No repair (decided by the user: "no saved plans to protect").** Neither the sample plan nor
`examples/kestrel-4.json` contains a Lab or a shrunk room.

Some existing data becomes invalid:

- a room stored with `w`/`h` below its catalogue size;
- a Lab door on the L-shape's old inner corner, which is inside the room once it is 2×2.

The existing paths handle both. On load, the schema rejects the plan, which is then copied to
`deckplan/plan.corrupt`. On import, the file is refused.

A Lab whose new fourth cell overlaps another piece still loads from `localStorage`. The load path
does not check overlaps, and that case is accepted too. Import of such a file is refused by the
existing overlap check.

`migrate()` stays unchanged and `schemaVersion` stays `1` (my call).

## Drawing

- Sketch data lives in one place keyed by module id, in pure JSX shape helpers under `ui/svg/`. It
  is drawn by `RoomShape.tsx` between the class fill and the walls, before door gaps are cut.
- A test checks that every room module in `MODULES` has a sketch, so a new room cannot ship without
  one.
- Add a sketch stroke token (e.g. `--room-sketch`) to `app.css` (dim green, like the mockup's
  `#4fa868` on habitation and operations rooms and `#2f7a45` on technical ones) and to `print.css`
  (a light grey on paper). If one token is not enough for the three class fills, use one per class.
  Either way, add each token to both files.

## Constraints

- Verify by hand in the dev server and on the print preview. There is no DOM test setup.
- Follow the pull-request proof rule in `CLAUDE.md`: a screenshot of the board with every room, the
  print view, a rotated room, a resized room, and the Lab at 2×2. Add a GIF of the grip refusing to
  shrink below the catalogue size.
- No new dependencies, and no hard-coded UI text.

## Left to the builder

- Exact sketch geometry, stroke widths and how dense each sketch is. Match the mockup.
- Whether sketches are path strings or small JSX fragments.
- Label size and position over the sketch, within "centred, readable".
