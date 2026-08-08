# Interactive 3D simulation web app

The UI is available in Japanese, English and Swedish.

- Stack: React 19 + three.js 0.182 + Vite 7 + TypeScript.
- Served under the base path `/3d/` (set in `vite.config.ts` — keep it; the CERN hosting uses it).
- Behavior spec: `RQ1_B_Non-verbal_3D_requests_v2.docx` (Japanese). This is the source of truth for behavior.

## Getting started

```bash
npm install
npm run dev   # dev server at http://localhost:5173/3d/
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:5173/3d/ |
| `npm run lint` | ESLint (`eslint .`; react-hooks rules enforced, keep it green) |
| `npm run build` | Production build |
| `npx tsc --noEmit` | Typecheck |
| `npm run preview` | Preview the production build |

## Project structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | UI (toolbox, question/selection/measurement panels, help modal), history reducer, angle calc, JSON export/import |
| `src/scene.ts` | `SceneController`: three.js scene, model loading, drag/lift/rotate, pick/select, selection ring, debug lines |
| `src/models.ts` | Asset registry: kind IDs, categories, model URLs, labels, max counts |
| `src/i18n.ts` | UI strings for Japanese / English / Swedish |
| `src/questions.ts` | 20 question presets (item lists; edit by hand) |
| `public/3dmodels/*.glb` | Runtime models (Y-up) |
| `scripts/*.py` | GLB generators; output goes to `public/3dmodels/` |

## Scene state model

- React state (`HistoryState` with `past`/`present`/`future`) is the single
  source of truth; `SceneController.setObjects()` reconciles the three.js scene
  from it.
- Drags dispatch `move` actions; height-slider moves are `record: false` (not
  pushed to history); all other mutations push history.
- JSON export contains the full React scene state and re-creates it on import.

## Model conventions

- three.js is Y-up; the authoring scripts are Z-up. Final export rotates −90°
  about X with the base at y=0.
- Models face −Z at `rotY = 0`.
- People are gender-neutral with eyes only; distinction comes from baked shirt
  patterns and hats. Chest labels are runtime canvas sprites, not baked.

## Regenerating models

Scripts must be run with `uv`, never global pip. Scripts with a `# /// script`
header run as `uv run <script>`; the older prop scripts run as:

```bash
uv run --no-project --with trimesh --with numpy <script>
```

`make_person.py` additionally needs `--with Pillow` (canvas pattern textures).
Always verify exported GLBs are Y-up (min-y ≈ 0) after regenerating.
