# Gameplay logic (src/systems)

## Combat layout
`CombatSystem.update` runs a frame on the host: `EnemyAI` (every living enemy: walk, swing, detonate; shooters and dragons in
`EnemyRanged.ts`, priest and shaman in `EnemyPriests.ts`),
`ArrowMagic` (fire, frost, vortex), `ArrowHits` (each arrow against enemies, keeps and, with friendly fire, bowmen);
CombatSystem keeps what reaches beyond one target (explode, detonate, shatter, lightning, burns); what sets a kamikaze's bomb off and the chain fuses: `kamikazeBomb.ts`. Shared shapes in
`combatGeometry.ts` (`Foe`, `bowmanBox`, `foeHitBoxes`). Emits `sound(id, at)` events (audio/CLAUDE.md). It forgets what
stuck or gone arrows hit. Targeting: nearest bowman out in the open, else the keep (`targeting.ts`).
Kamikaze awareness (`blastAwareness.ts`, pure, tested; tuning `KAMIKAZE_AWARENESS`): `EnemyAI.beginFrame` builds
`blastZones` (each kamikaze's blast at what it runs at, chained through every bomb within reach); a melee soldier
notices or misses each kamikaze once within `noticeRange` (`missChance`: race `blastAwareness`, zombies 0, low health,
a shaman's spell, mid-swing), flees a noticed one's zone (`BlastDodge`, "!" = `EffectsSystem.alarm`), then hesitates.

## Allies (the player's soldiers)
`Enemy` objects of the `side: 'ally'` kinds (squire, allyKnight, medic) in `CombatWorld.allies` (scenes/BattleAllies.ts).
`AllyAI.ts`: fighters go for the nearest ground enemy their order allows (`allyOrders.ts`, pure, tested: `orderPost`,
`pickFoe`; hold / advance / retreat), strike with `meleeBlow` (cause `'melee'`, `armor` turns it); the medic (archetype `medic`, `bandages`) picks one
patient (`bandaging.ts`, pure, tested: `pickPatient`, `bandageHeal`; tuning `MEDIC`), walks beside him, kneels
(`Enemy.startBandage`, a hit breaks it) and heals over time, then rests; idle she keeps behind the front (`priestPost`).
Bowmen via `bowmanHealth` / `bowmanHealed` events. Enemies:
`nearestMeleeTarget` (`targeting.ts`) stops melee enemies at a soldier (`EnemyAI.fightAlly`), archers on foot aim at
them, hostile arrows (`ArrowHits.hostileHitAlly`), kamikaze blasts and lightning hurt them; players' arrows only with
friendly fire (`arrowTargets`). Limits and pauses: `allyRoster.ts` (pure, tested), tuning `ALLIES`.

## Banners (`banners.ts`, pure, tested; tuning `BANNERS`)
The run's Banners option (`SandboxSettings.banners`, solo only): `Banners<Enemy>` (`CombatWorld.banners`) holds each
keep's banner (`home` / `carried` / `dropped`, never goes back by itself). Carriers: `canCarryBanner` (fighter, runner, heavy,
grabber, cavalry; squire, allyKnight). `step` takes, drops, returns or captures (`outcome`); `thief`, `bearer`, `fetchX`.
AI: carriers and fetchers `walkOnGuard` (EnemyAI / AllyAI: fight only what reaches them, the banner planted beside them,
`Enemy.banner.plant` / `lift`); enemies but kamikazes go for the `thief`, archers shoot him; `escortsBanner` kinds walk
behind their bearer (`enemyEscortPost`, `EnemyAI.escortRanks`, `BANNERS.escortRange`); both banners fly in one
`BannerBreeze` (`bannerBreeze.ts`, pure, tested: turns and lulls, follows a real wind; `BANNERS.breeze*`); soldiers on Advance go to the enemy banner, escort a `bearer` (`escortPost`), chase the thief.

## Waves (`waveDirector.ts`, pure, tested; not shown in the UI yet)
`planWaves` spreads each type through the level (tougher types later, by `arrival`, so the first wave of
`WAVES.firstSize` is light) in waves growing by `WAVES.sizeStep` to `WAVES.maxSize`; `WaveDirector.update` (every frame,
so it pauses with the game) releases the first after `WAVES.startDelayMs`, a wave's enemies `WAVES.spawnIntervalMs`
apart, and the next once at most `WAVES.releaseAlive` stand and `WAVES.minGapMs` passed, or after `WAVES.maxGapMs`.
Difficulty (`SandboxSettings.difficulty`, battle setup, medium by default; co-op: the host's sandbox) never changes the
enemy counts. `data/difficulty.ts` `enemyEdge` (`CombatWorld.enemyEdge`; easy 1, `DIFFICULTY_SCALE.*Damage/*Spread`):
every enemy hit on bowmen and keep × `damage` (melee, arrows, kamikaze, dragon burn), archer aim error × `aimSpread`; `wavePacing`: medium/hard send a wave in
groups of `DIFFICULTY_SCALE.groupSize` (kinds together, `groupByKind`), `groupSpawnIntervalMs` apart, `groupGapMs` between.

## Survival (`survivalWaves.ts`, `nightCycle.ts`, pure, tested; tuning `SURVIVAL`)
`SurvivalDirector` (BattleEnemies in survival): waves `survivalWaveGap` apart (25, 35, then 45 s: `waveEveryMs`, `waveGapStepMs`, `maxWaveEveryMs`; or `clearedDelayMs` after the field is
cleared), `survivalWaveSize` growing up to the difficulty's `*PeakWave` then flat ± `sizeJitter`, × level and difficulty;
kinds by `arrival` (`kindsArrived`) around a lead kind (`pickLead`, never a healer or shaman; `drawWave` `leadShare`); levels over `finaleMinMs`
end with a finale (× `finaleScale`) `finaleAtMs` before the end, nothing after; at most `maxAlive` standing. `nightSky(progress)`: moon, stars, dawn/day weights, shade, `sunRise`. Time up: `Enemy`/`DragonEnemy.flee`,
`EnemyAI.runOff` (off the right edge, `escape`).

## Arrow flight (`ballistics.ts`)
Gravity + quadratic drag `ARROWS.drag`, wind in `FlightParams`. The trajectory preview, the aim camera and enemy archer
aim (`solveLaunchAngle`, cached ~250 ms) simulate with the same functions: any flight change goes here. Enemy archers
shoot at the plain `bowSpeed`. Per-type mass/drag/speed in `data/projectiles.ts`.
- Hit damage: `rollArrowDamage` (data/enemies): `ARROWS.damageMin..damageMax` on the body, a headshot the upper half
  × `headshotMultiplier`; piercing, fragments, fire and frost scale it. Enemy health is planned in arrows (`ENEMY_KINDS`).
- Shrapnel (Space in flight): `SHRAPNEL_FRAGMENTS` `'fragment'` arrows (`shrapnelBurst`, pure),
  `SHRAPNEL_FRAGMENT_DAMAGE` each; `GameScene.burstShrapnel` swaps them in.
- Pinning: `PIN_DAMAGE` 0–4 (no headshot bonus), sticks through the foot into the ground, `PIN_DURATION_MS` 20 s
  (`PIN_DURATION_ZOMBIE_MS`); brutes and dragons can't be pinned.
- Explosive: only the blast hurts; `explosionDamage` falls off from `EXPLOSION_DAMAGE.centre` to `.edge` at
  `EXPLOSION_RADIUS`; `HitInfo.blastDistance` drives the splash gib chance. `explode(…, power)` scales radius and damage.

## Fire, frost and vortex (`ArrowMagic.ts`, host only; tuning `FIRE_SPREAD`, `FIRE_PATCH`, `FIRE_ARROW_DAMAGE`, `ENEMY_BURN_*`, `FROST_*`, `VORTEX_*`, `THROW_GRAVITY`, `FALL_DAMAGE`)
Fire and frost hit weaker (`MAGIC_HIT_DAMAGE`), vortex not at all. State in `AfflictionLayer` (logic `afflictions.ts`,
pure): burning (`BURN_TICK_MS`, cause `'burn'`, spreads: `fireGen` steps from the arrow, shorter each, `fireproofMs` after going out; `FIRE_SPREAD`), chilled (`timeScale`), frozen (ice block; a killing hit or any
blast shatters it, cause `'shatter'`). Fire thaws, frost puts fire out; the fire dragon doesn't burn, dragons are only
chilled. A fire arrow in the ground leaves a fire patch only with `FIRE_PATCH.chance` (else nothing).
Vortex (`vortex.ts`, pure): pulls ground enemies in, lifts them (`Enemy.holdInVortex`, flailing) and throws them
(`Enemy.throwInAir`, `flight.ts`); landing = knockback + `onLanded` fall damage (cause `'fall'`; a kamikaze the fall would kill goes off,
frozen shatters). A direct hit levitates (`Levitation`, own clock of `VORTEX.ms`, then drops with the full fall); a further
hit restarts that clock and lifts it `VORTEX.levitateDecay`× the lift before (`levitateHeight(age, mass, from, hits)`). It all goes by **mass** (`enemyMass`; goblin 0.8, zombie 1, raider/hunter/priest 1.2 =
`VORTEX_MASS.reference`, bowman `BOWMAN_MASS` 1.3, kamikaze 1.4, black knight 1.9, heavy knight 2.5, ogre 4.2): pace
`massPace` (at most `lightest`×), thrown √(reference/mass); above `fullLift` (2.1) only up to `funnelCeiling`, circling;
from `anchor` (3.6, `resistsVortex`) not caught, walks at `VORTEX.heavyWalk` (`slowByWind`). Levitation by mass:
`levitateFull` 1.4, `levitateShare`, `VORTEX_LEVITATE_HEAVY` at `levitateHeavy` 4.2. Nothing is pinned in the air.
Dragons get a ring of wind (`drawAirVortex`) and turbulence (`DRAGON_TURBULENCE_MS`, `AfflictionLayer.stir`,
`buffetOffset`: no fire breath, archer `DRAGON_TURBULENCE_SPREAD`× wider). Visuals: `magicVisuals.ts` via EffectsSystem.

## Weather and arrows (`weatherArrows.ts`, pure, tested; tuning `WEATHER_ARROWS`, `CombatWorld.weather`)
On loosing (host, `BattleArrows.launchPlayer`) `rollArrowMishap` gives an explosive arrow in a sandstorm / a fire arrow in the
rain an `Arrow.mishap` at a random `atMs`; `CombatSystem.update` sets it off (`explode`) or puts it out (`Arrow.douse`, flies on
as plain, `fizzle`), event `arrowMishap` → shooter's status. `groundFireChance` (rain lower, snow 0), `frostFreezesAtOnce` on snow.

## Dragon manoeuvres (`dragonManoeuvre.ts`, pure, tested)
Dragon archer phases approach → hover → transit (`stepManoeuvre`, `pickAltitude`, `kick` spring jolt, `flightShare`);
tuning `DRAGON_FLIGHT`. Hover points and turning stay in `dragonFlight.ts`. The fire dragon may leave a hover for a
strafing run (phase `'strafe'`: lurk (flies to its start like to a hover point, waits; skipped within `readyRange`; `lurkStep`: never backs off, sets
off when he comes `readyRange` closer, turns round if he runs under it) →
run (fire lit, dives to the pass height; `nearWorldEdge` brakes it within `edgeOut`) → out; geometry in `dragonStrafe.ts`, pure, tested:
`strafeDistance`, `strafeStartX`, `strafeAltitude`, `groundReach`; `FIRE_DRAGON_STRAFE`, tunable), pass after pass, by `weight`. `ManoeuvreInput.waiting` (all in the keep): `switchWaiting` swaps
to the wait ranges.

## Friendly fire (`session.friendlyFire`, on by default; co-op: the host's)
Players' arrows hit bowmen out in the open like enemies (`friendlyTargets`): head and body `Bowman.getHitBoxes` (his drawn pose, like the enemies'), blasts,
fire (`Bowman.ignite`), frost (`Bowman.chill`; frozen = stunned, blast or landing breaks the ice), vortices (`Walker` =
Enemy | Bowman), pins (`Bowman.pin`). Own shooter spared for `FRIENDLY_FIRE_GRACE_MS`.

## Enemy archers
`CombatSystem.updateArcher` walks them into `ENEMY_ATTACK.archerRange`, fires hostile arrows via `enemyShot`. Hostile arrows
hit the bowman (not dead) or a soldier, or the keep while he hides, never enemies. `ENEMY_ARCHER_*`, `ENEMY_ARROW_*`.

## Burning bowman (`burning.ts`)
`flamesTouch` (fire dragon puff cores vs the bowman box; not in the keep) → `Bowman.ignite`: `BURN_DAMAGE_PER_S` for
`BURN_DURATION_MS` (easy 4 s, medium 6 s, hard 8 s; `relight(difficulty)`, `BowmanConfig.burnMs`) after the last touch.

## Lightning (storm weather)
`lightning.ts` pure (bolt shapes, schedule, range), `WeatherSystem.ts` draws: sky flashes, ground strikes crackling for
`LIGHTNING_WARNING_MS` first. `CombatSystem.lightningStrike`: `LIGHTNING_DAMAGE` within `LIGHTNING_RADIUS` (cause
`'lightning'`); the bowman is safe in the keep.

## Battlefield (`battlefield.ts`)
`worldWidth()` / `enemyKeepX()`: the level's field, `WORLD_WIDTH` (2400) or `SURVIVAL_WORLD_WIDTH` (2100, no enemy keep:
`enemyKeepX()` is only its spot) (GameScene's `useBattlefield`).

## Terrain (`terrain.ts`)
`groundAt(x)`: waves of `TERRAIN_AMPLITUDE` around `GROUND_Y`, flat at both keeps. Use it, not `GROUND_Y`, for anything
touching the ground.

## Wind (`windShift.ts`, pure)
Steps −3..3 (`WIND_STEPS`, calm between, = the status line's arrows); `rollWind` per level; `WindShifts` every 45 s:
±1 step 50%, ±2 10%, wild (3+ away) 5%, else none (tunable `WIND_SHIFT`).
GameScene reads it live (`wind()` in BattleArrows / CombatWorld; an arrow keeps the wind it was loosed in), co-op event `wind`.
