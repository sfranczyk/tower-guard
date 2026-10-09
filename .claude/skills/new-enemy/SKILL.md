---
name: new-enemy
description: Checklist for adding a new enemy type or variant to Tower Guard (catalogue entry, look, icon, labs, co-op sync, tests). Use whenever a new enemy, enemy variant or enemy ability is added.
---

# Adding an enemy

Read only what each step names; grep for the neighbouring entry (e.g. `priest`, `zombie`) and copy its shape.

## 1. Decide (ask the user if the request doesn't say)
- Archetype: an existing one (`fighter`, `runner`, `heavy`, `archer`, `kamikaze`, `grabber`, `skyArcher`,
  `fireBreather`, `healer`, `cavalry`) or a new one (then step 5 applies).
- Race (`human`, `goblin`, `ogre`, `undead`, `dragon`) and any trait overrides (mass, healable, pin, freeze, burn).
- Health, damage range, keep damage, size, strike reach, `arrival`, `armor`, walk style.

## 2. Data (always)
- `src/types/index.ts`: add the id to `EnemyType`.
- `src/data/enemyKinds.ts`: the `ENEMY_KINDS` entry (+ `enemyKinds.test.ts`: the expectations listing every type).
- `src/data/enemies.ts`: `ENEMY_LOOKS` entry if it differs from its archetype's.
- `src/data/sandbox.ts`: add the id with 0 to every default level row (and `sandbox.test.ts`).
- `src/systems/waveDirector.test.ts` if it enumerates types.
- Tuning numbers → `src/config.ts`.

## 3. Look (always)
- `src/rendering/enemyBody.ts`: the `look` / `club` / `gibs` entry. A new look goes in `rendering/designs/*Skins.ts`
  (reuse `skinKit.ts` / `drawHumanoid`).
- `src/rendering/designs/catalog.ts`: a design-lab entry (copy a neighbour; include `blownApart(id)`).
- `src/ui/icons.ts`: the `ICON_ENEMIES` icon (28×28 flat SVG, `figure(...)` helper).

## 4. Animations (only if it moves in a new way)
- Pose math in `src/rendering/` (pure, with a test), then a row in `src/scenes/labRows.ts` (see `/new-animation`).

## 5. Behaviour (only for a new archetype or ability)
- `src/data/enemyKinds.ts` `ARCHETYPES` flags; AI in `src/systems/EnemyAI.ts` (one `update<Name>` method);
  hits in `src/systems/ArrowHits.ts`; hit zones in `src/systems/combatGeometry.ts` / `objects/enemy/enemyHitShape.ts`.
- State on `Enemy`: `src/objects/enemy/` (its CLAUDE.md lists the parts). The façade `Enemy.ts` only delegates:
  drawing a new state → `EnemyFigure.ts`; a new timed action → `enemyActions.ts`; hit reactions →
  `enemyDamage.ts` / `enemyFall.ts` (`damageReaction`); movement → `enemyMotion.ts`; co-op fields → `enemyNet.ts`.
  Add a new small part for a new ability rather than growing these.
- **Co-op**: whatever the host decides must reach the guest: an event or a snapshot field in `src/net/protocol.ts`,
  sent in `HostSync.ts`, applied in `GuestSync.ts`. Add it to the list in `src/net/CLAUDE.md`.

## 6. Finish
- `npm run verify`.
- Visual check: `?designs=<id>` and, in game, `?debug` with a sandbox level containing only this enemy; one screenshot
  at scale 0.5 (several → a subagent).
- Add 1–3 lines to `src/objects/enemy/CLAUDE.md` (behaviour) and/or `src/data/CLAUDE.md` (stats); commit.
