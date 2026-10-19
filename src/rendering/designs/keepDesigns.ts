import type { Vec2 } from '../../types';
import { KEEP_BASE, drawKeep, keepHideSpot } from '../keep';
import { keepTones, type KeepDamage } from '../keepStyle';
import { archerBody, type BodyPose } from './bodyPoses';
import type { DesignEntry, DesignView } from './catalog';
import { huntsmanLook, steppeLook } from './coopSkins';
import { DESIGN_GROUND_Y } from './designSkeleton';
import { rangerLook, wardenLook } from './playerSkins';
import { drawHumanoid, type HumanoidLook } from './skinKit';

/**
 * The design lab's Keeps tab: the player's keep with one tower per bowman (rendering/keep.ts, KEEP_TURRETS), the
 * bowmen standing hidden in their towers, and its damage stages.
 */

/** Keep drawing units to figure units: the game draws the keep at 0.5 and the bowman at 1/3. */
const KEEP_TO_FIGURE = 1.5;
/** Green Meadow's far hills, for the stone's tint. */
const MEADOW_HILLS = 0x86a36f;
/** BodyPose feet are this far below the hip (bowmanBody.ts). */
const FEET_BELOW_HIP = 57;
const SHOT_MS = 2600;

/** Player 1 to 4, each in his own tower. */
const BOWMEN: ReadonlyArray<(timeMs: number) => HumanoidLook> = [
  (t) => rangerLook(t, 0),
  () => wardenLook(),
  (t) => steppeLook(t, 0),
  (t) => huntsmanLook(t, 0),
];

/** Every point of a pose moved by (dx, dy) (numbers such as shin angles stay). */
const shifted = <T>(value: T, dx: number, dy: number): T => {
  if (Array.isArray(value)) {
    return value.map((item) => shifted(item, dx, dy)) as T;
  }
  if (value && typeof value === 'object') {
    const point = value as unknown as Vec2;
    if (typeof point.x === 'number' && typeof point.y === 'number' && Object.keys(value).length === 2) {
      return { x: point.x + dx, y: point.y + dy } as T;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shifted(item, dx, dy)])) as T;
  }
  return value;
};

/** A bowman aiming out over the parapet, raising, drawing and loosing on his own beat. */
const aimingBody = (timeMs: number, index: number): BodyPose => {
  const c = ((timeMs + index * 700) % SHOT_MS) / SHOT_MS;
  const ready = c < 0.85 ? Math.min(1, c * 5) : Math.max(0, 1 - (c - 0.85) * 7);
  const tension = c < 0.72 ? Math.max(0, Math.min(1, (c - 0.18) / 0.45)) : 0;
  return archerBody(-0.3 - index * 0.05, tension, ready);
};

const keepView = (label: string, towers: number, damage: KeepDamage, bowmen: boolean): DesignView => ({
  label,
  // Tall: the main tower with a bowman on top is over three figures high; the bastion makes it wider.
  scale: 0.23,
  offsetX: towers >= 4 ? -55 : 0,
  behind: (g, timeMs) => {
    g.clear();
    if (!bowmen) {
      return;
    }
    for (let index = 0; index < towers; index += 1) {
      const spot = keepHideSpot(index, towers);
      const x = (spot.x - KEEP_BASE.x) * KEEP_TO_FIGURE;
      const feet = DESIGN_GROUND_Y - (KEEP_BASE.y - spot.y) * KEEP_TO_FIGURE;
      drawHumanoid(g, shifted(aimingBody(timeMs, index), x, feet - FEET_BELOW_HIP), BOWMEN[index](timeMs));
    }
  },
  draw: (g) => {
    drawKeep(g, { tones: keepTones(MEADOW_HILLS), enemy: false, damage, towers });
    g.scale.set(KEEP_TO_FIGURE);
    g.position.set(-KEEP_BASE.x * KEEP_TO_FIGURE, DESIGN_GROUND_Y - KEEP_BASE.y * KEEP_TO_FIGURE);
  },
});

const keepEntry = (towers: number, id: string, name: string, tagline: string, description: string): DesignEntry => ({
  id,
  name,
  tagline,
  description,
  views: [
    keepView(towers > 1 ? 'The bowmen in their towers' : 'The bowman in his tower', towers, 0, true),
    keepView('Cracked', towers, 1, false),
    keepView('Broken: merlons off, banners torn', towers, 2, false),
    keepView('Burning (fire animated in the game)', towers, 3, false),
  ],
});

export const KEEP_ENTRIES: DesignEntry[] = [
  keepEntry(1, 'keep-1', 'Keep', 'One bowman', 'The keep alone: a tall tower on a gatehouse between two walls, on a plinth. The bowman hides at the top of the tower, head and shoulders above the merlons.'),
  keepEntry(2, 'keep-2', 'Keep with two towers', 'Co-op for two', 'In place of the right wall a second, lower tower for player 2 (the keep warden), its banner on the tower.'),
  keepEntry(3, 'keep-3', 'Keep with three towers', 'Co-op for three', 'A third tower in place of the left wall for player 3 (the steppe archer), lower again than the second, so the three heads never line up.'),
  keepEntry(4, 'keep-4', 'Keep with four towers', 'Co-op for four', 'For player 4 (the huntsman) a squat bastion outside the right wall, on a longer plinth: the lowest tower and the nearest to the enemy, so its bowman sees the field first and is the first in reach.'),
];
