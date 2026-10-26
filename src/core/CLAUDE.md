# Core (src/core)

- **View size** (`viewport.ts`, `fitView` pure, tested): the view is `GAME_HEIGHT` (680) tall and at least `GAME_WIDTH`
  (1455, ~2.14:1) wide; world y runs from `VIEW_TOP` (-110, extra sky) to `VIEW_BOTTOM` (570), so scenery containers
  (`Background`) and the battle camera sit `-VIEW_TOP` lower. A window wider than the base view, or big enough to
  pass `MAX_VIEW_SCALE` (1.2 CSS px per game px),
  widens the view (up to `MAX_VIEW_WIDTH`) instead of scaling up. Read the width with `viewWidth()` every frame.
  Never wider than the level's field: GameScene calls `ui.limitViewWidth(worldWidth())` (bars beside the canvas).
  The renderer resolution follows the shown size (`onCanvasFit` in `main.ts`: CSS scale × devicePixelRatio, capped by
  `MAX_RENDER_RESOLUTION`, refit on browser zoom).
- **Culling** (`viewport.ts`): `GameScene` sets `setShownRange` to the camera's view each frame; `EnemyFigure` and
  `DragonEnemy` ask `isShownX` (± `VIEW_CULL_MARGIN`): off it they are `renderable = false` and enemies skip painting
  (`drawEnemyBody`'s `paint`) but still pose, so hit shapes stay right. Unset outside battle (labs, menus).
- **Camera** (`camera.ts`): aim look-ahead, see scenes/CLAUDE.md; `centeredCameraX()`.
- `GameContext` / `GameSession` (in `Scene.ts`): `ctx.session` (sandbox, run, net, playerCount, browser-session settings).
- `sandboxStorage.ts`: setups in localStorage. `urlState.ts`: the URL flags (`?debug`, `?lab`, …); dev-only ones through `getDevUrlParam`, off in the
  release build (`devTools.ts`, `DEV_TOOLS` from webpack `--env release`).
- **Keep side** (`keepSide.ts`, tested; settings window "Your keep", `session.keepSide`, localStorage): `right` (or `left`
  for a MOBA red player) mirrors the battle: `GameScene.placeWorld` flips `world` and the weather's `screenLayer`,
  `InputManager` `mirrored` flips pointer x and the walking keys, `heardX` the stereo, DamageNumbers flip their text back, health bars fill from their right end (`setBarsMirrored` in
  rendering/healthBar.ts; `redrawHealthBars` on a change).
