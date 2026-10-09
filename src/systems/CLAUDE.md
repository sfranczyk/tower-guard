# Gameplay logic (src/systems)

## Combat layout
`CombatSystem.update` runs a frame on the host: `EnemyAI` (every living enemy: walk, swing, shoot, detonate, dragons),
`ArrowMagic` (fire, frost, vortex), `ArrowHits` (each arrow against enemies, keeps and, with friendly fire, bowmen);
CombatSystem keeps what reaches beyond one target (explode, detonate, shatter, lightning, burns). Shared shapes in
`combatGeometry.ts` (`Foe`, `bowmanBox`, `foeHitBoxes`). Emits `sound(id, at)` events (audio/CLAUDE.md). It forgets what
stuck or gone arrows hit. Targeting: nearest bowman out in the open, else the keep (`targeting.ts`).

## Waves (`waveDirector.ts`, pure, tested; not shown in the UI yet)
`planWaves` spreads each type through the level (tougher types later, by `arrival`, so the first wave of
`WAVES.firstSize` is light) in waves growing by `WAVES.sizeStep` to `WAVES.maxSize`; `WaveDirector.update` (every frame,
so it pauses with the game) releases the first after `WAVES.startDelayMs`, a wave's enemies `WAVES.spawnIntervalMs`
apart, and the next once at most `WAVES.releaseAlive` stand and `WAVES.minGapMs` passed, or after `WAVES.maxGapMs`.

## Arrow flight (`ballistics.ts`)
Gravity + quadratic drag `ARROWS.drag`, wind in `FlightParams`. The trajectory preview, the aim camera and enemy archer
aim (`solveLaunchAngle`, cached ~250 ms) simulate with the same functions: any flight change goes here. Enemy archers
shoot at the plain `bowSpeed`. Per-type mass/drag/speed in `data/projectiles.ts`.
- Shrapnel (Space in flight): `SHRAPNEL_FRAGMENTS` `'fragment'` arrows (`shrapnelBurst`, pure),
  `SHRAPNEL_FRAGMENT_DAMAGE` each; `GameScene.burstShrapnel` swaps them in.
- Pinning: `PIN_DAMAGE` 0–4 (no headshot bonus), sticks through the foot into the ground, `PIN_DURATION_MS` 20 s
  (`PIN_DURATION_ZOMBIE_MS`); brutes and dragons can't be pinned.
- Explosive: only the blast hurts; `explosionDamage` falls off from `EXPLOSION_DAMAGE.centre` to `.edge` at
  `EXPLOSION_RADIUS`; `HitInfo.blastDistance` drives the splash gib chance. `explode(…, power)` scales radius and damage.

## Fire, frost and vortex (`ArrowMagic.ts`, host only; tuning `FIRE_*`, `ENEMY_BURN_*`, `FROST_*`, `VORTEX_*`, `THROW_GRAVITY`, `FALL_DAMAGE`)
Fire and frost hit weaker (`MAGIC_HIT_DAMAGE`), vortex not at all. State in `AfflictionLayer` (logic `afflictions.ts`,
pure): burning (`BURN_TICK_MS`, cause `'burn'`, spreads), chilled (`timeScale`), frozen (ice block; a killing hit or any
blast shatters it, cause `'shatter'`). Fire thaws, frost puts fire out; the fire dragon doesn't burn, dragons are only
chilled. A fire arrow in the ground leaves a fire patch.
Vortex (`vortex.ts`, pure): pulls ground enemies in, lifts them (`Enemy.holdInVortex`, flailing) and throws them
(`Enemy.throwInAir`, `flight.ts`); landing = knockback + `onLanded` fall damage (cause `'fall'`; kamikaze goes off,
frozen shatters). A direct hit levitates (`levitateHeight`, drops with `VORTEX.levitateFall`, `VORTEX.levitateBoost`
per further arrow). It all goes by **mass** (`enemyMass`; goblin 0.8, zombie 1, fighter/archer/priest 1.2 =
`VORTEX_MASS.reference`, bowman `BOWMAN_MASS` 1.3, kamikaze 1.4, black knight 1.9, hammer knight 2.5, ogre 4.2): pace
`massPace` (at most `lightest`×), thrown √(reference/mass); above `fullLift` (2.1) only up to `funnelCeiling`, circling;
from `anchor` (3.6, `resistsVortex`) not caught, walks at `VORTEX.heavyWalk` (`slowByWind`). Levitation by mass:
`levitateFull` 1.4, `levitateShare`, `VORTEX_LEVITATE_HEAVY` at `levitateHeavy` 4.2. Nothing is pinned in the air.
Dragons get a ring of wind (`drawAirVortex`) and turbulence (`DRAGON_TURBULENCE_MS`, `AfflictionLayer.stir`,
`buffetOffset`: no fire breath, archer `DRAGON_TURBULENCE_SPREAD`× wider). Visuals: `magicVisuals.ts` via EffectsSystem.

## Friendly fire (`session.friendlyFire`, on by default; co-op: the host's)
Players' arrows hit bowmen out in the open like enemies (`friendlyTargets`): top `BOWMAN_HEAD` px headshot, blasts,
fire (`Bowman.ignite`), frost (`Bowman.chill`; frozen = stunned, blast or landing breaks the ice), vortices (`Walker` =
Enemy | Bowman), pins (`Bowman.pin`). Own shooter spared for `FRIENDLY_FIRE_GRACE_MS`.

## Enemy archers
`CombatSystem.updateArcher` walks them into `ENEMY_ATTACK.archerRange`, fires hostile arrows via `enemyShot`. Hostile arrows
hit the bowman (not dead), or the keep while he hides, never enemies. `ENEMY_ARCHER_*`, `ENEMY_ARROW_*`.

## Burning bowman (`burning.ts`)
`flamesTouch` (fire dragon puff cores vs the bowman box; not in the keep) → `Bowman.ignite`: `BURN_DAMAGE_PER_S` for
`BURN_DURATION_MS` after the last touch.

## Lightning (storm weather)
`lightning.ts` pure (bolt shapes, schedule, range), `WeatherSystem.ts` draws: sky flashes, ground strikes crackling for
`LIGHTNING_WARNING_MS` first. `CombatSystem.lightningStrike`: `LIGHTNING_DAMAGE` within `LIGHTNING_RADIUS` (cause
`'lightning'`); the bowman is safe in the keep.

## Terrain (`terrain.ts`)
`groundAt(x)`: waves of `TERRAIN_AMPLITUDE` around `GROUND_Y`, flat at both keeps. Use it, not `GROUND_Y`, for anything
touching the ground.
