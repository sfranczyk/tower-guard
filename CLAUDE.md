# Tower Guard

2D side-view tower defense in the browser. The player is a stickman archer guarding the left keep;
enemy waves walk in from the enemy keep on the right. PixiJS 8 + TypeScript (strict), bundled with webpack.

## Commands

- `npm run dev`: dev server on http://localhost:8080 (or `$PORT`) (add `?debug` to show hitboxes)
  - With `?debug`, `window.__towerGuard.scene` exposes the running `GameScene` in the console, e.g.
    `scene.enemies[0].takeDamage(999, { cause: 'headshot', fromX: 0 })`.
  - `?lab` opens the animation lab directly, and `?lab=<id>` (e.g. `?lab=archer`) opens one animation zoomed in.
    Ids are in `AnimationLabScene`.
  - `?sounds` opens the sound test panel (menu → "Open sound test panel"): every effect and each of its
    variants, the theme with a jump to its loop seam, and the volumes.
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
  systems/             gameplay logic: CombatSystem, EffectsSystem, waveDirector, collision (pure)
  rendering/           stickman renderer (pure drawing), Background, AimOverlay
  objects/             Pixi display objects with their own state: Bowman, Enemy, Arrow, Tower
  managers/            InputManager (keyboard + drag-to-aim)
  data/                game data: enemy stats, projectiles, sandbox settings, battlegrounds (map themes)
  ui/                  DomUi (HTML overlay), Hud, SandboxForm, SoundLabPanel, icons.ts, template.ts
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
  Within a wave enemies arrive in groups (`systems/waveDirector.ts`, pure, tested; no visible "waves" in the
  UI): `planWaveGroups` spreads each type through the wave (tougher types later, so the first group of
  `FIRST_GROUP_SIZE` is light) in groups growing to `MAX_GROUP_SIZE`; `WaveDirector.update` (called every frame,
  so it pauses with the game) releases the next group once at most `GROUP_RELEASE_ALIVE` enemies stand and
  `GROUP_MIN_GAP_MS` passed, or after `GROUP_MAX_GAP_MS` regardless.
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
  bowman is safe inside the keep). Thunder is the old "Bum" recording (`thunder.mp3`) slowed down (`SOUND_RATES`);
  the explosion itself is synthesized (`explosion.mp3`, ffmpeg: low thump, brown-noise blast, crackle, long rumble).
  Storms also have light rain (`rendering/Rain.ts`, screen space, shifts with the camera; `RAIN_*`).
- **Frostpeak Pass** (weather `snow`): snow-capped mountains with mist (`hillShape: 'mountains'`), snowy pines,
  snowfall (`rendering/Snow.ts`, `SNOW_*`), bigger ground waves (`terrainAmplitude`; `Background` calls
  `useTerrain`) and wind: each wave rolls one up to the map's `wind` (px/s²). Wind is part of `FlightParams`
  (scaled per projectile like drag), so arrows, the trajectory preview and enemy archer aim all use it;
  the status line shows its direction and strength.
- **Aim overlay** (`rendering/AimOverlay.ts`): while aiming, circles at the drag start and at the bow; after a shot
  a ghost of it (power circle and direction) stays where that shot was loosed, not following the bowman.
- **Aim colours**: aim circles, the predicted path and the player's arrow trails use `aimColorsOf(battleground)`
  (`DEFAULT_AIM_COLORS`, overridden per map, e.g. deep violet on the desert where gold disappears; an
  optional `halo` adds a dark outline, used on Frostpeak Pass).
- **UI** is HTML (`ui/template.ts`, styles in `index.html`) in the landscape style: flat shapes, cream panels,
  chunky gold/cream buttons (`primary-button`, `secondary-button`), the Fredoka display font, flat SVG icons
  (`ui/icons.ts`) and health bars in the HUD (`ui/Hud.ts`). Weapons are square slots (up to `WEAPON_SLOTS` = 5 in
  `ui/template.ts`): icon only (name in the tooltip), key in the corner, ammo count underneath (∞ for now). The sandbox form shows enemy type icons in its columns and picks
  each wave's map from thumbnails (`ui/mapThumbnail.ts`, a tiny SVG landscape built from the palette). The page backdrop and accent follow the map:
  each battleground has `ui: { accent, backdrop }` and scenes call `DomUi.setTheme`. The menu is drawn over
  a live battlefield (`MenuScene`), with the labs under "Dev tools"; the settings drawer works in the menu
  and in game (its handlers live in `SceneManager`). Trajectory preview (off by default) and arrow trails (how
  many of the latest shots keep their trail, 0–3, default `DEFAULT_ARROW_TRAILS` = 1; 0 = `Arrow.hideTrail()`, else `Arrow.ageTrail(keep)`) live
  in `ctx.session` for the browser session. The in-game HUD sits *outside* the canvas
  (bar above, status line below) and `DomUi.fitCanvas()` scales the canvas into the remaining space.
  The renderer resolution follows the shown size (`onCanvasFit` in `main.ts`: CSS scale × devicePixelRatio,
  capped by `MAX_RENDER_RESOLUTION`, refit on browser zoom), so big windows stay sharp.
- **View size** (`core/viewport.ts`, `fitView` is pure and tested): the view is `GAME_HEIGHT` (540) tall and at
  least `GAME_WIDTH` (1134, 2.1:1) wide. A window wider than 2.1:1, or one big enough to pass `MAX_VIEW_SCALE`
  (1.4 CSS px per game px), widens the view (up to `MAX_VIEW_WIDTH`) instead of scaling everything up. Read the
  current width with `viewWidth()` every frame, never `GAME_WIDTH`, for anything that spans the screen. The
  battlefield stays `WORLD_WIDTH` (1200); `GameScene` follows the bowman while the view is narrower and centres
  the world once it fits (`centeredCameraX`); menus and labs centre their backdrop and content. The landscape
  (sky, hills mirrored past both ends, trees, ground, clouds) extends `SCENERY_MARGIN` beyond the world, and
  rain and snow cover `MAX_VIEW_WIDTH`.
  Overlays on the canvas (menu, sandbox/sound panels, end screen, drawer) are laid out for a canvas at
  scale 1 and zoom with it (`--ui-scale`, set in `fitCanvas`, `UI_SCALE` limits); the sandbox's buttons stay
  pinned at the bottom of its card. The menu moves the meadow's sun over the enemy keep, clear of the logo.
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
- **Enemy looks** (`ENEMY_LOOKS` in `data/enemies.ts`): size, club swing and gait per type. Runners run (run
  cycle) and swing a short club from below; Brutes are 1.5× tall (container scale, so hitboxes and arrow
  anchors scale too; the health bar keeps its size) and chop two-handed with a long club.
- **Club attacks** (`rendering/attackSwing.ts`, pure keyframes by progress, `pose.attackStyle`): `overhead`
  (one-handed, enemies in the game), `twoHanded` (longer club in both hands; the rear hand reaches the shaft
  by IK) and `uppercut` (short club from below); `CLUBS` sets each club's length. Wind-up, a fast strike
  with a wrist snap (`clubTilt`; `forearmBend` stays ≥ 0 so elbows never bend backwards, tested), a lunge and dip, then recovery. Progress 0 and 1 equal the standing pose, so a swing
  never jumps; drawStickman tilts the torso about the hip so the feet stay put.
  Melee damage lands with the club: `Enemy.playAttackAnimation(onImpact)` runs `onImpact` at
  `attackImpactProgress(style)` (the strike key) and drops it if the enemy is knocked down, killed or starts
  cheering first. The hit lands if the bowman is still within the enemy's `strikeReach` (ENEMY_LOOKS:
  runner 45, fighter 55, brute 85 px) and not in the keep; jumping on the spot doesn't dodge.
- **Joint poses** (`rendering/stickmanPose.ts`): `JointPose` + `drawJointPose` draw a stickman from explicit
  joint positions (skeleton look, optional club). Falls and cheers produce JointPoses.
- **Cheers** (`rendering/stickmanCheer.ts`): three looping victory animations (`cheerJump`, `cheerFist`,
  `cheerWave`), legs solved with two-bone IK so planted feet don't slide; tests check limb lengths, ground,
  knees and loop continuity. `Enemy.celebrate()` picks one at random when the enemies win.
- **Dragon archer enemy** (`EnemyType 'dragon'`, `objects/DragonEnemy.ts`): flies at `DRAGON_ALTITUDE`, hovers
  `DRAGON_HOVER_OFFSET` in front of the bowman (`systems/dragonFlight.ts`, pure), and `CombatSystem.updateDragon`
  aims the rider's bow like an enemy archer (same ballistics and wind) and fires hostile arrows. Hit zones
  (`dragonHitZones` in `rendering/dragon.ts`, pure; `getHitBoxes` maps them to world space): the rider and the
  dragon's head are headshots (the rider needs a lobbed arrow, the body shields him from below); the body
  and two halves each of the neck and the tail are normal hits (seven zones). A test checks the zones chain
  tail → body → neck → head with no gap through the whole wing beat. CombatSystem's
  hit test takes the earliest zone hit (headshot wins ties); `?debug` draws them yellow/red. Arrows stick into it. Killed, it plays the
  lab's `fall` death in "death space" (its sprite space with the ground at `GIB_GROUND_Y`, from its height above
  `groundAt(x)`): the dragon falls and lies flat (its `art` moves, and `toWorld` follows it so stuck arrows
  stay put) and the rider is thrown off in `riderArt`; a kill by a direct explosive hit (cause `'blast'`) blows
  the rider apart instead (`riderGibSimulation`, stepped per frame). The explosive dragon death isn't in the game yet; ground lightning skips it (`isFlying`). Combat code takes `Foe = Enemy | DragonEnemy`.
- **Dragon rider** (`rendering/dragon.ts`, also used by the lab): `getDragonPose` is pure (tested: loop, rider in the
  saddle, smooth wings); side-view wing beat with foreshortening, body bob, undulating neck and tail; the
  rider is a JointPose sitting astride: the far leg is drawn before the dragon's body (`drawRearLeg`) so it's
  hidden, the rest on top (`drawJointPose(..., { append: true, hideRearLeg: true })`). Riders: `'spear'` (reins
  and a raised spear) or `'archer'` (the player's archer rig, rotated with the torso lean and moved to the
  saddle, aiming down ahead, drawing and loosing every `DRAGON_ARCHER_SHOT_MS`).
- **Dragon deaths** (`rendering/dragonDeath.ts`, pure functions of time, ground at `GIB_GROUND_Y`; `dragonFallState` takes the
  start height, so the game can drop it from its real altitude):
  `fall` (the dragon drops nose-down and lies flat: neck, head and tail on the ground, near wing draped over
  its side, far wing folded out of sight behind the body), `explode` and `riderExplode` (the rider through
  `GibSimulation` with `lift`, the dragon falls as in `fall`). `drawDragon(g, pose, withRider)` and
  `drawDragonRiderOnly` draw the parts separately. The thrown rider (`rendering/dragonRiderFall.ts`) blends
  joint angles (limb lengths kept) from the saddle to limbs flung out, tumbles onto his back and settles
  flat, kept above the ground every frame; his bow lands flat beside him. The exploded dragon
  (`rendering/dragonGibs.ts`, seeded) is ~25 polygon chunks that bounce, tip over onto their broad side and stop.
- **Explosive death** (`rendering/stickmanGibs.ts`): `GibSimulation` blows the standing stickman into
  10 pieces plus blood (seeded and deterministic, so it's testable), and `drawStickmanGibs` draws it.
  In the game an enemy is blown apart (random force 1–1.7×) when killed by a direct explosive hit (cause
  `'blast'`: arrow plus `EXPLOSION_DAMAGE`), or by chance by a splash explosion that dealt more than 75% of
  its max health: 50% plus a point per damage-% above 75%, certain from 125% (`splashGibChance` /
  `blowsApart` in `data/enemies.ts`, `SPLASH_GIB_*`). Other kills by splash
  get `knockback`. The lab uses force 1, and every lab figure is clipped to its frame.
- **Bow ready**: `pose.bowReady` blends the archer between the lowered bow (0) and aiming (1). `Bowman`
  raises the bow while the player draws (aim power > 0) and lowers it after the shot.
- **Animation lab** (drawn in Pixi on a cream panel over the meadow, matching the HTML UI) rows live in `scenes/AnimationLabScene.ts`, and scripted sequences in
  `scenes/labSequences.ts`. Add new animations there so they can be previewed and zoomed.
- **Archer pose**: bow, hands and elbows come from `getArcherRig()` in `rendering/archer.ts`. It pivots
  at the neck and is drawn inside the stickman sprite, so the hands can't drift from the bow.
  `Bowman.getBowReleasePoint()` uses the same rig (string hand). Don't add a separately positioned bow.
- **Skins**: `pose.skin` picks the look. `'skeleton'` is the thin white bones used by enemies and previews.
  `'armored'` is the player's armored archer: thick dark limbs, plus hood, armor, quiver and bow from
  `rendering/armor.ts`, drawn on the same skeleton so every animation still works. Its colours are an
  `ArmorPalette` (`pose.armorColors`, default `ARMOR_COLORS`): each battleground has a `player` palette picked
  to contrast with the map (tested), and `Bowman` takes it via `BowmanConfig.armorColors`.
- **Arrow flight** uses `systems/ballistics.ts` (gravity + quadratic drag `ARROW_DRAG`). The trajectory
  preview simulates with the same functions, so any flight change goes there to keep both in sync.
  Each projectile type has a mass, head drag and speed multiplier in `data/projectiles.ts`: launch speed
  ∝ speedMultiplier/√mass and drag ∝ dragMultiplier/mass. Gravity is the same for every type (keep it so).
  Shrapnel arrows (slot 4) burst on Space in flight into `SHRAPNEL_FRAGMENTS` small `'fragment'` arrows
  fanned around the heading (`shrapnelBurst`, pure), each dealing `SHRAPNEL_FRAGMENT_DAMAGE` of a normal hit;
  `GameScene.burstShrapnel` swaps them in.
  Enemy archers shoot at the plain `bowSpeed`, so player arrow tuning doesn't change them. Piercing is light (fast, flat, long) and explosive is heavy (short high arc).
- **Enemy archers** (`EnemyType 'archer'`): `CombatSystem.updateArcher` walks them into
  `ENEMY_ARCHER_RANGE`, aims with `solveLaunchAngle` (same ballistics as the player, cached ~250 ms) and
  fires hostile arrows (`Arrow.hostile`, no trail) through the `enemyShot` event. Hostile arrows hit the
  bowman (not once he's dead), or the keep while he hides, and never hit enemies. Tuning lives in `config.ts` (`ENEMY_ARCHER_*`, `ENEMY_ARROW_*`).
- **Sound**: `ctx.sound` (`audio/SoundManager.ts`) plays the effects in `assets/sounds/` (the user's own
  recordings from `human/`, trimmed and normalized with ffmpeg). `CombatSystem` emits `sound(id, at)` events
  and `GameScene` plays them through `spatialMix` (pan by screen position, quieter off screen). Enemies
  groan on every arrow hit, kills and headshots included (8 random variants), except an explosive arrow that
  kills (just the blast); falls are silent. New sounds: add the mp3, its id in
  `SOURCES` (an array of variants), its volume in `config.ts` (`SOUND_VOLUMES`) and its description in
  `audio/soundCatalog.ts` (shown in the sound test panel, `scenes/SoundLabScene.ts` + `ui/SoundLabPanel.ts`). When trimming, don't
  denoise quiet takes or fade out trailing fricatives, or they get eaten. The enabled/volume
  settings in the drawer persist in localStorage.
- **Music**: the theme (`assets/sounds/theme.mp3`, from the user's Suno track `human/resonant-drone.mp3`) is
  started once at boot and plays across all scenes. The file plays its intro once and then loops
  `MUSIC_LOOP_START_S..MUSIC_LOOP_END_S`; the last 6 s before the loop end are crossfaded (in the file) into
  the audio leading up to the loop start, so the seam is sample-continuous. If you re-cut the file, keep
  the loop points in `config.ts` in sync. Music and effects have separate toggles and volumes.
- **Keeps** are drawn in code (`rendering/keep.ts`, flat version of the old pixel-art tower, same 200×406
  silhouette at half size; `TOWER_HEIGHT`). The stone is tinted towards the map's far hills
  (`keepTones`), and `keepDamageStage` (pure, tested) picks the look from health: cracks (≤60%), broken
  merlons, torn banners and rubble (≤30%), fire and smoke (≤10%). `Tower` redraws only when the stage changes
  and animates the torch, fire and smoke in `update(deltaMs)`.
- **Coordinates**: the view is `viewWidth()`×540 (see View size) and the battlefield `WORLD_WIDTH`. `GameScene`
  scrolls the `world` container by `cameraX` (negative when the view is wider than the world).
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
