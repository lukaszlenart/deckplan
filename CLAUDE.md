# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Deckplan

Browser editor for space station deck plans built from catalogue modules on a 40 × 28 grid, a game
master aid for sci-fi tabletop RPGs. Browser-only, no backend. The single plan lives in
`localStorage`. UI in English and Polish.

## Commands

- `npm run dev` — dev server (http://localhost:5173)
- `npm run build` — typecheck + production build (`base: './'`, served from any folder)
- `npm run preview` — preview the production build
- `npm test` — Vitest, node environment; unit tests live next to source as `src/**/*.test.ts`
- `npx vitest run src/domain/analysis.test.ts` — one file; add `-t "<name>"` for one test
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint + Prettier check (`npm run format` to fix)

Full check before committing: `npm run typecheck && npm test && npm run lint`. CI
(`.github/workflows/ci.yml`) runs lint, typecheck, test and build on pull requests;
`deploy.yml` runs it again and deploys every push to `main` to GitHub Pages.

There is no DOM test setup. UI changes are verified by hand in the dev server; keep logic in
pure functions (`domain/`, `storage/`, `ui/pointer.ts`, `ui/store.ts`) so it is testable.

## Architecture

- `src/domain/` — `types.ts` (`Plan`, `Piece`, `ModuleDef`, `Dir`, `EdgeKey`, `GRID`),
  `catalogue.ts` (`MODULES`, `GROUPS`; module ids `K1`–`K9`, `M1`–`M3`, `O1`–`O4`, `T1`–`T3`
  are stable identifiers in saved plans, codes are `WY-<id>`), `geometry.ts` (`shape(id, r)`
  memoized rotation, `edgeKey`, `edgeCenter`, `portPoint`, `placementOffset`), `analysis.ts`
  (`canPlace`, `analyze` → connections, open ports, fragments; `bulkheadAt`, `pruneBulkheads`),
  `sample.ts` (first-run plan; keep in sync with `examples/kestrel-4.json`).
- `src/storage/` — `PlanRepository` (`load`/`save`, synchronous), `LocalStorageRepo` under
  `deckplan/plan`. Every read passes through `migrate()` (legacy single-file format: `t` →
  `module`, Polish `doors` → `bulkheads`) and then the Zod `PlanSchema`; a compile-time check
  keeps the schema and the `Plan` type in sync. Unreadable data is copied to
  `deckplan/plan.corrupt` first. `backup.ts` does JSON export/import; import also rejects
  overlapping or off-grid pieces and prunes dangling bulkheads.
- `src/i18n/` — `en.ts` defines the keys and the `Messages` type; `pl.ts` must match it (tested).
  `useT()` for UI strings, `useLocalize()` for catalogue `Localized` values, `usePlural()` for
  `unit.cell.*`. The language is a signal, stored under `deckplan/lang`.
- `src/ui/` — Preact + `@preact/signals`, one screen, no router. `store.ts` holds every signal
  (plan, analysis, selection, pending placement, bulkhead tool, drag, zoom, toast) and every
  mutation. `pointer.ts` is the pure drag reducer (`beginNewDrag`/`beginMoveDrag`/
  `beginBulkheadDrag`, `moveDrag`, `rotateDrag`, `resolveDrop`) plus `cellAt`/`nearestEdge`;
  `Board.tsx` wires it to pointer events. `shortcuts.ts` maps keys. `svg/` holds the JSX shape
  helpers shared by the board, the ghost preview and palette thumbnails.
- `src/styles/app.css` — the editor stylesheet. The screen palette in `:root` is the dark
  terminal look of the Hadley's Hope map (one theme, no light/dark switch); stacks under 760px.
  `print.css` redefines the same tokens with the light paper palette, hides the editor and shows
  `ui/PrintSheet.tsx`, which draws the plan through the same `svg/PlanDrawing.tsx` as the board,
  cropped by `planBounds`. Components use role tokens (`--bh-door`, `--bh-pressure`,
  `--bh-airlock`, `--bh-welded`, `--ext`, `--hab`/`--ops`/`--tech`), never raw colours, so both
  palettes stay complete; a token added to one must be added to the other.
- `src/pwa/` — hand-written `sw.js`; a plugin in `vite.config.ts` prepends the precache list and
  a content-hashed cache name at build time. Registered only in production builds.

## Conventions

- Every plan mutation in the store is `snapshot()` (undo history, max 60) → build a new `Plan`
  object → `commit()` (sets the signal, saves through the repository; a failed save becomes the
  `storageError` banner). Only `renameStation` skips the snapshot. Never mutate `plan.value` in
  place.
- Directions are 0–7 clockwise from north (`DX`/`DY`). Corridors use even values except the 45°
  pieces. `opposite` is +4, `rotateDir` is +2. Ports are `[cellX, cellY, dir]` relative to the
  module's top-left at rotation 0; two modules connect when facing ports meet.
- Bulkhead keys are `x,y,E` or `x,y,S`; north/west ports normalise to the neighbour's edge.
  Diagonal connections have no key and cannot hold a bulkhead. Only explicitly set bulkheads
  are stored; `bulkheadAt` supplies the default (`door` next to a room, `open` otherwise).
- Pieces store module ids, not names, so switching language translates the whole plan.
- Domain and storage code never import from `ui/` (enforced by ESLint).
- No hard-coded UI text in components — only keys from `src/i18n/`. Code, comments and commits
  in English.
- Do not add dependencies outside the stack (Vite, TS, Preact, @preact/signals, Zod, Vitest,
  ESLint, Prettier) without asking.
