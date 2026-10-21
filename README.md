# Deckplan

A browser editor for space station deck plans built from ready-made modules on a square grid.
It was made as a game master aid for science fiction tabletop RPGs. It runs entirely in the
browser: no backend, no account. On screen it uses a dark green terminal look inspired by the
Hadley's Hope colony maps; printouts use light colours. The plan is stored in `localStorage`. The interface is
available in English and Polish.

## Features

- **Grid.** One corridor tile takes one cell. Rooms take 1 to 8 cells (a 1×1 cabin, a 2×4 reactor)
  and can be enlarged, never shrunk below that size. Each room shows a floor-plan sketch of what is
  inside it.
- **Corridors.** Straight, 90° corner, T-junction, crossing, 45° diagonal, straight-to-diagonal
  transitions, diagonal corner and end cap.
- **Placing.** Drag a module from the catalogue, or click it and pick a spot on the grid. A red
  preview means a collision.
- **Rotation.** `R` rotates by 90°, also while dragging.
- **Bulkheads.** They sit on connections, where a corridor meets a room or another corridor.
  Types: open passage, door, pressure bulkhead, airlock, welded shut.
- **Plan check.** Counters for open corridor ends and detached fragments of the station.
- **Saving.** The plan is saved automatically in the browser. It can also be exported and loaded
  as JSON. Undo with `Ctrl+Z` / `Cmd+Z`.
- **Printing.** **Print** (or the browser's own print command) produces an A4 landscape sheet
  with the station name and the plan, cropped to the area it uses. It always prints in the light
  colours and leaves out the editor's markers.

## Running

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (relative paths; serve it from any folder of a static host)
npm run preview    # serve the production build
```

Browsers do not load the built app from `file://`, so serve `dist/` over HTTP (for example
`npm run preview`, or any static file server on your LAN).

### Hosted version

Every push to `main` is built and deployed to GitHub Pages by `.github/workflows/deploy.yml`:
<https://lukaszlenart.github.io/deckplan/>.

On an iPad or phone, open that address in Safari and use **Share → Add to Home Screen**. The
app works offline afterwards. The plan lives only on the device it was drawn on; move it with
**Save / load JSON**.

Checks:

```sh
npm run typecheck && npm test && npm run lint
```

## Keyboard shortcuts

| Key                    | Action                                                |
| ---------------------- | ----------------------------------------------------- |
| `R`                    | rotate the selected or dragged module by 90°          |
| `Delete` / `Backspace` | delete the selected module                            |
| `1`–`5`                | pick a bulkhead type, or change the selected bulkhead |
| `Esc`                  | cancel placing and clear the selection                |
| `Ctrl+Z` / `Cmd+Z`     | undo                                                  |

## Plan format (JSON)

```json
{
  "schemaVersion": 1,
  "name": "Kestrel-4 Outpost",
  "pieces": [
    { "id": 1, "module": "K1", "x": 4, "y": 8, "r": 1 },
    { "id": 17, "module": "T1", "x": 6, "y": 9, "r": 0 }
  ],
  "bulkheads": { "7,8,S": "bulkhead", "16,5,S": "airlock" },
  "nextId": 22
}
```

- `module` is the catalogue id (`K1`–`K9` corridors, `M*` habitation, `O*` operations, `T*`
  technical). The catalogue shows it as `WY-K1` and so on.
- `x`, `y` is the top-left corner of the module on the grid (40 × 28 cells). `r` is the rotation:
  0–3, multiples of 90° clockwise.
- A key in `bulkheads` is a grid edge: `x,y,E` (right edge of the cell) or `x,y,S` (bottom edge).
  Values: `open`, `door`, `bulkhead`, `airlock`, `welded`. Connections missing from `bulkheads`
  get the default: a door next to a room, an open passage between corridors.
- `nextId` is the id the next placed module will get.

Plans exported by the previous single-file version of the app (with `t` instead of `module`
and a Polish `doors` map) still load. Browser storage is per site, so a plan drawn in that old
`index.html` is not visible here: open the old file, choose **Zapis / odczyt JSON**, copy the
text and paste it into this app's **Save / load JSON** dialog.

An example plan is in [`examples/kestrel-4.json`](examples/kestrel-4.json). To load it, open
**Save / load JSON**, paste the file's contents and choose **Load**.

## Project layout

```
src/
  domain/      types, module catalogue, geometry, placement and connectivity analysis (pure, tested)
  storage/     repository interface, localStorage implementation, Zod schema, legacy migration, JSON backup
  i18n/        typed EN/PL dictionaries; en.ts defines the keys, pl.ts must match
  ui/          Preact components, editor store (signals), pointer and keyboard helpers
  styles/      app.css, print.css
  pwa/         service worker and its precache list
```

See `CLAUDE.md` for the development conventions.

## Data safety

- A stored plan that cannot be read is copied to `deckplan/plan.corrupt` in `localStorage`
  before anything is written over it, and the app starts from the sample plan.
- Browser storage can be cleared by the browser or the user. Export the JSON regularly.

## License

[Apache License 2.0](LICENSE)
