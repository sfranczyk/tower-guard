# Tower Guard

2D side-view tower defense in the browser. The player is a stickman archer guarding the left keep;
enemy waves walk in from the enemy keep on the right. PixiJS 8 + TypeScript (strict), bundled with webpack.

## Commands

- `npm run dev`: dev server on http://localhost:8080 (or `$PORT`) (add `?debug` to show hitboxes)
  - With `?debug`, `window.__towerGuard.scene` exposes the running `GameScene` in the console, e.g.
    `scene.enemies[0].takeDamage(999, { cause: 'headshot', fromX: 0 })`.
  - `?lab` opens the animation lab directly, and `?lab=<id>` (e.g. `?lab=archer`) opens one animation zoomed in.
    Ids are in `AnimationLabScene`.
- `npm run check`: type-check (`tsc --noEmit`, includes noUnusedLocals/Parameters)
- `npm test`: Vitest unit tests (`*.test.ts` next to the code)
- `npm run build`: production build to `dist/`

Before finishing a change, run `npm run check && npm test`. For anything visual, also run the game.

## Architecture

```
src/
  main.ts              bootstrap: Pixi app, textures, canvas fit, DomUi, SceneManager
  config.ts            all tuning constants (speeds, damage, gravity, world size)
  types/               shared types: Vec2, Rect, Bounds, level/wave data
  core/                Scene base class, SceneManager, GameContext/GameSession
  scenes/              MenuScene, GameScene (one level), AnimationLabScene (animation previews)
  systems/             gameplay logic: CombatSystem, EffectsSystem, WaveSpawner, collision (pure)
  rendering/           stickman renderer (pure drawing), Background, AimOverlay
  objects/             Pixi display objects with their own state: Bowman, Enemy, Arrow, Tower
  managers/            InputManager (keyboard + drag-to-aim), LevelManager (level data)
  data/                game data helpers (enemy stats per type and difficulty)
  ui/                  DomUi (HTML overlay: menus, HUD, settings, end screen) + template.ts
```

- **Scenes**: extend `Scene` from `core/Scene.ts`. Register window listeners with `listenWindow()`
  and teardown with `onExit()` so cleanup runs automatically. `ctx.goTo('menu' | 'game' | 'animationLab')`
  switches scenes, and `SceneManager` destroys everything under `ctx.root` on each switch.
- **Persistent state** between levels lives in `ctx.session` (level number, gold, bow tension).
  `MenuScene` resets it.
- **UI** is HTML (`ui/template.ts`, styles in `index.html`). The in-game HUD sits *outside* the canvas
  (bar above, status line below) and `DomUi.fitCanvas()` scales the canvas into the remaining space.
  Never place HUD elements over the play field. Only menus, the settings drawer and the end screen
  overlay the canvas. Scenes never touch the DOM directly. They call `DomUi` methods and assign
  `ui.handlers.*` callbacks.
- **Stickman drawing** goes through `drawStickman(sprite, phase, pose)` in `rendering/stickman.ts`.
  Bowman, enemies and the animation lab all use it. Preview animation changes in the lab
  (menu → "Open animation test panel").
- **Fall animations** (`rendering/stickmanFall.ts`) are one-shot keyframed poses driven by progress
  0..1: three deaths (`death` collapses face down, `deathCrumple` sits down and falls back, `deathStiff`
  is a rigid backwards topple computed analytically), `knockback` (thrown backwards, lands on the back)
  and `getUp` (starts from knockback's last pose). `Enemy.takeDamage(amount, { cause, fromX })` picks
  the reaction: a headshot gives `deathStiff`, an explosion gives `knockback` (survivors get up and fight
  on), and other kills pick `death` or `deathCrumple` at random. `getFallPose()` is
  pure; feet and hands are kept on the ground by `groundedAngle`, and tests check every frame.
- **Explosive death** (`rendering/stickmanGibs.ts`): `GibSimulation` blows the standing stickman into
  10 pieces plus blood (seeded and deterministic, so it's testable), and `drawStickmanGibs` draws it.
  In the game only the enemy hit *directly* by an explosive arrow (cause `'blast'`, which takes the arrow
  plus `EXPLOSION_DAMAGE`) is blown apart when that kills it, with a random force (1–1.7×). Splash victims
  get `knockback`. The lab uses force 1, and every lab figure is clipped to its frame.
- **Bow ready**: `pose.bowReady` blends the archer between the lowered bow (0) and aiming (1). `Bowman`
  raises the bow while the player draws (aim power > 0) and lowers it after the shot.
- **Animation lab** rows live in `scenes/AnimationLabScene.ts`, and scripted sequences in
  `scenes/labSequences.ts`. Add new animations there so they can be previewed and zoomed.
- **Archer pose**: bow, hands and elbows come from `getArcherRig()` in `rendering/archer.ts`. It pivots
  at the neck and is drawn inside the stickman sprite, so the hands can't drift from the bow.
  `Bowman.getBowReleasePoint()` uses the same rig (string hand). Don't add a separately positioned bow.
- **Skins**: `pose.skin` picks the look. `'skeleton'` is the thin white bones used by enemies and previews.
  `'armored'` is the player's armored archer: thick dark limbs, plus hood, armor, quiver and bow from
  `rendering/armor.ts`, drawn on the same skeleton so every animation still works.
- **Arrow flight** uses `systems/ballistics.ts` (gravity + quadratic drag `ARROW_DRAG`). The trajectory
  preview simulates with the same functions, so any flight change goes there to keep both in sync.
  Each projectile type has a mass and head drag in `data/projectiles.ts`: launch speed ∝ 1/√mass and
  drag ∝ dragMultiplier/mass. Piercing is light (fast, flat, long) and explosive is heavy (short high arc).
- **Enemy archers** (`EnemyType 'archer'`): `CombatSystem.updateArcher` walks them into
  `ENEMY_ARCHER_RANGE`, aims with `solveLaunchAngle` (same ballistics as the player, cached ~250 ms) and
  fires hostile arrows (`Arrow.hostile`) through the `enemyShot` event. Hostile arrows hit the bowman, or
  the keep while he hides, and never hit enemies. Tuning lives in `config.ts` (`ENEMY_ARCHER_*`, `ENEMY_ARROW_*`).
- **Coordinates**: the screen is 1024×540 and the world is wider (`WORLD_WIDTH`). `GameScene` scrolls the
  `world` container by `cameraX`. The ground is at `GROUND_Y`.

## Conventions

- Keep pure logic (math, collision, data) free of Pixi/DOM imports so it can be unit-tested.
- New tuning numbers go in `config.ts`, and new level content goes in `managers/LevelManager.ts`.
- Aim for files of roughly 150–400 lines. Split by responsibility rather than growing `GameScene`.
- Game text in the UI is English.
