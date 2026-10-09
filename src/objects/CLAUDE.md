# Display objects with state (src/objects)

`Enemy.ts` is big: grep for the method you need and read it with offset/limit rather than the whole file.

## Shared body state
Enemies and bowmen have the same `AfflictionLayer` (fire, frost, vortex hold; the bowman's own fire with his duration
and flame size via `AfflictionOptions`) and the same `BodyMotion` (`systems/bodyMotion.ts`, pure, tested: thrown,
landing, the co-op guest's driven copy, the pin). Enemy's archer bow is `EnemyBow`, its falls `enemyFall.ts`, hit boxes
and stuck-arrow torso `enemyHitShape.ts` (all pure, tested); the bowman's walking speed and knockdown are
`systems/bowmanMotion.ts`. Health bars: `rendering/healthBar.ts`. Combat code takes `Foe = Enemy | DragonEnemy`.

## Enemy
- `Enemy.takeDamage(amount, { cause, fromX })` picks the reaction: headshot → `deathStiff`, explosion → `knockback`
  (survivors get up), other kills `death` or `deathCrumple` at random; blast kills blow it apart (rendering/CLAUDE.md).
  Knocked-back enemies slide up to `KNOCKBACK_PUSH_MAX` (`knockbackPush`, in `Enemy.updateFall`).
- Melee: `Enemy.playAttackAnimation(onImpact)` runs `onImpact` at `attackImpactProgress(style)` and drops it if knocked
  down, killed or cheering first. Hits if the bowman is within `strikeReach` and not in the keep; jumping doesn't dodge.
- `Enemy.celebrate()` picks a random cheer when the enemies win.
- Pinning (`Enemy.pin`, `pinDurationMs`, arrow at `Enemy.pinnedFootPoint`): no walking, still swings or shoots.
- **Black knights** (`knight`: fighter, longsword, one of `attackStyles` per attack: `overhead`, `swordRise`, `thrust`;
  `hammerKnight`: heavy, war hammer two-handed, 1.1× tall; `rendering/designs/knightSkins.ts`), `armor` =
  `KNIGHT_ARMOR` (0.35): `ArrowHits` scales body hits and shows sparks instead of blood; headshots, piercing arrows
  and blasts deal full damage. Black knight and hammer knight march (`walkStyle: 'march'`).
- **Dark priest** (`priest`, healer, magical) never attacks (`EnemyAI.updatePriest`): walks `PRIEST_FOLLOW_GAP` behind
  the soldier nearest to it, never nearer than `PRIEST_STANDOFF` (`priestPost`, pure); with none left it retreats to the
  enemy keep. Heals (`EnemyAI.castHeal`, pure `planHeals` / `ManaPool` in `systems/healing.ts`): every
  `PRIEST_HEAL_INTERVAL_MS`, each ground enemy within `PRIEST_HEAL_RADIUS` (not itself, not `healable: false`) up to
  `PRIEST_HEAL_PER_TARGET`, nearest first, a mana a point; refills at `PRIEST_MANA_REGEN_PER_S` (bar under its health).
  Cast pose `castBody`, `Enemy.castHeal`, state `'cast'`; `EffectsSystem.healPulse` and `healCrosses`.
- **Kamikaze**: runs in unarmed with a bomb (`pose.bomb`), dies to one arrow. Reaching the bowman (jumping doesn't save
  him) or the keep, `CombatSystem.detonate` (cause `'blast'`) runs `explode` and hurts the bowman (not in the keep) and
  keep within `KAMIKAZE_REACH` × radius, knocking him down (`Bowman.knockBack`, `BOWMAN_KNOCKBACK`). Killed by a direct
  explosive hit its bomb goes off with `KAMIKAZE_BLAST_POWER` (2); its pieces fly `KAMIKAZE_GIB_FORCE` times harder.
- **Zombie**: shuffles (march dragged) with arms out (`pose.zombie`, `ZOMBIE_REST`), attacks with `'grab'` (hit on the
  yank), pale green with green blood (`BodyColors`: `HUMAN_BODY` / `ZOMBIE_BODY`, `enemy.bodyColors`).
- **Mounted knight** (`horseKnight`, cavalry, `rides`): black knight on a warhorse (1.15×; `rendering/designs/warhorse.ts`)
  over `getHorsePose(timeMs, gait, lance)` (gaits `stand` / `walk` / `gallop`; `LanceHold`, thrust at `LANCE_IMPACT`).
  State `'mounted'`: gallop clock follows distance (`gaitGroundSpeed`), stops `reach.bowman` (42) short (`reach.keep`
  from the keep), lance hits within `strikeReach` 64. Hit zones `mountedHitZones` (each with its `part`: rider head =
  headshot, torso; horse barrel, neck, head = horse headshot; each leg `leg`; `Enemy.getHitBoxes`, `foeHitBoxes`;
  `?debug` draws legs orange). A leg hit deals `HORSE_LEG.damage` (0.5), the arrow glances off and by chance
  (`legHitLames`, `HORSE_LEG_LAME_CHANCE` per arrow, never explosive or vortex) the horse goes lame (`lameSpeed`,
  `lameMs`). **Two healths**: rider `stats.health` (50; `armor` on his torso only) and horse `mount.health` 70
  (`Mount.ts`: health, lame leg, bolting, death), two bars. `mountedDamage` splits a hit by `HitInfo.part`; blasts,
  lightning and shattering ice hit both in full; fire and falls the horse. The priest heals the more wounded first. Mass
  6, can't be pinned, never knocked down (a blast makes the horse shy). Once either falls, `isAlive` is false and
  `Enemy.onUnhorsed` → `GameScene.unhorse` (`RiderOff`) puts the rider on the ground as its `unhorsed` kind with the
  health left: rider killed → horse stands a moment and bolts off right; horse killed → it dies (`horseDeathKind`:
  outright kill, horse headshot, blast, lightning or ice → drop, else lie down; `Mount.die`) and throws the rider
  (`Enemy.throwOff`, `RIDER_OFF_FORCE`; `riderPending` keeps the level going). A vortex arrow in the rider
  (`Enemy.unseat`, `ArrowMagic.unseat`) lifts him out of the saddle and the horse bolts (`slowByWind` in reach).

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
- Settled corpses: `DragonEnemy.deathSettled` after `DRAGON_SETTLE_MS`; enemies `Enemy.isSettledCorpse` (drawn once
  more, then not redrawn).

## Bowman
- Drawn by `rendering/bowmanBody.ts` (player 1 ranger, co-op player 2 keep warden; `BowmanConfig.look`, colours from the
  battleground's `player` palette; `secondPlayerArmor`). Bow, hands, release point from `getArcherRig()`
  (`getBowReleasePoint()`); never add a separately positioned bow. `pose.bowReady` raised while drawing.
- Hides in the keep by jumping under it (`TOWER_ENTRY_ZONE_WIDTH`), S to come out; can walk behind it to the edge
  (`isAgainstEdge`). Knockdown (`knockBack`, `isStunned`: no move, jump, aim or keep). Burning (`ignite`), chill, pin
  (`pin`), friendly fire: see systems/CLAUDE.md. Death: `Bowman.die()`, fall from `deathFallFor`
  (`systems/bowmanDeath.ts`; clubbed → collapse or crumple, shot → stiff or crumple, burnt → crumple, lightning → stiff,
  blast → lying from the knockback), as if hit from where it came; `noteHit` / `BowmanHit` from CombatSystem.

## Arrow
`Arrow.hostile` (enemy arrows, no trail), `shooter`, `stickToWall`, `stuckTo`, `isGone`, `hideTrail()` / `ageTrail(keep)`.

## Tower (keep)
Drawn by `rendering/keep.ts`; `Tower` redraws only when `keepDamageStage` changes and animates torch, fire, smoke in
`update(deltaMs)`. `Tower.takeDamage(amount, at?)` knocks stone chips off (`CHIPS`), no flash; health bar (`showHealth`,
off in the menu). Arrows hit `keepHitParts` via `Tower.hitTime` (`?debug` cyan) and stick (`Arrow.stickToWall`), but
explosive ones. Co-op twin keep (`KeepOptions.twin`, `KEEP_TURRET`); `Tower.hideSpot(index)` per bowman.
