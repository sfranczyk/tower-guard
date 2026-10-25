# Scenes (src/scenes)

Extend `Scene` (`core/Scene.ts`); `listenWindow()` and `onExit()` for cleanup; `ctx.goTo(...)`; SceneManager destroys
everything under `ctx.root` on each switch. Scenes never touch the DOM: they call `DomUi` and assign `ui.handlers.*`.

- **SandboxScene**: the battle setup form (ui/CLAUDE.md); the canvas behind shows the selected level's map.
  `ctx.session.sandbox` holds the settings, `ctx.session.run` (`RunState`) the level index and health carried between
  levels.
- **GameScene** plays one level. Hands arrows to `BattleArrows` (launching, shrapnel, enemy arrows, co-op copies,
  `pruneArrows`, the preview's path), the view to `BattleCamera`, enemies to `BattleEnemies` (waves, spawn, `unhorse`
  places unhorsed riders, defeated count, O-key hide), the player's soldiers to `BattleAllies` (summon from `ALLIES.spawnX`
  beyond the left edge, from the reserve, `order`; keys Z/X/C summon, V cycles the order; only with support on (`supportAllowed`: battle mode, Rules page), none in online co-op yet; each
  level starts with none), bowmen to `BattlePlayers` (creation, per-frame picks/shots/bursts,
  falls, `status`), co-op setup to `startBattleSync` (`battleSync.ts`), rain/lightning, snow and sand to `BattleWeather`, combat news to
  `battleCombatEvents.ts`, win/loss checks to `BattleOutcome.ts` (`check`, `ended`, guest
  `showGuestEnd`), the end screen to `showLevelEnd` (`levelEndScreen.ts`, text from pure `levelEndInfo`), banners to `BattleBanners` (Banners option, solo: steps `systems/banners.ts`, draws them (`rendering/banner.ts`), edge markers; a captured banner = level cleared, ours lost = defeat), status texts to `battleText.ts` (pure). A
  Survival (`sandbox.mode`): `BattleSurvival.ts` (clock, `background.night`, `fleeAll` at dawn = level held; ?debug
  `scene.survival.skip(ms)`), enemy keep `Tower` `absent`, no Banners; end texts in `levelEnd.ts` (`survivedMs`).
  Held: `BattleRelief.ts` marches in the relief force at the knights' walking pace (knights stand still, the rest cheer; draw order `Enemy.baseZ`; formation `systems/reliefFormation.ts`, tuning `RELIEF`), show only,
  outside the battle; the end screen shows at once over it (a guest marches its own at time-up).
  Keyboard, HUD/pause handlers and soldier keys: `BattleControls.ts`. Esc pauses (`togglePause` / `setPaused`: `update`
  stops, `ui.dialogs.showPause`; co-op: net/CLAUDE.md, the host's `pauseFor` / `releaseLeftGuests`). The pause dialog's "Restart level" (`restartLevel`, solo/host) starts the level over: bowmen at full health, keeps as they are; in the keep
  it edits the quiver (`changeLoadout`: saved, shared in co-op, HUD rebuilt). A
  cleared level offers "Next level" (health carries over) until the last, then Victory; defeat goes back to setup. The
  world keeps running after a level ends (enemies cheer on defeat). The end card's "View battlefield" (`DomUi.setEndViewing`,
  `handlers.viewBattlefield` → `BattleControls.viewBattlefield`; Esc or "Back to results" at the top returns): after a win
  the bowman walks again without shooting (`WalkingInput`), after a loss the keys move the camera (`BattleCamera.pan`,
  `CAMERA_LOOK.panSpeed`); Space doesn't act on the hidden card.
  `players` / `PlayerControl.ts`: see net/CLAUDE.md. Follows the bowman across `worldWidth()` (centred,
  `centeredCameraX(width, worldWidth())`, in a wider view); scrolls `world` by `cameraX`.
- **Leftovers** (`BattleLeftovers.ts`, config `LEFTOVERS`, pure fade `systems/leftovers.ts`): corpses (enemies, soldiers,
  MOBA blue dragons) and stuck arrows fade and are gone after 20 s, host and guest each on their own; blood stains and
  scorch marks likewise (`systems/groundMarks.ts`, fed by `EffectsSystem` / `MagicVisuals`);
  `BattleEnemies.corpseCleared` keeps the defeated count. HUD health chip (keep, bowman) beside the Level chip
  (`HudValues.health`, MOBA regeneration icon from `BattleMoba.regenerating` / `MobaNet.rg`); blue numbers over hit bowmen (`DamageNumbers.showPlayerHit`, from the health drop each frame).
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
  a cream panel; "← Menu"). Rows `LAB_CATEGORIES` in `labRows.ts` (ids for `?lab=<id>`; `LabClock`, row types and framings in `labKit.ts`), looping falls and gibs in
  `labSequences.ts`.
- **DesignLabScene**: looks in tabs Enemies (each with an "Old" stickman tile), Allies, Ideas; catalogue
  `rendering/designs/catalog.ts`; grid scrolls with the wheel.
- **SoundLabScene** + `ui/SoundLabPanel.ts`: every effect and variant, the theme with a jump to its loop seam.
- **CoopScene**: the lobby (net/CLAUDE.md).
- **MOBA** (menu → "Create multiplayer room" → MOBA, or "Practice MOBA alone"; dev `?moba`): `MobaMode.ts` gathers it for GameScene: `BattleLanes` (both keeps'
  minions on one clock, at their team's level: `spawn`; the kamikaze is a siege unit, `Enemy.siege`, bigger: `Enemy.resize`, its blast drawn `kamikazeBlastLook`×), `BattleMoba` (gold for last hits, vaults, respawn, regen; host
  or alone) with `MobaUpgrades` (levels bought, their effects), `BattleShop` (I by your keep, `ui/ShopPanel.ts`), `MobaSky` (days, nights,
  eclipses: `Background.daySky`; the eclipse's comet in the world, `strikeComet` after the arrows move pays `MOBA_SKY.cometGold`; ?debug `scene.moba.sky.eclipseSoon()` / `skip(ms)`).
  Red players use `enemyTower`; the end is `BattleOutcome.endMatch` / `showMobaEnd` (`mobaEndInfo`, per team).
  Rules from the host's Rules tab: `SandboxSettings.moba` (`data/mobaRules.ts`: keep/bowman health, start gold, respawn, ally kill penalty;
  sent with `start`; `newRun(…, moba)`). Field `MOBA_WORLD_WIDTH` (2800), keeps `MOBA_KEEPS` (`inset` from the ends), always Green Meadow; Esc only opens this player's menu, the battle runs on
  (`BattleControls.frozen`), and the quiver is what was bought, in the order bought (no editing in the keep);
  `MOBA_ARROW_CHARGES` (one vortex) via `ArrowCooldowns.limits`.
