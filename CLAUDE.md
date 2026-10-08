# Tower Guard

2D side-view tower defense in the browser. The player is a stickman archer guarding the left keep;
enemy waves walk in from beyond the enemy keep on the right. PixiJS 8 + TypeScript (strict), bundled with webpack.

## Commands

- `npm run dev`: dev server on http://localhost:8080 (or `$PORT`) (add `?debug` to show hitboxes)
  - With `?debug`, `window.__towerGuard.scene` exposes the running `GameScene` in the console, e.g.
    `scene.enemies[0].takeDamage(999, { cause: 'headshot', fromX: 0 })`.
  - `?lab` opens the animation lab directly, and `?lab=<id>` (e.g. `?lab=archer`) opens one animation zoomed in.
    Ids are in `AnimationLabScene`.
  - `?designs` opens the design lab (menu → Dev tools → "Design lab"); `?designs=<tab or design id>` (e.g. `player`, `fighter`).
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
  scenes/              MenuScene, SandboxScene (battle setup), GameScene (one level; with BattleArrows, BattleCamera,
                       levelEnd, PlayerControl), AnimationLabScene
  systems/             gameplay logic: CombatSystem (+ EnemyAI, ArrowHits, ArrowMagic), EffectsSystem, waveDirector,
                       collision, bodyMotion, bowmanMotion (pure)
  rendering/           stickman renderer (pure drawing), Background, AimOverlay
  objects/             Pixi display objects with their own state: Bowman, Enemy (+ EnemyBow, enemyFall, enemyHitShape),
                       DragonEnemy, Arrow, Tower, AfflictionLayer
  managers/            InputManager (keyboard + drag-to-aim)
  data/                game data: enemy stats, projectiles, sandbox settings, battlegrounds (map themes)
  ui/                  DomUi (HTML overlay), Hud, SandboxForm, SoundLabPanel, icons.ts, template.ts
```

- **Scenes**: extend `Scene` from `core/Scene.ts`. Register window listeners with `listenWindow()`
  and teardown with `onExit()` so cleanup runs automatically. `ctx.goTo('menu' | 'game' | 'animationLab')`
  switches scenes, and `SceneManager` destroys everything under `ctx.root` on each switch.
- **Run → Level → Wave** (the names, in the UI and the code alike): a *run* is one game from the battle setup to
  victory or defeat (`RunState`); it is a row of 1–5 *levels*, each with its own map and enemies (`LevelSetup`); a
  level's enemies come in *waves*, groups released one after another on the same field (`WaveDirector`). Setups
  stored before this naming (`waves`, `waveCount`) are still read (`normalizeSandbox`).
- **Sandbox**: Start game opens `SandboxScene`, a form (`ui/SandboxForm.ts`): level tabs (map thumbnail, enemy count, add/remove, 1–5), the selected level's
  battleground (map cards) and enemies (a card per type with − / +), bowman/keep health in the header; the
  canvas behind shows the selected level's map. A second page, Quiver (`ui/quiverPage.ts`), fills the five weapon
  slots (keys 1–5) with any arrows (click a slot then an arrow, or drag them: `ui/quiverDrag.ts`), each at most once, slots may stay empty (`data/loadout.ts`, pure, tested;
  `SandboxSettings.loadout`); the HUD's slots are built from it (`DomUi.setLoadout`). Settings are pure data
  in `data/sandbox.ts` (`normalizeSandbox` clamps everything) and persist in localStorage via
  `core/sandboxStorage.ts`. `ctx.session.sandbox` holds them, and `ctx.session.run` (`RunState`) the
  current level index and health carried between levels. Each `GameScene` plays one level. A cleared level
  offers "Next level" (health carries over) until the last one, and then Victory. Defeat goes back to setup.
  The world keeps running after a level ends (the end screen only overlays it): on defeat the enemies cheer,
  and a killed bowman falls like the enemies (`Bowman.die()`): CombatSystem tells what hurt him (`BowmanHit`,
  `bowman.noteHit`) and `deathFallFor` (`systems/bowmanDeath.ts`, pure, tested) picks the fall: clubbed → collapse or
  crumple, shot → stiff fall or crumple, burnt → crumple, lightning → stiff, a blast leaves him lying from the
  knockback; he falls as if hit from where it came (co-op: the `die` event carries the fall). Lab row: `archer-deaths`.
  Within a level enemies arrive in waves (`systems/waveDirector.ts`, pure, tested; not shown in the UI yet):
  `planWaves` spreads each type through the level (tougher types later, by their `arrival`, so the first wave of
  `FIRST_WAVE_SIZE` is light) in waves growing by `WAVE_SIZE_STEP` to `MAX_WAVE_SIZE`; `WaveDirector.update` (called every frame, so it
  pauses with the game) releases the first after `LEVEL_START_DELAY_MS`, a wave's enemies `WAVE_SPAWN_INTERVAL_MS`
  apart, and the next wave once at most `WAVE_RELEASE_ALIVE` enemies stand and `WAVE_MIN_GAP_MS` passed, or after
  `WAVE_MAX_GAP_MS` regardless.
- **Co-op online** (branch `coop`): two bowmen, host-authoritative over PeerJS (`peerjs`, its free public broker
  only to find each other; `?net=local` links two tabs with a BroadcastChannel instead). Menu → "Co-op online" →
  `CoopScene` (lobby, `ui/CoopPanel.ts`): host a room (5-character code, `net/roomCode.ts`) or join one. The host
  sets up the battle (SandboxScene, back = lobby) and starts it; the guest waits in the lobby, meanwhile picking their own
  quiver there (`CoopPanel`, the same `quiverPage` and `ui/quiverEditing.ts` as the setup's Quiver page; starts from and is
  saved into the guest's own stored setup). Each sends their quiver (`{ t: 'loadout' }`, on linking up and on every
  change; `net/coopLink.ts` takes these messages out of the transport so they arrive in any scene) and sees the other's
  (`partnerQuiver`: the host in the lobby and on the Quiver page, the guest under their own); `NetLink.loadouts` holds both
  by player and `loadoutOf(session, index)` is what each fights with (HUD slots, keys, the host checks the guest's picks). `ctx.session.net`
  (`NetLink`: role, code, `Transport`, the level's wind, both quivers) and `playerCount` 2; `net/coopLink.ts` links up and handles
  a dropped link (guest back to the lobby with a notice; host plays on, player 2 stands still); Esc in a co-op
  battle leaves the room.
  - Players: `GameScene.players`, one `Player` per bowman (`scenes/PlayerControl.ts`: bowman, `PlayerInput`,
    health, weapon). The host is player 1, the guest player 2 (`localIndex`; camera, aim overlay, status line
    follow the local one; the HUD shows player 1 then player 2 on both screens). Controls through
    `input/PlayerInput.ts`: `LocalInput` (keyboard and mouse), `ManualInput` (set from outside: the guest's
    controls on the host; `?coop` alone gives a local 2-bowman test with player 2 driven from the console,
    `scene.players[1].input.set({ direction: 1 })`), `RecordingInput` (guest: passes through and records presses).
  - Host (`net/HostSync.ts`): ids for enemies and arrows, `netHooks` on Enemy/DragonEnemy (hits, swings), Arrow
    (stuck, gone), Bowman (knockdown, fire) and `EffectsSystem.onEffect`; sounds, deaths, cheers and per-player
    status lines as events; a `frame` (snapshot + events, `net/protocol.ts`) every 50 ms; `start` / `end` /
    `lobby` messages around levels. The guest's `input` drives player 2.
  - Guest (`net/GuestSync.ts`): no WaveDirector, AI or CombatSystem; applies events in order with the same objects (same
    takeDamage, so the same reactions), shows snapshots 100 ms in the past, interpolated (`applyNetState`,
    `applyRemote`), flies arrows locally (same ballistics, sticks into the ground itself), predicts its own bowman
    and corrects him when the host disagrees, and sends its controls every 33 ms (shots are loosed by the host).
  - Gameplay: enemies go for the nearest bowman out in the open, else the keep (`systems/targeting.ts`, pure);
    `CombatWorld.bowmen`, damage events name the bowman. Health is per player (`RunState.bowmanHealths`), a
    fallen bowman stays down for the run (`Bowman.die({}, true)`), the level is lost when all have fallen or the keep
    falls. Player 2 wears `secondPlayerArmor` (bronze, silver trim) and hides in the keep's lower second tower.
  - Not yet: a local preview of the guest's own arrows (they appear after a round trip), the guest's lightning
    bolts are its own (only the host's strikes hurt; their sparks arrive as effects), no reconnecting, and a
    hidden browser tab stops its game loop (keep the host's tab visible).
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
  snowfall (`rendering/Snow.ts`, `SNOW_*`), higher, closer-set ground waves (`terrainAmplitude` 26,
  `terrainWaviness` 1.5; `Background` calls `useTerrain`) and wind: each level rolls one up to the map's `wind` (px/s²). Wind is part of `FlightParams`
  (scaled per projectile like drag), so arrows, the trajectory preview and enemy archer aim all use it;
  the status line shows its direction and strength.
- **Aim overlay** (`rendering/AimOverlay.ts`): while aiming, circles at the drag start and at the bow (the ones at the
  drag start are off by default and can be turned on in the settings drawer, `session.showCursorCircle`); after a shot
  a ghost of it (power circle and direction) stays where that shot was loosed, not following the bowman.
- **Aim camera** (`core/camera.ts`, pure, tested): while the local player draws, the view slides towards where the
  shot would land (`GameScene.updateAim` simulates it every frame, same ballistics as the preview, whether the
  preview is on or not): `aimLookAhead` does nothing for a shot landing within `LOOK_DEAD_ZONE` of the view,
  then slides smoothly up to the bowman `LOOK_EDGE_MARGIN` from the edge; eased in (`LOOK_AIM_MS`). It only slides
  further out: a shorter shot doesn't bring it back in, unless he aims the other way (`nextLookShift`). After the
  shot it stays while he stands and eases back to him once he moves (`LOOK_RETURN_MS`). The drag is measured on screen (InputManager), so
  the sliding view doesn't change the aim, and `getAim()` gives its points in the world as the camera is now.
- **Aim colours**: aim circles, the predicted path and the player's arrow trails use `aimColorsOf(battleground)`
  (`DEFAULT_AIM_COLORS`, overridden per map, e.g. deep violet on the desert where gold disappears; an
  optional `halo` adds a dark outline, used on Frostpeak Pass).
- **UI** is HTML (`ui/template.ts`, styles in `index.html`) in the landscape style: flat shapes, cream panels,
  chunky gold/cream buttons (`primary-button`, `secondary-button`), the Fredoka display font, flat SVG icons
  (`ui/icons.ts`) and health bars in the HUD (`ui/Hud.ts`). Weapons are square slots (`LOADOUT_SLOTS` = 5, from the quiver,
  `weaponSlots` in `ui/template.ts`): icon only (name in the tooltip), key in the corner, ammo count underneath (∞ for now). The sandbox form shows enemy type icons in its columns and picks
  each level's map from thumbnails (`ui/mapThumbnail.ts`, a tiny SVG landscape built from the palette). The page backdrop and accent follow the map:
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
  battlefield is `WORLD_WIDTH` (2400, about two screens; keeps at `PLAYER_TOWER_X` / `ENEMY_TOWER_X`, 160 px in from the ends;
  the bowman hides in his by jumping under it, `TOWER_ENTRY_ZONE_WIDTH`, presses S to come out (`PlayerInput.isExitPressed`, sent in co-op), and can walk out
  behind it to the edge, where he stands while the key is held, `Bowman.isAgainstEdge`; enemies follow him there;
  they come in from beyond the right edge); `GameScene` follows the bowman across it (and would
  centre it, `centeredCameraX(width, WORLD_WIDTH)`, in a view wider than it). Menus, labs and the lobby show a
  `BACKDROP_WIDTH` (1200) landscape, centred (`centeredCameraX()`; `new Background(..., BACKDROP_WIDTH)`). The hills
  drawing is one `BACKDROP_WIDTH` stretch that `Background` repeats, every other copy mirrored; the landscape (sky,
  hills, trees, ground, clouds) extends `SCENERY_MARGIN` beyond either end, and
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
- **Enemy catalogue** (`data/enemyKinds.ts`, pure, tested): every enemy (`EnemyType`, the id saved in setups and sent
  in co-op) is an entry in `ENEMY_KINDS`: an **archetype** (how it fights: `fighter`, `runner`, `heavy`, `archer`,
  `kamikaze`, `grabber`, `skyArcher`, `fireBreather`; `ARCHETYPES` says whether it carries a club, runs, shoots,
  detonates, flies, breathes fire), a **race** (`human`, `goblin`, `ogre`, `undead`, `dragon`; `RACES` give the
  traits: heavy = no vortex catches it, freeze and pin durations, burn factor), **magical** (dragons), plus its stats,
  damage, keep damage, build (size, strike reach) and `arrival` (where in a level it starts to come). Gameplay code asks `enemyArchetype(type)` and
  `enemyTraits(type)` (race traits with the variant's overrides), never the id; looks stay per variant
  (`rendering/enemyBody.ts`, `ICON_ENEMIES`). A new variant (an orc kamikaze) is one entry here plus its look and icon.
  Now: fighter, archer, kamikaze = human; runner = goblin; brute = ogre; zombie = undead; both dragons = dragon.
- **Enemy toughness and damage** (`data/enemyKinds.ts` via `data/enemies.ts`, tested): health per type against a 20-damage arrow
  (headshot ×`HEADSHOT_DAMAGE_MULTIPLIER` = 1.25): fighter 35, runner 22, archer 24 (one headshot), brute 110,
  dragon 170. `ENEMY_DAMAGE` gives each type a random range (`rollDamage`) for club swings and, for shooters,
  their arrows (`Arrow.shooter` tells CombatSystem whose arrow hit). The keep (2000 by default) takes the same
  × `KEEP_DAMAGE_MULTIPLIER` per attack (1, except archer arrows 0.5, brute 2, kamikaze 8); read ranges with `enemyDamage(type, attack, target)`.
- **Kamikaze** (`EnemyType 'kamikaze'`): runs in unarmed with a bomb on its chest (`pose.bomb`, sparking fuse) and
  dies to one arrow. On reaching the bowman (jumping doesn't save him) or the keep, `CombatSystem.detonate` blows
  it apart (cause `'blast'`), runs the same `explode` as an explosive arrow (splash and knockback on nearby
  enemies) and hurts the bowman (unless he's in the keep) and the keep within `KAMIKAZE_REACH` × the radius. It also knocks
  the bowman down (`Bowman.knockBack`, `BOWMAN_KNOCKBACK`): stickmanFall's `knockback` then `getUp`, drawn in his
  armor by `drawArmoredJointPose` (`rendering/armoredPose.ts`), sliding further the closer he stood; meanwhile
  (`isStunned`) he can't move, jump, aim or enter the keep. Killed by it, he stays lying on his back. Lab row: `archer-knockdown`.
  Killed by a direct explosive hit, a kamikaze sets its bomb off: `explode` with `power` = `KAMIKAZE_BLAST_POWER`
  (2: twice the radius and damage, `EffectsSystem.explosion(point, scale)`) where it stood. A kamikaze blown apart
  (that, or its own bomb) throws its pieces `KAMIKAZE_GIB_FORCE` times harder.
- **Zombie** (`EnemyType 'zombie'`): shuffles slowly with its arms held out (`pose.zombie`,
  `ZOMBIE_REST`), attacks with the `'grab'` style (lunge, then yank both hands back to the chest; the hit lands
  on the yank) and is pale green with green blood: `BodyColors` (`rendering/bodyColors.ts`, `HUMAN_BODY` /
  `ZOMBIE_BODY`) colour drawStickman, joint poses (falls, cheers), gibs and `EffectsSystem.bloodBurst`
  (`enemy.bodyColors`). Lab rows: `kamikaze-run`, `zombie-walk`, `zombie-attack`.
- **Enemy looks** (`ENEMY_LOOKS` in `data/enemies.ts`): size, club swing and gait per type. The walk/run phase
  advances with the distance covered (`Enemy.stridePhase`, `WALK_STRIDE_PER_RADIAN` / `RUN_STRIDE_PER_RADIAN` × body
  scale), so feet stay planted at any speed and size; `stepMs` only sets the sway of standing poses. Runners run (run
  cycle), are 0.75× tall and stab from below; Brutes are 1.5× tall (container scale, so hitboxes and arrow
  anchors scale too; the health bar keeps its size) and chop two-handed with a long club.
- **Enemy bodies** (`rendering/enemyBody.ts`): enemies are drawn in their looks from the design lab, not as
  stickmen: fighter = raider, runner = goblin (dagger), archer = hooded bandit, brute = ogre, kamikaze = sapper
  (wrapped in dynamite, a stick in each hand), zombie = rotting peasant. `Enemy` passes its state (walk/run phase,
  stand, attack progress, archer bow, or a JointPose for falls, cheers and the pinned struggle) to `drawEnemyBody`,
  which builds the BodyPose with drawStickman's numbers and draws the look, so moves, sprite transform and hitboxes
  are unchanged (archers walk upright). Blown apart, the same `GibSimulation` is drawn in the look
  (`drawEnemyGibs` → `designs/lookGibs.ts`: torso with its clothes and gear, head with its face, limbs with hands, feet
  and what the hands held, bloody stumps); `enemyGibColors` gives the blood (red / green; `EffectsSystem` tells them
  apart by the blood colour). The design lab shows it as "Blown apart". Dragon riders are the bandit (dragon archer) and a
  dragon knight (fire dragon) via `drawDragonWithRider`, also when thrown off (`drawThrownRider`'s `drawRider`) or
  blown apart (`drawLookGibs`).
  The near dragon wing is drawn over the rider, so it hides him on the upstroke.
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
  `DRAGON_HOVER_OFFSET` in front of the bowman (`systems/dragonFlight.ts`, pure), on either side of him: it turns round
  (`nextHoverSide`; the sprite's x scale swings through over `DRAGON_TURN_MS`, no shots or fire meanwhile) when he gets
  `DRAGON_TURN_PAST` behind it or the world's edge leaves no room in front of him (co-op sends the side), and `CombatSystem.updateDragon`
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
- **Dragon kinds**: hides are `DRAGON_PALETTES` (`rendering/dragon.ts`; `drawDragon`, deaths and gibs take a palette).
  The dragon archer is `dark` (dark brown, nearly black). The **fire dragon** (`EnemyType 'fireDragon'`, same
  `DragonEnemy` with `kind`, see `DRAGON_KINDS`) is `red` with an `'unarmed'` rider (both hands on the reins); it
  flies lower and closer (`FIRE_DRAGON_ALTITUDE`, `FIRE_DRAGON_HOVER_OFFSET`) and `CombatSystem.updateFireDragon`
  calls `breathe` when the target is within `FIRE_DRAGON_RANGE` of its mouth (`FIRE_DRAGON_BREATH_INTERVAL_MS`
  between breaths). The breath (`rendering/dragonFire.ts`, pure, tested): `breathControl` rears the head back,
  then thrusts it forward with the jaw open (`pose.jaw`, `pose.mouth`) for `FIRE_BREATH.flameMs`; `firePuffs` is
  the stream (puffs fly ~`FIRE_REACH` out, swell, cool to smoke and rise), drawn into `DragonEnemy.fireArt`.
  The stream goes along the aim (the head tilts less by half the jaw opening); `getFlames` gives its hot puffs
  in world space. Lab rows: `fire-dragon`, `fire-dragon-breath`.
  Killed by a direct explosive hit (cause `'blast'`), the fire dragon blows up: `CombatSystem.explode` with
  `power` = `FIRE_DRAGON_BLAST_POWER` (3: three times the radius and damage) centred on its body, `EffectsSystem.dragonBlast`
  (an explosion that size in a swarm of fireballs and a dark cloud), the dragon bursts into `DragonGibSimulation`
  chunks and the rider into gibs (`DragonDeath.dragonGibs`), and arrows stuck in it are gone (`Arrow.stuckTo`).
  The dragon archer keeps the old blast death (rider blown apart, dragon falls).
- **Burning**: the fire dragon's flames (`flamesTouch` in `systems/burning.ts`, pure, puff cores vs the bowman's box;
  not in the keep) set the bowman alight (`Bowman.ignite`, status line message): `BURN_DAMAGE_PER_S` of steady
  damage (applied in `CombatSystem.update`) for `BURN_DURATION_MS` after the last touch, so staying in the fire
  keeps relighting it. Flames (`rendering/burning.ts`, pure `burnFlames` / `burnSmoke`): translucent tongues
  from the feet, knees, hip, chest, shoulder and head of the current pose (standing, toppling or the knockdown's
  fall pose) with smoke rising, drawn into `Bowman.flameArt` at `BURN_FLAME_SIZE`. Lab row: `archer-burning`.
- **Dragon rider** (`rendering/dragon.ts`, also used by the lab): `getDragonPose` is pure (tested: loop, rider in the
  saddle, smooth wings); side-view wing beat with foreshortening, body bob, undulating neck and tail; the
  rider is a JointPose sitting astride: the far leg is drawn before the dragon's body (`drawRearLeg`) so it's
  hidden, the rest on top (`drawJointPose(..., { append: true, hideRearLeg: true })`). Riders: `'spear'` (reins
  and a raised spear), `'unarmed'` (both hands on the reins) or `'archer'` (the player's archer rig, rotated with the torso lean and moved to the
  saddle, aiming down ahead, drawing and loosing every `DRAGON_ARCHER_SHOT_MS`).
- **Dragon deaths** (`rendering/dragonDeath.ts`, pure functions of time, ground at `GIB_GROUND_Y`; `dragonFallState` takes the
  start height, so the game can drop it from its real altitude):
  `fall` (the dragon drops nose-down and lies flat: neck, head and tail on the ground, near wing draped over
  its side, far wing folded out of sight behind the body), `explode` and `riderExplode` (the rider through
  `GibSimulation` with `lift`, the dragon falls as in `fall`). `drawDragon(g, pose, withRider, palette)` and
  `drawDragonRiderOnly` (`rendering/dragonArt.ts`, the drawing of dragon.ts's poses) draw the parts separately. The thrown rider (`rendering/dragonRiderFall.ts`) blends
  joint angles (limb lengths kept) from the saddle to limbs flung out, tumbles onto his back and settles
  flat, kept above the ground every frame; his bow lands flat beside him. The exploded dragon
  (`rendering/dragonGibs.ts`, seeded) is ~25 polygon chunks that burst out in every direction (slowed by air drag),
  fall, bounce, tip over onto their broad side and stop.
- **Explosive death** (`rendering/stickmanGibs.ts`): `GibSimulation` blows the standing stickman into
  10 pieces plus blood (seeded and deterministic, so it's testable), and `drawStickmanGibs` draws it.
  In the game an enemy is blown apart (random force 1–1.7×) when killed by a direct explosive hit (cause
  `'blast'`: only the blast, the arrow itself does no damage; `explosionDamage` falls off from
  `EXPLOSION_DAMAGE.centre` (direct hit) to `.edge` at `EXPLOSION_RADIUS`), or by chance by a splash explosion, by distance from the blast
  (`HitInfo.blastDistance`, fraction of `EXPLOSION_RADIUS`): ~95% near the centre, 50% halfway, ~5% at the edge
  (`splashGibChance` / `blowsApart` in `data/enemies.ts`, `SPLASH_GIB_CHANCE`). Other kills by splash get
  `knockback`, and knocked-back enemies (dead or alive) slide up to `KNOCKBACK_PUSH_MAX` px further the closer
  they were (`knockbackPush`, applied over the fall in `Enemy.updateFall`). The lab uses force 1, and every lab figure is clipped to its frame.
- **Bow ready**: `pose.bowReady` blends the archer between the lowered bow (0) and aiming (1). `Bowman`
  raises the bow while the player draws (aim power > 0) and lowers it after the shot.
- **Design lab** (`scenes/DesignLabScene.ts`, catalogue in `rendering/designs/catalog.ts`): looks in tabs. *Enemies*:
  the enemies' looks (in the game now, see Enemy bodies) over all their animations, each with an "Old" stickman tile.
  *Player*: the ranger and keep warden, next to the old armored archer. *Ideas*: free proposals, each less of a stickman.
  The looks draw over `BodyPose` (`rendering/designs/bodyPoses.ts`, pure, tested): the game's walk, run, club swings,
  grab and archer rig as joint positions with drawStickman's numbers, plus the fall, cheer and pinned JointPoses as they
  are, so a look covers every animation and keeps the hitboxes. `skinKit.ts` places parts in the torso/head frames (works
  lying down too) and `drawHumanoid` draws a `HumanoidLook`; looks are in `enemySkins.ts`, `heavySkins.ts`,
  `playerSkins.ts`; the ideas in `ideas.ts` (+ `ideaHumanoids.ts`, `ideaCreatures.ts`, own `designSkeleton.ts`).
- **Animation lab** (drawn in Pixi on a cream panel over the meadow, matching the HTML UI) rows live in `scenes/AnimationLabScene.ts`, and scripted sequences in
  `scenes/labSequences.ts`. Add new animations there so they can be previewed and zoomed.
- **Archer pose**: bow, hands and elbows come from `getArcherRig()` in `rendering/archer.ts`. It pivots
  at the neck and is drawn inside the stickman sprite, so the hands can't drift from the bow.
  `Bowman.getBowReleasePoint()` uses the same rig (string hand). Don't add a separately positioned bow.
- **Player look** (`rendering/bowmanBody.ts`): `Bowman` draws player 1 as the ranger and, in co-op, player 2 as the
  keep warden (`BowmanConfig.look`; `rendering/designs/playerSkins.ts`), coloured from the battleground's `player`
  ArmorPalette (ranger: hood, cloak, sleeves = `limb`; warden: tabard = `limb`, helm = `plate`, tower = `gold`, so
  `secondPlayerArmor` makes his helm bronze). `bowmanBody` (bodyPoses, tested) blends walk, sprint and standing like
  drawStickman under the archer rig; falls draw the bow in the rear hand (`bowInRearHand`). The sprite lean, aim
  and bow release point are the same as before. The armored skin below is no longer used in the game.
- **Skins**: `pose.skin` picks the look. `'skeleton'` is the thin white bones of the animation lab and previews.
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
  Pinning arrows (slot 5, heavy barbed spike) only scratch (`PIN_DAMAGE`, 0–4, no headshot bonus) and pin the enemy
  to the ground: the arrow sticks through its foot into the ground and `Enemy.pin` keeps it from walking for
  `pinDurationMs` (`PIN_DURATION_MS` 20 s, zombies `PIN_DURATION_ZOMBIE_MS` 20 s too; brutes and dragons can't be
  pinned and just take the scratch). A pinned enemy plays the struggle (`rendering/stickmanPinned.ts`, pure, tested, kept moderate: leans on the free leg,
  the stuck rear foot at `PINNED_FOOT` yanks him back, looks down at it; the arrow goes in at `Enemy.pinnedFootPoint`)
  but can still swing or shoot; co-op sends the time left (`EnemySnap.pinned`). Lab row: `pinned-struggle`.
  Enemy archers shoot at the plain `bowSpeed`, so player arrow tuning doesn't change them. Piercing is light (fast, flat, long) and explosive is heavy (short high arc).
- **Fire, frost and vortex arrows** (slots from the quiver; tuning `FIRE_*`, `ENEMY_BURN_*`, `FROST_*`, `VORTEX_*`,
  `THROW_GRAVITY`, `FALL_DAMAGE` in config). Fire and frost hit weaker (`MAGIC_HIT_DAMAGE` in CombatSystem), a vortex
  arrow not at all: the enemy it hits glows violet and levitates straight up (`levitateHeight`) over the vortex it
  opens, and drops when it dies away (`VORTEX_LEVITATE_FALL` of the fall damage); a further vortex arrow lifts it
  `VORTEX_LEVITATE_BOOST` higher. Brutes are never caught (`resistsVortex`): in reach they walk at `VORTEX_HEAVY_WALK`
  (`AfflictionLayer.slowByWind`), and a direct hit only lifts them a little (`VORTEX_LEVITATE_HEAVY`). Nothing is
  pinned while up in the air. A dragon it hits gets no ground
  vortex but a ring of wind (`drawAirVortex`) and turbulence for `DRAGON_TURBULENCE_MS` (`AfflictionLayer.stir`,
  `buffetOffset`): thrown about and tilted, the fire dragon can't breathe fire, the archer shoots
  `DRAGON_TURBULENCE_SPREAD` × wider. What they do is
  `systems/ArrowMagic.ts` (host only). An enemy's state is `AfflictionLayer` (`objects/`, on Enemy and DragonEnemy;
  logic in `systems/afflictions.ts`, pure, tested): burning (`BURN_TICK_MS` damage, cause `'burn'`, spreads to
  neighbours), chilled (`timeScale` slows everything it does) and frozen (an ice block; a killing hit or any blast
  shatters it, cause `'shatter'`, ice gibs). Fire thaws, frost puts fire out; the fire dragon doesn't burn, dragons
  are only chilled. A fire arrow in the ground leaves a fire patch. The vortex (`systems/vortex.ts`, pure, tested)
  pulls ground enemies in, lifts them up the funnel (`Enemy.holdInVortex`, flailing: `rendering/stickmanFlail.ts`) and
  throws them out at the top (`Enemy.throwInAir`, `systems/flight.ts`); dying away it flings the rest. A thrown enemy
  lands on its back into the knockback and `onLanded` deals the fall damage (cause `'fall'`); a kamikaze goes off, a
  frozen one shatters. Visuals: `systems/magicVisuals.ts` via EffectsSystem (fx events in co-op), `rendering/vortexArt.ts`,
  `rendering/afflictionArt.ts`; co-op snapshots carry `af` (afflictions) and `th` (thrown).
- **Friendly fire** (settings drawer, `session.friendlyFire`, on by default; co-op: the host's setting): the players'
  arrows and what they do hit the bowmen out in the open as they hit enemies (CombatSystem `friendlyTargets`): the
  same damage (top `BOWMAN_HEAD` px is a headshot), blasts and splash (`explode`, knocked down; a kamikaze's own blast
  keeps its own bowman damage), fire (`Bowman.ignite`, his own burn), frost (`Bowman.chill`: slowed, frozen = stunned in
  an ice block; a blast or landing breaks the ice instead of shattering him, killed frozen he topples stiff), vortices
  (ArrowMagic's `Walker` = Enemy | Bowman: pulled, lifted, thrown, `cause: 'fall'`; a direct hit levitates him) and pins
  (`Bowman.pin`, no walking, jumping or hiding, still shoots). An arrow spares its own shooter for its first
  `FRIENDLY_FIRE_GRACE_MS`. Bowman keeps an `AfflictionLayer` ('basic') for frost and vortex; co-op sends
  `BowmanSnap.net` (`Bowman.getNetState`), and a guest's own bowman held by a vortex follows the host.
- **Enemy archers** (`EnemyType 'archer'`): `CombatSystem.updateArcher` walks them into
  `ENEMY_ARCHER_RANGE`, aims with `solveLaunchAngle` (same ballistics as the player, cached ~250 ms) and
  fires hostile arrows (`Arrow.hostile`, no trail) through the `enemyShot` event. Hostile arrows hit the
  bowman (not once he's dead), or the keep while he hides, and never hit enemies. Tuning lives in `config.ts` (`ENEMY_ARCHER_*`, `ENEMY_ARROW_*`).
- **Sound**: `ctx.sound` (`audio/SoundManager.ts`) plays the effects in `assets/sounds/` (the user's own
  recordings from `human/`, trimmed and normalized with ffmpeg). `CombatSystem` emits `sound(id, at)` events
  and `GameScene` plays them through `spatialMix` (pan by screen position, quieter off screen). An arrow sinking into
  a body (enemy, dragon, bowman) plays `arrowFlesh` (`Pghrt.m4a`; not into ice, not an explosive arrow). Enemies
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
  A hit doesn't flash the keep: `Tower.takeDamage(amount, at?)` knocks grey stone chips off where it lands (more for
  a harder hit; `CHIPS`), which bounce and fade; a health bar like the enemies' sits above it (`showHealth`, off for
  the menu's keeps). Arrows hit its silhouette, not a box: `keepHitParts` (`rendering/keep.ts`, pure, tested:
  plinth, walls, gatehouse, shaft, top, the co-op lower tower) via `Tower.hitTime`; `?debug` draws them cyan.
  Arrows that hit a keep (but explosive ones) stick into the stone (`Arrow.stickToWall`) and stay there.
  The co-op keep (`KeepOptions.twin`, `KeepLook.twin`) has a second, lower tower in place of the right wall
  (`KEEP_TURRET`, same footprint and hit box); `Tower.hideSpot(index)` is where each bowman stands when hiding
  (player 1 in the main tower, player 2 in the lower one).
- **Combat code layout**: `CombatSystem.update` runs a frame on the host: `EnemyAI` (every living enemy: walk, swing,
  shoot, detonate, dragons), `ArrowMagic` (fire, frost, vortex), `ArrowHits` (each arrow against enemies, keeps and,
  with friendly fire, bowmen); CombatSystem itself keeps what reaches beyond one target (explode, detonate, shatter,
  lightning, burns). Shared shapes in `combatGeometry.ts` (`Foe`, `bowmanBox`, `foeHitBoxes`). `GameScene` hands its
  arrows to `BattleArrows` (launching, shrapnel, enemy arrows, co-op copies, pruning, the aim preview's path), the view
  to `BattleCamera`, and the end screen's text to `levelEndInfo` (pure, tested).
- **Shared body state**: enemies and bowmen have the same `AfflictionLayer` (fire, frost, vortex hold; the bowman's own
  fire too, with his duration and flame size via `AfflictionOptions`) and the same `BodyMotion` (`systems/bodyMotion.ts`,
  pure, tested: thrown through the air, landing, the co-op guest's driven copy, the pin). Enemy's archer bow is
  `EnemyBow`, its falls `enemyFall.ts`, its hit boxes and stuck-arrow torso `enemyHitShape.ts` (all pure, tested);
  the bowman's walking speed and knockdown are `systems/bowmanMotion.ts`. Health bars: `rendering/healthBar.ts`.
- **Cleanup and redrawing**: `GameScene.pruneArrows` drops arrows that no longer show (`Arrow.isGone`: gone and no
  trail left; stuck ones stay), and CombatSystem forgets what stuck or gone arrows hit. A corpse at rest
  (`Enemy.isSettledCorpse`: fall done or pieces resting, nothing burning, icy or in a vortex; `DragonEnemy.deathSettled`
  after `DRAGON_SETTLE_MS`) is drawn once more and then not redrawn (96 corpses: ~10 ms → ~0.5 ms a frame).
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
