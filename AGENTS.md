## Project

Interactive 3D simulation web app.
Users add people and props to a 3D stage, arrange them, and answer spatial-relationship
questions. The app is Japanese-first (UI labels, help overlay).

- Stack: React 19 + three.js 0.182 + Vite 7 + TypeScript.
- Served under base path `/3d/` (set in `vite.config.ts` — keep it; CERN hosting uses this).
## Commands

```bash
npm run dev        # dev server at http://localhost:5173/3d/
npm run lint       # eslint .  (react-hooks rules enforced; keep it green)
npm run build      # vite build
npx tsc --noEmit   # typecheck
```

Verify `lint` + `build` (and `tsc --noEmit`) after any source change.

## Architecture

| File | Purpose |
| --- | --- |
| `src/App.tsx` | UI (toolbox, settings/selection/measurement panels, help modal), history reducer, angle calc, JSON export/import |
| `src/scene.ts` | `SceneController`: three.js scene, model loading, drag/lift/rotate, pick/select, selection ring, debug lines |
| `src/models.ts` | Asset registry: kind IDs, categories, model URLs, labels, max counts |
| `public/3dmodels/*.glb` | Runtime models (Y-up) |
| `scripts/*.py` | GLB generators; write output to `public/3dmodels/` |

### Scene state model
- React state (`HistoryState` with `past/present/future`) is the single source of truth;
  `SceneController.setObjects()` reconciles the three.js scene from it.
- Drags dispatch `move` actions; height-slider moves are `record:false` (not pushed to history),
  all other mutations push history. Original state is pushed before undo so undo restores it.
- JSON export contains the full React scene state and re-creates it on import.

## Model conventions

- **three.js is Y-up**; the authoring scripts are Z-up. Final export rotates −90° about X with the
  base at y=0. Ground is the y=0 plane; a person is ~2.5 tall, the school ~3.15.
- The ground is a **circle of radius `BOUND=15`**; object x/z are clamped radially
  (`clampRadial` in `scene.ts`) so they can never leave the disc. Y is clamped to `[0, 6]`.
  Objects spawn at `y=0` (the floor), the lowest allowed state.
- Default/reset camera is at **eye level** (`CAMERA_DEFAULT` in `scene.ts`): position
  `(0, 2.3, 12)`, orbit target `(0, 1.8, 0)` — a person's eyes sit at ≈2.3.
- Models face **−Z at rotY=0**. Facing vector: `(-sin(rotY), 0, -cos(rotY))`. Use this in angle math.
- People are gender-neutral with **eyes only (no nose)**; distinction is via baked shirt patterns
  and hats (A/B/C only). Patterns are baked on **both** front and back of the torso:
  me/You plain, You diagonal stripes, family horizontal stripes, A vertical stripes, B polka dots,
  C check. Chest labels are runtime canvas sprites (`labelText` in models.ts), not baked.

## Regenerating models

Scripts must be run with `uv`, never global pip. Scripts with a `# /// script` header run as
`uv run <script>`; the older prop scripts (`make_apple.py`, `make_cake_slice.py`, `make_coffee_cup.py`,
`make_school.py`) lack the header and run as:

```bash
uv run --no-project --with trimesh --with numpy <script>
```

`make_person.py` runs via its `# /// script` header (`uv run make_person.py`).
Always verify exported GLBs are Y-up afterward (min-y ≈ 0), e.g. with a trimesh bounds check.

## Conventions

- Keep the ESLint config green (`react-hooks/refs`, `exhaustive-deps` are active — don't write
  `ref.current` during render; `useReducer`'s `dispatch` is stable and can be closed over directly).
- Don't add comments unless asked. Match existing code style (no semicolons in App/scene/three code).
- Do not run git remote/branch commands or deploy; work on the current branch only.
