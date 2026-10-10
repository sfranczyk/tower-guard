# The player's bowman (src/objects/bowman)

`Bowman` is the façade every caller uses (controls, combat, co-op). Its parts:

- `Bowman.ts`: health, the health bar over his head (`setHealthRatio`, from the battle's Player health), death fall, keep in/out, knockdown, burning/chill, delegates to the parts below.
- `BowmanFigure.ts`: the drawn body (ranger / warden), walk and sprint blends, lean, fall poses, bow release point, burn points.
- `bowAim.ts` (pure, tested): aim direction and power, the bow raised and lowered.
- `bowmanFooting.ts` (pure, tested): walking, jumping (buffered), gravity and ground snap, the board's edges.
- `bowmanAloft.ts`: vortex hold, thrown through the air, landing, the pin.
- `bowmanNet.ts`: co-op `BowmanNet`, get/apply net state, `applyRemote`.

## Behaviour
- Drawn by `rendering/bowmanBody.ts` (player 1 ranger, co-op player 2 keep warden; `BowmanConfig.look`, colours from the
  battleground's `player` palette; `secondPlayerArmor`). Bow, hands, release point from `getArcherRig()`
  (`getBowReleasePoint()`); never add a separately positioned bow. `pose.bowReady` raised while drawing.
- Hides in the keep by jumping under it (`TOWER_ENTRY_ZONE_WIDTH`), S to come out; can walk behind it to the edge
  (`isAgainstEdge`). Knockdown (`knockBack`, `isStunned`: no move, jump, aim or keep). Burning (`ignite`), chill, pin
  (`pin`), friendly fire: see systems/CLAUDE.md. Death: `Bowman.die()`, fall from `deathFallFor`
  (`systems/bowmanDeath.ts`; clubbed → collapse or crumple, shot → stiff or crumple, burnt → crumple, lightning → stiff,
  blast → lying from the knockback), as if hit from where it came; `noteHit` / `BowmanHit` from CombatSystem.
