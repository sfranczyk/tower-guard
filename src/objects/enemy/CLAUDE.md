# Ground enemies (src/objects/enemy)

`Enemy` is the façade every caller uses (AI, combat, co-op; public API in `Enemy.ts`). The work is in its parts —
open the one you need:

- `Enemy.ts`: the façade: fields, getters, archer bow use, short delegates to the parts below.
- `enemyTypes.ts`: `HitInfo`, `HitBox` (also the dragon's), `RiderOff`, `EnemyNet`, `EnemyTarget` (re-exported from Enemy).
- `EnemyFigure.ts`: the drawn body: look state per frame (walk, swing, cast, cheer, pinned, flail, flight), falls, gibs, settled corpses, body transform/torso.
- `enemyActions.ts` (pure, tested): swing timer/style/impact, attack pause, cast, hit stagger, cheer.
- `enemyDamage.ts` (`Vitals` pure, tested): health; `takeDamage` reactions, mounted damage share, unseat, heals.
- `enemyFall.ts` (pure, tested): `damageReaction`, `blastPush`, death kind, the fall's clock and push.
- `enemyMotion.ts`: walking to the target, vortex hold, throws, pins, a rider thrown off / lifted from the saddle.
- `MountedRider.ts`: a mounted knight's horse side: gait clock and pose, mounted animation, horse death, bolting, hit zones.
- `Mount.ts`: the horse's health, lame leg, bolting, death state.
- `EnemyBars.ts`: health, horse and mana bars and their placement.
- `EnemyBow.ts` (pure, tested): an archer's bow (raise, draw, aim, pause).
- `enemyHitShape.ts` (pure, tested): head/body boxes and the stuck-arrow torso from the drawn pose.
- `enemyNet.ts`: co-op `getNetState` / `applyNetState`.

## Behaviour
- `Enemy.takeDamage(amount, { cause, fromX })` picks the reaction: headshot → `deathStiff`, explosion → `knockback`
  (survivors get up), other kills `death` or `deathCrumple` at random; blast kills blow it apart (rendering/CLAUDE.md).
  Knocked-back enemies slide up to `KNOCKBACK_PUSH_MAX` (`knockbackPush`, in `EnemyFigure.updateFall`).
- Melee: `Enemy.playAttackAnimation(onImpact)` runs `onImpact` at `attackImpactProgress(style)` and drops it if knocked
  down, killed or cheering first. Hits if the bowman is within `strikeReach` and not in the keep; jumping doesn't dodge.
- `Enemy.celebrate()` picks a random cheer when the enemies win.
- Pinning (`Enemy.pin`, `pinDurationMs`, arrow at `Enemy.pinnedFootPoint`): no walking, still swings or shoots.
- **Black knights** (`knight`: fighter, longsword, one of `attackStyles` per attack: `overhead`, `swordRise`, `thrust`;
  `hammerKnight`: heavy, war hammer two-handed, 1.1× tall; `rendering/designs/knightSkins.ts`), `armor` =
  `KNIGHT_ARMOR` (0.35): `ArrowHits` scales body hits and shows sparks instead of blood; headshots, piercing arrows
  and blasts deal full damage. Black knight and hammer knight march (`walkStyle: 'march'`).
- **Dark priest** (`priest`, healer, magical) never attacks (`EnemyAI.updatePriest`): walks `PRIEST_FOLLOW_GAP` behind
  the front soldier on its side of the target, never nearer than `PRIEST_STANDOFF` (`priestPost`, pure); with soldiers
  only beyond the target it dashes past it to them; with none it retreats to the enemy keep, and once only priests are
  left (`reinforcementsDue` false) walks off the right edge (`PRIEST_ESCAPE_BEYOND`): `Enemy.escape()`, no longer
  `isAlive`, counts as defeated. Heals (`EnemyAI.castHeal`, pure `planHeals` / `ManaPool` in `systems/healing.ts`): every
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
  `Enemy.onUnhorsed` → `BattleEnemies.unhorse` (`RiderOff`) puts the rider on the ground as its `unhorsed` kind with the
  health left: rider killed → horse stands a moment and bolts off right; horse killed → it dies (`horseDeathKind`:
  outright kill, horse headshot, blast, lightning or ice → drop, else lie down; `Mount.die`) and throws the rider
  (`Enemy.throwOff`, `RIDER_OFF_FORCE`; `riderPending` keeps the level going). A vortex arrow in the rider
  (`Enemy.unseat`, `ArrowMagic.unseat`) lifts him out of the saddle and the horse bolts (`slowByWind` in reach).
