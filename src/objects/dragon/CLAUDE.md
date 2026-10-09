# Dragons (src/objects/dragon)

`DragonEnemy` is the façade the combat code uses (same interface as Enemy where shared; `Foe = Enemy | DragonEnemy`).
Its parts:

- `DragonEnemy.ts`: flight, hits, zones, anchors, co-op state, per-frame drawing.
- `dragonKinds.ts`: `DRAGON_KINDS` (palette, rider, altitude, hover offset), rider looks, rider gib colours.
- `DragonBow.ts` (pure, tested): the archer's aim, draw and shot timer.
- `DragonBreath.ts` (pure, tested): the fire dragon's breath clock, cooldown and fire aim.
- `DragonCorpse.ts`: the death: fall or chunks, the thrown or blown-apart rider, `settled`.
- `dragonFrame.ts` (pure, tested): sprite/art transforms, local ↔ world points and angles.

## Behaviour
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
- Settled corpses: `DragonEnemy.deathSettled` (`DragonCorpse.settled`) after `DRAGON_SETTLE_MS`; enemies `EnemyFigure.isSettledCorpse` (drawn once
  more, then not redrawn).
