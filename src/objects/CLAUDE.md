# Display objects with state (src/objects)

Ground enemies are in `enemy/` and the player's bowman in `bowman/`, each with its own CLAUDE.md listing its parts.

## Shared body state
Enemies and bowmen have the same `AfflictionLayer` (fire, frost, vortex hold; the bowman's own fire with his duration
and flame size via `AfflictionOptions`) and the same `BodyMotion` (`systems/bodyMotion.ts`, pure, tested: thrown,
landing, the co-op guest's driven copy, the pin). Enemy's parts: `enemy/CLAUDE.md`; the bowman's: `bowman/CLAUDE.md` (his
walking speed and knockdown are `systems/bowmanMotion.ts`). Health bars: `rendering/healthBar.ts`. Combat code takes `Foe = Enemy | DragonEnemy`.

## DragonEnemy
- Dragon archer (`dragon`): flies at `DRAGON_ALTITUDE`, hovers `DRAGON_HOVER_OFFSET` in front of the bowman
  (`systems/dragonFlight.ts`, pure) on either side: turns (`nextHoverSide`, over `DRAGON_TURN_MS`, no shots meanwhile)
  when he gets `DRAGON_TURN_PAST` behind or the edge leaves no room. `CombatSystem.updateDragon` aims like an enemy
  archer. Hit zones `dragonHitZones` (`rendering/dragon.ts`; rider and head = headshots, body and halves of neck and
  tail normal; tested to chain without gaps); earliest zone hit wins (headshot ties). Arrows stick into it. Killed, it
  plays the lab's `fall` in "death space" (sprite space, ground at `GIB_GROUND_Y`, from its height above `groundAt(x)`;
  `toWorld` follows `art` so stuck arrows stay); a direct explosive kill blows the rider apart (`riderGibSimulation`).
  Ground lightning skips it (`isFlying`).
- Fire dragon (`fireDragon`, `DRAGON_KINDS`, `red` palette, `'unarmed'` rider): lower and closer
  (`FIRE_DRAGON_ALTITUDE`, `FIRE_DRAGON_HOVER_OFFSET`); `CombatSystem.updateFireDragon` calls `breathe` within
  `FIRE_DRAGON_RANGE` (`FIRE_DRAGON_BREATH_INTERVAL_MS`). Breath drawn into `fireArt`, `getFlames` gives hot puffs in
  world space. Killed by a direct explosive hit it blows up: `explode` with `FIRE_DRAGON_BLAST_POWER` (3),
  `EffectsSystem.dragonBlast`, `DragonGibSimulation` chunks and rider gibs (`DragonDeath.dragonGibs`), stuck arrows gone
  (`Arrow.stuckTo`).
- Settled corpses: `DragonEnemy.deathSettled` after `DRAGON_SETTLE_MS`; enemies `EnemyFigure.isSettledCorpse` (drawn once
  more, then not redrawn).

## Arrow
`Arrow.hostile` (enemy arrows, no trail), `shooter`, `stickToWall`, `stuckTo`, `isGone`, `hideTrail()` / `ageTrail(keep)`.

## Tower (keep)
Drawn by `rendering/keep.ts`; `Tower` redraws only when `keepDamageStage` changes and animates torch, fire, smoke in
`update(deltaMs)`. `Tower.takeDamage(amount, at?)` knocks stone chips off (`CHIPS`), no flash; health bar (`showHealth`,
off in the menu). Arrows hit `keepHitParts` via `Tower.hitTime` (`?debug` cyan) and stick (`Arrow.stickToWall`), but
explosive ones. Co-op twin keep (`KeepOptions.twin`, `KEEP_TURRET`); `Tower.hideSpot(index)` per bowman.
