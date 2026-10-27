# UI Builder

> **v1.0.0** · [MIT License](./LICENSE) · [中文文档](./README.zh-CN.md)

A visual UI builder: blank canvas + drag-and-drop modules → multi-device layout design → event interface stubs → one-click export of a React project.

**Stack:** React 19 + TypeScript + Vite + dnd-kit + zustand/immer + IndexedDB (idb-keyval) + JSZip.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # automated tests (coords / regression / export e2e)
npm run build      # production build
```

> Optional local AI gateway: copy `.env.example` to `.env` and fill in URL + key. `.env` is gitignored; secrets stay local. Without config, AI suggestions fall back to the pure rule engine.

## Features

| Capability | Description |
|---|---|
| Three-column editor | Left: pages + module library (30 modules, 7 categories, search / device filter); center: device board; right: properties + AI check |
| Multi-device design | Desktop 1440×900 / Mobile 390×844 / Watch 200×242; independent per page per device; one-click “copy from” another device |
| Drag & build | Library drop, free move, 8-handle resize, 6px snap guides, nested containers (card / group) |
| Editing | Multi-select / marquee / group move, Ctrl+C/V, Delete, hide, lock, z-order, undo/redo (snapshot stack, 50 steps) |
| Properties panel | Registry-driven fields (text, color, font size, radius, etc.) + numeric frame inputs, live write-back |
| Event stubs | Per-module `events` (navigate / submit / …); read-only in editor; export generates `fire(key)` stubs |
| AI suggestions (rules) | 5 rules: alignment / 8px spacing grid / WCAG contrast / type hierarchy / text overflow; cards with numeric evidence; apply uses undo stack |
| Persistence | IndexedDB auto-save (1s debounce); schema migration + pre-migration backup; JSON import/export |
| Project export | One-click zip: full React app (30 components + page/device TSX + tokens.css + events stubs + CI + verify.sh); `data/pages.json` is the re-importable source of truth |

## Layout

```
src/
├─ types.ts            # Data model (Node / Board / Page / Project)
├─ lib/                # coords (6 tests) / tree / persist / id / aiClient
├─ store/              # zustand slices + regression tests
├─ modules/            # registry.ts (30 modules) + renderers.tsx
├─ editor/             # AppShell / LeftPanel / Canvas / RightPanel / ErrorBoundary
├─ ai/engine.ts        # Rule-based suggestion engine
└─ exporter/           # React project zip generator (+ e2e tests)
```

## Tests

**32 tests** (`npm test`):

- `src/lib/coords.test.ts` — 6 coordinate tests (zoom / nesting / scroll)
- `src/ai/engine.test.ts` — 7 rule-engine tests (align / spacing / contrast / hierarchy / length, incl. WCAG channel parsing)
- `src/store/store.test.ts` — 10 regression tests (modules, undo merge, reparent, copy/paste, props, pages, import with deep validation, perf smoke)
- `src/exporter/exporter.test.ts` — 5 export e2e tests (zip layout / components / pages.json / TSX refs / slug uniqueness)
- `src/exporter/guard.test.ts` — 2 drift-guard tests (template props ⊆ registry fields; event key format)
- `src/exporter/write-zip.test.ts` — 1 zip-to-disk test (for manual real build verification)

**Export real-build check:** verified (zip → extract → `npm i` → `tsc` + Vite build green → `vite preview` HTTP 200).

## Implementation notes

- **Undo/redo:** full-step snapshot stack (deep-clone pages, max 50). Drag gestures within 400ms merge into one step. Not immer patches (optional in the plan); simple and sufficient. Can switch to patches later if needed.
- **AI:** v1 is a local rule engine (5 rules). `.env` reserves a remote AI gateway (embed/rerank); without it, rules-only. Applied suggestions go through the shared undo stack.
- **Error handling:** `ErrorBoundary` wraps the app so render failures do not white-screen; provides refresh / clear-cache actions (clears IndexedDB for a full reset).
- **Export stack:** generated `web/` uses React 19 aligned with the editor; the contrast rule uses WCAG luminance with per-channel hex parsing. Multi-page designs export with a hash router; `navigate` events targeting a project page emit real `location.hash` jumps, other actions stay as stubs. Event binding (action/target/note) and theme tokens (colors / radius / font) are editable in the right panel.

## Roadmap

- **v1 (current):** pure frontend, offline; rule-based AI; React static export
- **v1.1:** event-binding UI, multi-page route templates, optional remote AI (embed/rerank via local gateway)
- **Out of scope:** multiplayer collab, responsive cross-device layout, real-device preview, backend business logic (see S1–S3 delivery switches)

## Demo script

See [DEMO.md](./DEMO.md) (Chinese) for a 5-minute walkthrough.

## License

[MIT](./LICENSE) © 2026 loyu123
