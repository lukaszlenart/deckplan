# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Deckplan is a single-file browser editor for drawing space station layouts from modular pieces on a square grid, built as a game master aid for sci-fi tabletop RPGs. The whole app is `index.html` (inline CSS + vanilla JS, no framework). The UI, code comments, catalogue names and README are in **Polish**; keep new UI strings and catalogue entries in Polish.

## Running and checking

There is no build, package manager, linter or test suite. To run: open `index.html` in a browser (or `open index.html` on macOS). Verify changes by loading the page and exercising the editor; `examples/kestrel-4.json` can be pasted into the "Zapis / odczyt JSON" modal to load a known-good plan.

The app persists state in `localStorage` under the key `wy-stacja-v1`. Clear that key (or change the key) when testing load/sample behaviour, because `load()` prefers stored state over `sample()`.

## Architecture of `index.html`

The script is one flat module split by `// ---- Section ----` comments. Read them in this order:

1. **Katalog** – `DEF` (module definitions keyed by code `K1`–`K9`, `M*`, `O*`, `T*`) built via `group()`, `corr()`, `room()`. `DOORS` lists bulkhead types.
2. **Geometria** – `shape(t, r)` returns the rotated `{cells, ports, ext, w, h}` of a module, memoized in `shapeCache`.
3. **Stan** – `state = {name, pieces, doors, nextId}`, undo `history` (JSON snapshots, max 60), `load`/`persist`/`snapshot`/`undo`/`commit`.
4. **Analiza** – `occupancy`, `canPlace`, `edgeKey`, `analyze()`.
5. **Rysowanie** – `render()` rebuilds the entire `<svg id="board">` via `innerHTML`; `renderGhost()` and `renderInspector()` update sub-parts.
6. **Akcje / Wskaźnik / Paleta / Klawiatura** – mutations and pointer/keyboard handling.

### Conventions you must preserve

- **Mutation pattern**: every state change is `snapshot(); mutate state; commit()`. `commit()` persists to localStorage and re-renders. Never mutate `state` without a preceding `snapshot()` unless undo is intentionally skipped (only `stationName` change does this).
- **Directions** are integers 0–7, clockwise from north (`DX`/`DY` tables). Corridors use only even values (0 N, 2 E, 4 S, 6 W) except the 45° pieces which use odd values. Opposite direction is `(d+4)%8`; rotating 90° clockwise is `(d+2)%8`.
- **Ports** are `[cellX, cellY, dir]` relative to the module's top-left at rotation 0. Two modules are connected when a port of one faces the matching port of the other in the adjacent cell (`analyze()` builds `portMap` keyed `"x,y,d"`). `ext` ports (currently only the airlock `T3`) mark external exits and are drawn but never connect.
- **Edge keys** for `doors` are `"x,y,E"` (right edge of cell) or `"x,y,S"` (bottom edge); `edgeKey()` normalises north/west ports to the neighbouring cell's S/E edge. Diagonal connections have no edge key and cannot hold a bulkhead. `doorType()` applies defaults: `drzwi` when a room is involved, `brak` between corridors. `pruneDoors()` drops entries whose edge no longer exists (run after moves and before export).
- **SVG coordinates** are in grid units: the board `viewBox` is `0 0 GW GH` (40×28 cells) and `width/height` are scaled by `CELL * ZOOMS[zoom]`. All drawing helpers emit coordinates in cells, so stroke widths and radii are fractions of a cell.
- **Pointer model**: palette items and board pieces start a `drag` on `pointerdown`; a move under 5px is treated as a click (select / toggle `pending` placement mode) in `onUp`. `suppressClick` guards the board `click` handler right after a drag. `pending` is click-to-place mode; `doorTool` is bulkhead-placement mode; `selected` (piece id) and `selectedDoor` (edge key) are mutually exclusive selections.
- **Catalogue codes**: the JSON uses the short key `t` (`K1`, `M2`, …) while the displayed code is `WY-` + key. Adding a module means adding one `corr()`/`room()` line in the right `group()`; everything else (palette thumbnail, placement, rendering, status counts) derives from `DEF`.

## Keeping files in sync

- `sample()` in `index.html` and `examples/kestrel-4.json` describe the same plan; update both if the sample changes.
- The README documents keyboard shortcuts, the JSON format and the module list; update it when those change.
