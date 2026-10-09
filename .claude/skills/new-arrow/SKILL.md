---
name: new-arrow
description: Checklist for adding a new arrow (projectile) type or arrow effect to Tower Guard (projectile data, icon, quiver, hit logic, magic, co-op, friendly fire). Use whenever a new arrow or arrow ability is added.
---

# Adding an arrow

Grep for a neighbouring arrow (`frost`, `pinning`, `shrapnel`) and copy its shape; read only what each step names.

## 1. Data
- `src/types/index.ts`: the projectile type id.
- `src/data/projectiles.ts`: mass, head drag, speed multiplier (+ `projectiles.test.ts`). Gravity stays shared.
- `src/data/loadout.ts`: available in the quiver (+ test). `src/data/sandbox.ts` only if a default loadout changes.
- Tuning → `src/config.ts` (prefix by arrow, e.g. `FROST_*`).

## 2. Looks
- `src/assets/arrow-<name>.svg` (HUD/quiver icon) loaded in `src/main.ts` like the others.
- In flight: `src/objects/Arrow.ts` (head, trail).

## 3. What it does
- Direct hits: `src/systems/ArrowHits.ts`. Lasting effects (burn, chill, vortex…): `src/systems/ArrowMagic.ts`, state in
  `objects/AfflictionLayer.ts` with pure logic in `systems/afflictions.ts` (+ test). Visuals via
  `systems/EffectsSystem.ts` / `systems/magicVisuals.ts`.
- Mounted knight, dragons, knights' armor, ice, friendly fire on bowmen: decide each (see `src/systems/CLAUDE.md`).
- Sound: an existing id or a new one (`src/audio/CLAUDE.md`).

## 4. Co-op
- Effects reach the guest as fx events (`EffectsSystem.onEffect`), afflictions in `af`; new state → `src/net/protocol.ts`,
  `HostSync.ts`, `GuestSync.ts`; note it in `src/net/CLAUDE.md`.

## 5. Finish
- `npm run verify`; in game with `?debug`, the arrow in slot 1, one screenshot at scale 0.5.
- 1–3 lines in `src/systems/CLAUDE.md`; commit.
