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
  types/               shared types: Vec2, Rect, Bounds, enemy/projectile types
  audio/               SoundManager (effects), MusicPlayer (looping theme), audio settings, spatial mix
  core/                Scene base class, SceneManager, GameContext/GameSession, sandboxStorage
  scenes/              MenuScene, SandboxScene (battle setup), GameScene (one wave), AnimationLabScene
  systems/             gameplay logic: CombatSystem, EffectsSystem, WaveSpawner, collision (pure)
  rendering/           stickman renderer (pure drawing), Background, AimOverlay
  objects/             Pixi display objects with their own state: Bowman, Enemy, Arrow, Tower
  managers/            InputManager (keyboard + drag-to-aim)
  data/                game data: enemy stats, projectiles, sandbox settings, battlegrounds (map themes)
  ui/                  DomUi (HTML overlay: menus, HUD, settings, end screen), SandboxForm, template.ts
```

- **Scenes**: extend `Scene` from `core/Scene.ts`. Register window listeners with `listenWindow()`
  and teardown with `onExit()` so cleanup runs automatically. `ctx.goTo('menu' | 'game' | 'animationLab')`
  switches scenes, and `SceneManager` destroys everything under `ctx.root` on each switch.
- **Sandbox** (no levels): Start game opens `SandboxScene`, a form (`ui/SandboxForm.ts`) for the wave
  count (1–5), enemies per type and battleground per wave, and bowman/keep health. Settings are pure data
  in `data/sandbox.ts` (`normalizeSandbox` clamps everything) and persist in localStorage via
  `core/sandboxStorage.ts`. `ctx.session.sandbox` holds them, and `ctx.session.run` (`RunState`) the
  current wave index and health carried between waves. Each `GameScene` plays one wave. A cleared wave
  offers "Next wave" (health carries over) until the last one, and then Victory. Defeat goes back to setup.
  The world keeps running after a wave ends (the end screen only overlays it): on defeat the enemies cheer,
  and a killed bowman topples over backwards (`Bowman.die()`).
- **Battlegrounds** (`data/battlegrounds.ts`): map themes (sky, sun, hills, tree style, ground colors)
  drawn by `rendering/Background.ts` (hills/dunes and trees/cacti in `rendering/landscape.ts`). Add a new
  map by adding an entry there. Each has a `weather`: `fair` (cumulus, stratus, cirrus), `clear` (no clouds,
  e.g. Sunscorch Dunes) or `storm` (Thunder Ridge: dark storm deck, no sun, lightning). Clouds come from
  `rendering/clouds.ts` (pure, seeded per map name), higher ones drifting slower; each is cached as a
  texture so its alpha applies to the whole cloud.
- **Lightning** (storm weather): `systems/lightning.ts` is pure (bolt shapes, strike schedule, who's in
  range) and `systems/WeatherSystem.ts` draws it: sky flashes between clouds, and now and then a ground
  strike that crackles at the spot for `LIGHTNING_WARNING_MS` first. `CombatSystem.lightningStrike` deals
  `LIGHTNING_DAMAGE` within `LIGHTNING_RADIUS` (enemies: cause `'lightning'`, stiff death or knockdown; the
  bowman is safe inside the keep). Thunder is the explosion recording slowed down (`SOUND_RATES`).
  Storms also have light rain (`rendering/Rain.ts`, screen space, shifts with the camera; `RAIN_*`).
- **Aim colours**: aim circles, the predicted path and the player's arrow trails use `aimColorsOf(battleground)`
  (`DEFAULT_AIM_COLORS`, overridden per map, e.g. deep violet on the desert where gold disappears).
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
- **Joint poses** (`rendering/stickmanPose.ts`): `JointPose` + `drawJointPose` draw a stickman from explicit
  joint positions (skeleton look, optional club). Falls and cheers produce JointPoses.
- **Cheers** (`rendering/stickmanCheer.ts`): three looping victory animations (`cheerJump`, `cheerFist`,
  `cheerWave`), legs solved with two-bone IK so planted feet don't slide; tests check limb lengths, ground,
  knees and loop continuity. `Enemy.celebrate()` picks one at random when the enemies win.
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
  Each projectile type has a mass, head drag and speed multiplier in `data/projectiles.ts`: launch speed
  ∝ speedMultiplier/√mass and drag ∝ dragMultiplier/mass. Gravity is the same for every type (keep it so).
  Enemy archers shoot at the plain `bowSpeed`, so player arrow tuning doesn't change them. Piercing is light (fast, flat, long) and explosive is heavy (short high arc).
- **Enemy archers** (`EnemyType 'archer'`): `CombatSystem.updateArcher` walks them into
  `ENEMY_ARCHER_RANGE`, aims with `solveLaunchAngle` (same ballistics as the player, cached ~250 ms) and
  fires hostile arrows (`Arrow.hostile`, no trail) through the `enemyShot` event. Hostile arrows hit the
  bowman (not once he's dead), or the keep while he hides, and never hit enemies. Tuning lives in `config.ts` (`ENEMY_ARCHER_*`, `ENEMY_ARROW_*`).
- **Sound**: `ctx.sound` (`audio/SoundManager.ts`) plays the effects in `assets/sounds/` (the user's own
  recordings from `human/`, trimmed and normalized with ffmpeg). `CombatSystem` emits `sound(id, at)` events
  and `GameScene` plays them through `spatialMix` (pan by screen position, quieter off screen). Enemies
  groan when hit by an arrow (8 random variants); falls are silent. New sounds: add the mp3, its id in
  `SOURCES` (an array of variants) and its volume in `config.ts` (`SOUND_VOLUMES`). When trimming, don't
  denoise quiet takes or fade out trailing fricatives, or they get eaten. The enabled/volume
  settings in the drawer persist in localStorage.
- **Music**: the theme (`assets/sounds/theme.mp3`, from the user's Suno track `human/resonant-drone.mp3`) is
  started once at boot and plays across all scenes. The file plays its intro once and then loops
  `MUSIC_LOOP_START_S..MUSIC_LOOP_END_S`; the last 6 s before the loop end are crossfaded (in the file) into
  the audio leading up to the loop start, so the seam is sample-continuous. If you re-cut the file, keep
  the loop points in `config.ts` in sync. Music and effects have separate toggles and volumes.
- **Coordinates**: the screen is 1024×540 and the world is wider (`WORLD_WIDTH`). `GameScene` scrolls the
  `world` container by `cameraX`.
- **Terrain**: the ground surface is `groundAt(x)` (`systems/terrain.ts`, pure): gentle waves of
  `TERRAIN_AMPLITUDE` around `GROUND_Y`, flat at both keeps. The ground fill and grass edge are drawn along
  it, and the bowman, enemies, arrows sticking in the ground, explosions, blood, scorch marks, lightning,
  rain and the trajectory preview all use it. Use `groundAt(x)`, not `GROUND_Y`, for anything that touches
  the ground (hills in the background extend to the bottom of the screen so dips never show a gap).

## Conventions

- Keep pure logic (math, collision, data) free of Pixi/DOM imports so it can be unit-tested.
- New tuning numbers go in `config.ts`, and sandbox defaults go in `data/sandbox.ts`.
- Aim for files of roughly 150–400 lines. Split by responsibility rather than growing `GameScene`.
- Game text in the UI is English.
