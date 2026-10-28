# UI Builder

> **v1.1.0** · [MIT License](./LICENSE) · [中文文档](./README.zh-CN.md)

A visual UI builder: blank canvas + drag-and-drop modules → multi-device layout design → event binding / theme tokens / notes → one-click export of an interactive multi-page React project.

**Stack:** React 19 + TypeScript + Vite + dnd-kit + zustand/immer + IndexedDB (idb-keyval) + JSZip.

## Quick start

```bash
npm install
npm run dev             # http://localhost:5173
npm test                # automated tests (vitest run; watch: npm run test:watch)
npm run lint            # oxlint
npm run test:coverage   # coverage for core logic (lib / store / ai / exporter)
npm run build           # production build
```

> Optional local AI gateway: copy `.env.example` to `.env` and fill in URL + key. `.env` is gitignored; secrets stay local. Without config, AI suggestions fall back to the pure rule engine.

> Demo: open `http://localhost:5173/?demo=login` to create a **new project** from a ready-made login-page design (existing projects are untouched).

## Features

| Capability | Description |
|---|---|
| Three-column editor | Left: pages + layer tree + module library (30 modules, categories, search); center: device board; right: AI assistant + properties |
| Multi-project | Header project name ▾ opens the project list: create / switch / rename / delete (most-recent first); pending edits are flushed before switching; index self-heals missing entries; v1.1 single-key data is auto-migrated with a backup |
| Multi-device design | Desktop 1440×900 / Mobile 390×844 / Watch 200×242; independent per page per device; one-click "copy from" another device |
| Drag & build | Library drop, free move (local preview state, committed on pointer-up), 8-handle resize, Shift ratio lock, 6px snap guides + board center-line snapping, nested containers, node rotation 0–359° |
| Editing | Multi-select / marquee / group move, Ctrl+C/V, Delete (keyboard + button), hide, lock, z-order, arrow-key nudge (1px, Shift 8px), undo/redo (graded snapshot stack, 50 steps) |
| Properties panel | Registry-driven fields (text, color, number, select) + frame inputs + rotation + notes + per-node position label |
| Event binding | Editable in the right panel (action / target / note); export generates `fire(key)` stubs; `navigate` to a project page becomes a real hash-route jump in the exported app |
| Layer tree | Current board as a tree: indent, click to select (synced with canvas, auto-scrolls into view), keyword filter, collapse/expand, per-row hide & lock toggles |
| Batch operations | Multi-select → align 6 ways (left/right/top/bottom/center H/center V) + distribute evenly H/V (same container only); batch delete (one undo step) |
| Templates | 5 built-in templates (login / message list / product detail / profile / empty state), each shipping **both mobile and desktop layouts**; built from registry metadata, with tests preventing prop-key drift |
| Interactive preview | Read-only canvas (editing gestures disabled); inputs / password / textarea / select are real form controls; `navigate` events switch preview pages; page switcher bar |
| AI suggestions (rules) | 5 rules: alignment / 8px spacing grid / WCAG contrast / type hierarchy / text overflow; cards with numeric evidence; apply uses the undo stack; local/remote mode shown in the panel |
| Persistence | IndexedDB auto-save (1s debounce); schema migration + pre-migration backup; JSON import with structural deep-validation and readable errors; ErrorBoundary with graded fallbacks + real IndexedDB reset |
| Project export | One-click zip: React 19 app (components pruned to those used + multi-page hash router + `navigate` real jumps + tokens.css + events stubs + CI + verify.sh); page components get stable ASCII slugs; `data/pages.json` is the re-importable source of truth |
| Board PNG | "Export PNG" in the header saves the current board as a 2× image via a zero-dependency chain (DOM → SVG `foreignObject` → canvas → blob); selection is cleared before capture, file name is `project-page-device-date.png`, and a tainted canvas shows a toast |

## Layout

```
src/
├─ types.ts            # Data model (Node / Board / Page / Project) + runtime validation
├─ lib/                # coords, tree, snap, persist (migrations + clearAll), id, aiClient
├─ store/              # index (composition) + project / editor / history / actions / types / demo
├─ modules/            # registry.ts (30 modules, CONTAINER_TYPES single source) + renderers.tsx
├─ editor/             # AppShell, Canvas, LeftPanel, RightPanel, ErrorBoundary
│  └─ right/           # AiPanel, PropsPanel, shared (styles + JSON I/O)
├─ ai/engine.ts        # Rule-based suggestion engine
└─ exporter/           # React project zip generator (+ e2e / guard tests)
```

## Tests

**127 tests** (`npm test`):

- `src/lib/coords.test.ts` — 6 coordinate tests (zoom / nesting / scroll)
- `src/lib/snap.test.ts` — 4 snap-matching tests (nearest candidate / threshold / multi-edge)
- `src/lib/tree.test.ts` — 12 tree tests (deepest container hit / blank / exclude / self-or-descendant / subtreeIds / absOrigin; layer rows flattening, collapse, keyword filter)
- `src/lib/persist.test.ts` — 4 IndexedDB tests (round-trip / empty / v1→v2 migration / clearAll) via fake-indexeddb
- `src/lib/persist.projects.test.ts` — 6 multi-project tests (index registration / rename ordering / v1.1 single-key migration + backup / index self-heal / delete / clearAll)
- `src/lib/projectIndex.test.ts` — 7 pure index tests (garbage tolerance / stale currentId / upsert ordering / remove fallback / prune / legacy upgrade)
- `src/store/projects.test.ts` — 4 store flow tests (create / switch flushes pending edits / rename syncs index / delete current + last-project guard)
- `src/lib/align.test.ts` — 11 align/distribute tests (bounds / 6 directions / single-axis / even spacing incl. idempotence and overlap)
- `src/lib/i18n.test.ts` — 5 i18n tests (zh/en key parity / fallback / params / lang switch)
- `src/templates/templates.test.ts` — 13 template tests (catalog / structure / registry types / props keys / default events / fresh instances)
- `src/editor/canvas/gesture.test.ts` — 10 gesture tests (8-handle resize / min clamp / Shift ratio lock / marquee hit + edge-tangent)
- `src/ai/engine.test.ts` — 7 rule-engine tests (5 rules, incl. WCAG channel parsing)
- `src/store/store.test.ts` — 18 regression tests (modules, undo merge, reparent, copy/paste, props, pages, import deep-validation, rotation, events/theme, graded snapshots, boundary cases, perf smoke)
- `src/exporter/exporter.test.ts` — 8 export e2e tests (zip layout / components / unused-component pruning / pages.json / hidden-node consistency / theme vars / TSX refs / slug uniqueness + hash router)
- `src/exporter/guard.test.ts` — 4 drift-guard tests (template props ⊆ registry fields; event key format; table completeness / no stale keys)
- `src/exporter/write-zip.test.ts` — 1 zip-to-disk test (two pages + navigate, for manual real-build verification)
- `src/lib/png.test.ts` — 6 board-export tests (default 2× and 1–3 clamp, NaN/Infinity fallback, filename illegal-char replacement and dash collapsing, empty-name `board` fallback, zero-padded date)

**Export real-build check:** verified (zip → extract → `npm i` → `tsc` + Vite build green → `vite preview` HTTP 200).

## Contributing

Commit message format:

```
<type>(<scope>): <summary>

types: feat | fix | refactor | perf | test | docs | chore | ci
scopes: canvas | store | exporter | ai | editor | docs | ci
example: feat(canvas): keep drag preview in local state until pointerup
```

PR CI (`ci.yml`) runs lint + test + build on pull requests; `main` pushes deploy to GitHub Pages (`pages.yml`). Coverage reports are local-only (`npm run test:coverage`), not a CI gate.

## Implementation notes

- **Undo/redo:** graded snapshot stack — page-level operations (add/delete page) snapshot all pages; everything else snapshots only the current board. Drag gestures within 400ms merge into one step; drag/resize preview lives in local state and commits once on pointer-up.
- **AI:** v1 is a local rule engine (5 rules). `.env` reserves a remote AI gateway (embed/rerank); without it, rules-only. Applied suggestions go through the shared undo stack.
- **Error handling:** graded `ErrorBoundary` — app-level full-page fallback with refresh / real IndexedDB reset; compact boundaries around canvas and right panel so one panel crashing never takes down the editor.
- **Export stack:** generated `web/` uses React 19 aligned with the editor; the contrast rule uses WCAG luminance with per-channel hex parsing. Multi-page designs export with a hash router; `navigate` events targeting a project page emit real `location.hash` jumps, other actions stay as stubs.
- **Rotation & snapping:** node rotation (`0–359°`) is a visual transform; snapping, marquee hit-testing and AI alignment rules still work on the **unrotated axis-aligned bounding box**, so a rotated module may snap by its outer frame. Preview mode is read-only for editing gestures but interactive for forms and `navigate` jumps.

## Roadmap

- **v1.0:** pure frontend, offline; rule-based AI; React static export
- **v1.1 (current):** event-binding UI (with real `navigate` routing in exports), theme token editor, interactive preview, layer tree, batch operations, PR CI, sliced store, graded snapshots, drift-guard tests
- **Later:** theme tokens referenced as CSS vars in exported components, deeper dual-render convergence, coverage gaps (tree/actions paths)
- **Out of scope:** multiplayer collab, responsive cross-device layout, real-device preview, backend business logic (see S1–S3 delivery switches)

## Demo script

See [DEMO.md](./DEMO.md) (Chinese) for a walkthrough.

## Coverage

Run `npm run test:coverage` (v8 provider, core logic only: lib / store / ai / exporter / types). UI components are excluded from the gate. Current baseline lives in this section's git history; see the Tests section above for per-file suites.

## License

[MIT](./LICENSE) © 2026 loyu123
