# UI Builder

> **v1.2.0** · [MIT License](./LICENSE) · [中文文档](./README.zh-CN.md) · [Changelog](./CHANGELOG.md) · [Handoff notes](./HANDOFF.md)

> **Personal-use notice (important)**
> - This is a **personal prototype-building tool**, not a production multi-user product — no SLA, no security audit, no real-time multi-user editing.
> - API keys live only in **the visitor's own browser storage** (`localStorage` / `sessionStorage`); no server ever receives them. Use your own device, and skip “remember key” on shared computers.
> - The editor talks to model providers **directly from the frontend**, with no backend proxy. That is deliberate (we never host keys or quotas), not an oversight.

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

> Optional remote AI gateway: open **gear → Settings** and fill in URL, API key, Embedding / Reranker models; there is a one-click **Test connection**. Settings live only in this browser's `localStorage` (`ui-builder:ai-settings`) — never in the repo, never in exports, no rebuild needed. Leave them empty to stay on the pure rule engine. Note: when the editor is served over https, the browser blocks http gateways (mixed content).

> Demo: open `http://localhost:5173/?demo=login` to create a **new project** from a ready-made login-page design (existing projects are untouched).

## Features

| Capability | Description |
|---|---|
| Three-column editor | Left: pages + layer tree + module library (30 modules, categories, search); center: device board; right: AI assistant + properties |
| Multi-project | Header project name ▾ opens the project list: create / switch / rename / delete (most-recent first); pending edits are flushed before switching; index self-heals missing entries; v1.1 single-key data is auto-migrated with a backup |
| Multi-device design | Desktop 1440×900 / Mobile 390×844 / Watch 200×242; independent per page per device; one-click "copy from" another device |
| Drag & build | Library drop, free move (local preview state, committed on pointer-up), 8-handle resize, Shift ratio lock, 6px snap guides + board center-line snapping, nested containers, node rotation 0–359° |
| Editing | Multi-select / marquee / group move, Ctrl+C/V, Delete (keyboard + button), hide, lock, z-order, arrow-key nudge (1px, Shift 8px), undo/redo (graded snapshot stack, 50 steps) |
| Spacing marks | Selecting a single node annotates the nearest gaps to its siblings (closest on each of the 4 sides, only when they overlap on the other axis; zero/overlapping gaps are skipped); marks hide during drag / resize / marquee |
| Properties panel | Registry-driven fields (text, color, number, select) + frame inputs + rotation + notes + per-node position label |
| Event binding | Editable in the right panel (action / target / note); export generates `fire(key)` stubs; `navigate` to a project page becomes a real hash-route jump in the exported app |
| Layer tree | Current board as a tree: indent, click to select (synced with canvas, auto-scrolls into view), keyword filter, collapse/expand, per-row hide & lock toggles |
| Batch operations | Multi-select → align 6 ways (left/right/top/bottom/center H/center V) + distribute evenly H/V (same container only); batch delete (one undo step) |
| Templates | 5 built-in templates (login / message list / product detail / profile / empty state), each shipping **both mobile and desktop layouts**; built from registry metadata, with tests preventing prop-key drift |
| Interactive preview | Read-only canvas (editing gestures disabled); inputs / password / textarea / select are real form controls; `navigate` events switch preview pages; page switcher bar |
| AI suggestions (rules) | 5 rules: alignment / 8px spacing grid / WCAG contrast / type hierarchy / text overflow; cards with numeric evidence; apply uses the undo stack; local/remote mode shown in the panel |
| Persistence | IndexedDB auto-save (1s debounce); schema migration + pre-migration backup; JSON import with structural deep-validation and readable errors; ErrorBoundary with graded fallbacks + real IndexedDB reset |
| Project export | One-click zip: React 19 app (components pruned to those used + multi-page hash router + `navigate` real jumps + tokens.css + events stubs + CI + verify.sh); page components get stable ASCII slugs; `data/pages.json` is the re-importable source of truth; export **scope** lets you pick pages / devices, and `pages.json` narrows accordingly |
| Board PNG | "Export PNG" in the header saves the current board as a 2× image via a zero-dependency chain (DOM → SVG `foreignObject` → canvas → blob); selection is cleared before capture, file name is `project-page-device-date.png`, and a tainted canvas shows a toast |

## Layout

```
src/
├─ types.ts            # Data model (Node / Board / Page / Project) + runtime validation
├─ lib/                # coords, tree, snap, spacing, persist (migrations + clearAll), png, aiSettings, aiClient, id
├─ store/              # index (composition) + project / editor / history / actions / types / demo
├─ modules/            # registry.ts (30 modules, CONTAINER_TYPES single source) + renderers.tsx
├─ editor/             # AppShell, Canvas, LeftPanel, RightPanel, ExportModal, ErrorBoundary
│  ├─ canvas/          # NodeView (memo), gesture, SpacingMarks (spacing overlay)
│  └─ right/           # AiPanel, PropsPanel, shared (styles + JSON I/O)
├─ ai/engine.ts        # Rule-based suggestion engine
└─ exporter/           # React project zip generator (slug + hash router + scope)
```

## Tests

**162 tests** (`npm test`):

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
- `src/exporter/exporter.test.ts` — 12 export e2e tests (zip layout / components / unused-component pruning / pages.json / hidden-node consistency / theme vars / TSX refs / slug uniqueness + hash router / device scope / page scope / name escaping / image protocol scrubbing)
- `src/exporter/scope.test.ts` — 6 export-scope tests (device fallback + fixed-order dedupe / page filtering keeps order / unknown ids ignored / empty selection falls back / default device / combined scope)
- `src/exporter/guard.test.ts` — 4 drift-guard tests (template props ⊆ registry fields; event key format; table completeness / no stale keys)
- `src/exporter/write-zip.test.ts` — 1 zip-to-disk test (two pages + navigate, for manual real-build verification)
- `src/lib/png.test.ts` — 6 board-export tests (default 2× and 1–3 clamp, NaN/Infinity fallback, filename illegal-char replacement and dash collapsing, empty-name `board` fallback, zero-padded date)
- `src/lib/spacing.test.ts` — 7 spacing-mark tests (nearest gap per side, overlap-center placement, no cross-axis overlap, smallest of several candidates, overlap/adjacent skipped, all four sides)
- `src/lib/sanitize.test.ts` — 5 input-sanitising tests (image protocol allowlist + dangerous schemes rejected, HTML escaping, single-line flattening/truncation)
- `src/lib/importGuard.test.ts` — 4 import-size guard tests (ASCII boundary, UTF-8 byte estimate, custom cap)
- `src/lib/aiSettings.test.ts` — 8 AI-settings tests (URL normalisation / validation / default models / masking / storage round-trip / remember-flag dual storage / corrupt JSON fallback)

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
- **AI:** v1 is a local rule engine (5 rules). A remote AI gateway (embed/rerank) is configured at runtime in Settings; without it, rules-only. Applied suggestions go through the shared undo stack.
- **Error handling:** graded `ErrorBoundary` — app-level full-page fallback with refresh / real IndexedDB reset (which also wipes AI settings); compact boundaries around canvas and right panel so one panel crashing never takes down the editor.
- **Export stack:** generated `web/` uses React 19 aligned with the editor; the contrast rule uses WCAG luminance with per-channel hex parsing. Multi-page designs export with a hash router; `navigate` events targeting a project page emit real `location.hash` jumps, other actions stay as stubs.
- **Rotation & snapping:** node rotation (`0–359°`) is a visual transform; snapping, marquee hit-testing and AI alignment rules still work on the **unrotated axis-aligned bounding box**, so a rotated module may snap by its outer frame. Preview mode is read-only for editing gestures but interactive for forms and `navigate` jumps.

## Security model

Threat model is a **local prototyping tool with an optional self-hosted gateway**, not a multi-tenant service:

| Surface | Current behaviour |
|---|---|
| Secrets | AI key lives only in this browser: `localStorage` by default (`ui-builder:ai-settings`, across sessions), or `sessionStorage` when "remember key" is unchecked (gone when the tab closes). Never in the repo, never in exports; UI shows it masked. **Local endpoints (localhost / 127.0.0.1 / *.local) may leave the key empty.** Don't type a production key on a shared machine |
| CSP | Production builds inject a `Content-Security-Policy` from `vite.config.ts` (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`; `style-src` needs `'unsafe-inline'` for React inline styles). Dev builds skip it so HMR keeps working |
| Build-time config | No `VITE_*` secrets (those end up in public bundles); `.env*` stays gitignored |
| Data reset | "Clear cache and reset" also clears AI settings |
| Import | 5 MB cap (byte estimate before parse + re-check before JSON.parse), rejected with a readable reason |
| Images / links | Protocol allowlist: `http(s)`, `blob`, `data:image/*`, relative paths; `javascript:` / `data:text/html` are blanked |
| Exports | Project/page names escaped and flattened before entering HTML or TSX comments; `src` props pass the same allowlist |
| Residual risk | Local storage is unencrypted; browser-side requests hit CORS / mixed-content limits; real multi-user isolation needs a backend proxy |

## Roadmap

- **v1.0:** pure frontend, offline; rule-based AI; React static export
- **v1.1:** event-binding UI (with real `navigate` routing in exports), theme token editor, interactive preview, layer tree, batch operations, PR CI, sliced store, graded snapshots, drift-guard tests
- **v1.2 (current):** multi-project management, template library, 6-way align/distribute, layer-tree upgrades, board PNG export, export scope (pages/devices), spacing marks
- **v1.3 candidate:** screenshot → interface (upload → model parse → post-process → pick & drop onto canvas). See [docs/screenshot-to-interface.md](./docs/screenshot-to-interface.md). Models are user-configured (cloud gateway or local Ollama / LM Studio; local endpoints need no key)
- **Later:** coverage in CI gate
- **Out of scope:** multiplayer collab, responsive cross-device layout, real-device preview, backend business logic (see S1–S3 delivery switches)

## Demo script

See [DEMO.md](./DEMO.md) (Chinese) for a walkthrough.

## Coverage

Run `npm run test:coverage` (v8 provider, core logic only: lib / store / ai / exporter / types). UI components are excluded from the gate. Current baseline lives in this section's git history; see the Tests section above for per-file suites.

## License

[MIT](./LICENSE) © 2026 loyu123
