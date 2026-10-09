# Scenes (src/scenes)

Extend `Scene` (`core/Scene.ts`); `listenWindow()` and `onExit()` for cleanup; `ctx.goTo(...)`; SceneManager destroys
everything under `ctx.root` on each switch. Scenes never touch the DOM: they call `DomUi` and assign `ui.handlers.*`.

- **SandboxScene**: the battle setup form (ui/CLAUDE.md); the canvas behind shows the selected level's map.
  `ctx.session.sandbox` holds the settings, `ctx.session.run` (`RunState`) the level index and health carried between
  levels.
- **GameScene** plays one level. Hands arrows to `BattleArrows` (launching, shrapnel, enemy arrows, co-op copies,
  `pruneArrows`, the preview's path), the view to `BattleCamera`, the end screen's text to `levelEndInfo` (pure). A
  cleared level offers "Next level" (health carries over) until the last, then Victory; defeat goes back to setup. The
  world keeps running after a level ends (enemies cheer on defeat). `GameScene.unhorse` places unhorsed riders.
  `players` / `PlayerControl.ts`: see net/CLAUDE.md. Follows the bowman across `WORLD_WIDTH` (centred,
  `centeredCameraX(width, WORLD_WIDTH)`, in a wider view); scrolls `world` by `cameraX`.
- **Aim camera** (`core/camera.ts`, pure): while the local player draws, `GameScene.updateAim` simulates the shot every
  frame; `aimLookAhead` ignores a landing within `LOOK_DEAD_ZONE` of the view, then slides up to the bowman
  `LOOK_EDGE_MARGIN` from the edge, eased (`LOOK_AIM_MS`); only slides further out unless he aims the other way
  (`nextLookShift`); after the shot stays while he stands, eases back once he moves (`LOOK_RETURN_MS`). The drag is
  measured on screen, `getAim()` maps it to the world as the camera is now.
- **MenuScene**: menu over a live battlefield (meadow sun moved over the enemy keep); labs under "Dev tools".
  Menus, labs and the lobby show a `BACKDROP_WIDTH` landscape, centred.
- **AnimationLabScene**: every animation once on the bare skeleton, in tabs Movement, Combat, Hurt, Death, Cheer (Pixi on
  a cream panel; "← Menu"). Rows `LAB_CATEGORIES` in `labRows.ts` (ids for `?lab=<id>`), looping falls and gibs in
  `labSequences.ts`.
- **DesignLabScene**: looks in tabs Enemies (each with an "Old" stickman tile), Player, Ideas; catalogue
  `rendering/designs/catalog.ts`; grid scrolls with the wheel.
- **SoundLabScene** + `ui/SoundLabPanel.ts`: every effect and variant, the theme with a jump to its loop seam.
- **CoopScene**: the lobby (net/CLAUDE.md).
