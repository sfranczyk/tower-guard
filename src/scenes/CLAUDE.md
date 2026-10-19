# Scenes (src/scenes)

Extend `Scene` (`core/Scene.ts`); `listenWindow()` and `onExit()` for cleanup; `ctx.goTo(...)`; SceneManager destroys
everything under `ctx.root` on each switch. Scenes never touch the DOM: they call `DomUi` and assign `ui.handlers.*`.

- **SandboxScene**: the battle setup form (ui/CLAUDE.md); the canvas behind shows the selected level's map.
  `ctx.session.sandbox` holds the settings, `ctx.session.run` (`RunState`) the level index and health carried between
  levels.
- **GameScene** plays one level. Hands arrows to `BattleArrows` (launching, shrapnel, enemy arrows, co-op copies,
  `pruneArrows`, the preview's path), the view to `BattleCamera`, enemies to `BattleEnemies` (waves, spawn, `unhorse`
  places unhorsed riders, defeated count, O-key hide), the player's soldiers to `BattleAllies` (summon from `ALLIES.spawnX`
  beyond the left edge, limits and pauses, `order`; keys Z/X/C summon, V cycles the order; none in online co-op yet; each
  level starts with none), bowmen to `BattlePlayers` (creation, per-frame picks/shots/bursts,
  falls, `status`), co-op setup to `startBattleSync` (`battleSync.ts`), win/loss checks to `BattleOutcome.ts` (`check`, `ended`, guest
  `showGuestEnd`), the end screen to `showLevelEnd` (`levelEndScreen.ts`, text from pure `levelEndInfo`), banners to `BattleBanners` (Banners option, solo: steps `systems/banners.ts`, draws them (`rendering/banner.ts`), edge markers; a captured banner = level cleared, ours lost = defeat), status texts to `battleText.ts` (pure). A
  Survival (`sandbox.mode`): `BattleSurvival.ts` (clock, `background.night`, `fleeAll` at dawn = level held; ?debug
  `scene.survival.skip(ms)`), enemy keep `Tower` `absent`, no Banners; end texts in `levelEnd.ts` (`survivedMs`).
  Held: `BattleRelief.ts` marches in the relief force (formation `systems/reliefFormation.ts`, tuning `RELIEF`), show only,
  outside the battle; BattleOutcome shows the end screen once it has formed up (a guest marches its own at time-up).
  Keyboard, HUD/pause handlers and soldier keys: `BattleControls.ts`. Esc pauses (`togglePause` / `setPaused`: `update`
  stops, `DomUi.showPause`; co-op: net/CLAUDE.md). The pause dialog's "Restart level" (`restartLevel`, solo/host) starts the level over: bowmen at full health, keeps as they are; in the keep
  it edits the quiver (`changeLoadout`: saved, shared in co-op, HUD rebuilt). A
  cleared level offers "Next level" (health carries over) until the last, then Victory; defeat goes back to setup. The
  world keeps running after a level ends (enemies cheer on defeat).
  `players` / `PlayerControl.ts`: see net/CLAUDE.md. Follows the bowman across `WORLD_WIDTH` (centred,
  `centeredCameraX(width, WORLD_WIDTH)`, in a wider view); scrolls `world` by `cameraX`.
- **Aim camera** (`core/camera.ts`, pure): while the local player draws, `GameScene.updateAim` simulates the shot every
  frame; `aimLookAhead` ignores a landing within `CAMERA_LOOK.deadZone` of the view, then slides up to the bowman
  `CAMERA_LOOK.edgeMargin` from the edge, eased (`CAMERA_LOOK.aimMs`); only slides further out unless he aims the other way
  (`nextLookShift`); after the shot stays while he stands, eases back once he moves (`CAMERA_LOOK.returnMs`). The drag is
  measured on screen, `getAim()` maps it to the world as the camera is now.
- **MenuScene**: menu over a live battlefield (meadow sun moved over the enemy keep, which lies in ruins: `abandoned`
  keep at 0 health, no fire); the bowman practises at archery targets (`menuRange.ts`, `MenuRange`: draw, hold,
  loose with the bow held up while the string snaps back and the string hand stays a moment (`Bowman.loose` /
  `holdBow`, `BowAim.shownHand`, rig `handTension`), every 10 shots a walk to
  collect the arrows; numbers in `RANGE`; target art `rendering/archeryTarget.ts`); labs under "Dev tools".
  Menus, labs and the lobby show a `BACKDROP_WIDTH` landscape, centred.
- **AnimationLabScene**: every animation once on the bare skeleton, in tabs Movement, Combat, Hurt, Death, Cheer (Pixi on
  a cream panel; "← Menu"). Rows `LAB_CATEGORIES` in `labRows.ts` (ids for `?lab=<id>`), looping falls and gibs in
  `labSequences.ts`.
- **DesignLabScene**: looks in tabs Enemies (each with an "Old" stickman tile), Player, Ideas; catalogue
  `rendering/designs/catalog.ts`; grid scrolls with the wheel.
- **SoundLabScene** + `ui/SoundLabPanel.ts`: every effect and variant, the theme with a jump to its loop seam.
- **CoopScene**: the lobby (net/CLAUDE.md).
