# Display objects with state (src/objects)

Ground enemies are in `enemy/`, dragons in `dragon/` and the player's bowman in `bowman/`, each with its own CLAUDE.md
listing its parts.

## Shared body state
Enemies and bowmen have the same `AfflictionLayer` (fire, frost, vortex hold; the bowman's own fire with his duration
and flame size via `AfflictionOptions`) and the same `BodyMotion` (`systems/bodyMotion.ts`, pure, tested: thrown,
landing, the co-op guest's driven copy, the pin). Enemy's parts: `enemy/CLAUDE.md`; the bowman's: `bowman/CLAUDE.md` (his
walking speed and knockdown are `systems/bowmanMotion.ts`). Health bars: `rendering/healthBar.ts`. Combat code takes `Foe = Enemy | DragonEnemy`.

## Arrow
`Arrow.hostile` (enemy arrows, no trail), `shooter`, `stickToWall`, `stuckTo`, `isGone`, `hideTrail()` / `ageTrail(keep)`.

## Tower (keep)
Drawn by `rendering/keep.ts`; `Tower` redraws only when `keepDamageStage` changes and animates torch, fire, smoke in
`update(deltaMs)`. `Tower.takeDamage(amount, at?)` knocks stone chips off (`CHIPS`), no flash; health bar (`showHealth`,
off in the menu). Arrows hit `keepHitParts` via `Tower.hitTime` (`?debug` cyan) and stick (`Arrow.stickToWall`), but
explosive ones. Co-op twin keep (`KeepOptions.twin`, `KEEP_TURRET`); `Tower.hideSpot(index)` per bowman.
