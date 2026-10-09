# Core (src/core)

- **View size** (`viewport.ts`, `fitView` pure, tested): the view is `GAME_HEIGHT` (540) tall and at least `GAME_WIDTH`
  (1134, 2.1:1) wide. A window wider than 2.1:1, or big enough to pass `MAX_VIEW_SCALE` (1.4 CSS px per game px),
  widens the view (up to `MAX_VIEW_WIDTH`) instead of scaling up. Read the width with `viewWidth()` every frame.
  The renderer resolution follows the shown size (`onCanvasFit` in `main.ts`: CSS scale × devicePixelRatio, capped by
  `MAX_RENDER_RESOLUTION`, refit on browser zoom).
- **Camera** (`camera.ts`): aim look-ahead, see scenes/CLAUDE.md; `centeredCameraX()`.
- `GameContext` / `GameSession` (in `Scene.ts`): `ctx.session` (sandbox, run, net, playerCount, browser-session settings).
- `sandboxStorage.ts`: setups in localStorage. `urlState.ts`: the URL flags (`?debug`, `?lab`, …).
