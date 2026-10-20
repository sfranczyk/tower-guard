import type { Graphics } from 'pixi.js';
import { MARCH_STRIDE_PER_RADIAN, WALK_STRIDE_PER_RADIAN, drawStickman, type StickmanPose } from '../stickman';
import type { WalkStyle } from '../walkCycle';
import { getCheerPose, type CheerKind } from '../stickmanCheer';
import { FALL_DURATION_MS, getFallPose, type FallKind } from '../stickmanFall';
import { getPinnedPose } from '../stickmanPinned';
import type { JointPose } from '../stickmanPose';
import { RUN_STRIDE_PER_RADIAN } from '../runCycle';
import type { AttackStyle } from '../attackSwing';
import { archerBody, attackBody, runBody, walkBody, withClub, type BodyPose } from './bodyPoses';
import { drawMountedKnight } from './warhorse';
import { HORSE_DEATH_MS, getHorseDeath, type HorseDeathKind } from '../horseDeath';
import { type HorsePose } from '../horseRider';
import { drawHumanoid, type HumanoidLook } from './skinKit';
import { drawEnemyGibs } from '../enemyBody';
import { GibSimulation } from '../stickmanGibs';
import type { UnitType } from '../../types';

/** The design lab's building blocks: tile types and the looping views every entry is made of (catalog.ts). */

/** One animation of a design: a tile in the zoomed view. */
export interface DesignView {
  label: string;
  draw: (g: Graphics, timeMs: number) => void;
  /** Ground scroll (px/ms) for moving animations. */
  speed?: number;
  /** Framing: scale on top of the tile's fit, and a shift right (figure units). */
  scale?: number;
  offsetX?: number;
}

export interface DesignEntry {
  /** Stable id used in the URL (?designs=<id>). */
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** The first is the card's; the zoomed view shows them all. */
  views: DesignView[];
  /** Dragons: no ground, framed to the dragon's size. */
  flying?: boolean;
  /** Shifts every view right (figure units) unless the view sets its own. */
  offsetX?: number;
}

export interface DesignSection {
  id: string;
  tab: string;
  intro: string;
  entries: DesignEntry[];
}

export type LookAt = (timeMs: number) => HumanoidLook;

/** Ground covered per walk and march cycle (two steps): see walkBody. One run cycle covers 115 px. */
export const WALK_CYCLE_PX = WALK_STRIDE_PER_RADIAN * Math.PI * 2;
export const MARCH_CYCLE_PX = MARCH_STRIDE_PER_RADIAN * Math.PI * 2;
export const RUN_CYCLE_PX = RUN_STRIDE_PER_RADIAN * Math.PI * 2;
export const SWING_MS = 1300;
export const SWING_PAUSE_MS = 600;
export const FALL_HOLD_MS = 1300;

export const posed = (label: string, look: LookAt, pose: (timeMs: number) => BodyPose, speed?: number): DesignView => ({
  label,
  speed,
  draw: (g, timeMs) => {
    g.clear();
    drawHumanoid(g, pose(timeMs), look(timeMs));
  },
});

/** Walking (the zombie shuffles and the knights march, both on the march's longer stride). */
export const walking = (look: LookAt, speed: number, club?: AttackStyle, zombie = false, style: WalkStyle = 'walk'): DesignView => {
  const cycle = zombie || style === 'march' ? MARCH_CYCLE_PX : WALK_CYCLE_PX;
  return posed(zombie ? 'Shuffle' : style === 'march' ? 'March' : 'Walk', look, (t) => walkBody((t * speed) / cycle, { club, zombie, style }), speed);
};
export const running = (look: LookAt, speed: number, club?: AttackStyle): DesignView =>
  posed('Run', look, (t) => runBody((t * speed) / RUN_CYCLE_PX, club), speed);
export const swinging = (label: string, look: LookAt, style: AttackStyle): DesignView =>
  posed(label, look, (t) => attackBody(Math.min(1, (t % (SWING_MS + SWING_PAUSE_MS)) / SWING_MS), style));

/** A fall played, held a moment, and played again. */
export const fallProgress = (kind: FallKind, timeMs: number): number =>
  Math.min(1, (timeMs % (FALL_DURATION_MS[kind] + FALL_HOLD_MS)) / FALL_DURATION_MS[kind]);
/** Knocked down, a moment on the ground, back on his feet. */
export const knockdownPose = (timeMs: number, lieMs = 500): JointPose => {
  const down = FALL_DURATION_MS.knockback;
  const up = FALL_DURATION_MS.getUp;
  const t = timeMs % (down + lieMs + up + FALL_HOLD_MS);
  return t < down + lieMs ? getFallPose('knockback', Math.min(1, t / down)) : getFallPose('getUp', Math.min(1, (t - down - lieMs) / up));
};
export const falling = (label: string, look: LookAt, kind: FallKind): DesignView => posed(label, look, (t) => getFallPose(kind, fallProgress(kind, t)));
export const knockdown = (look: LookAt): DesignView => posed('Knocked down, gets up', look, (t) => knockdownPose(t));
export const cheering = (look: LookAt, kind: CheerKind, club?: boolean): DesignView =>
  posed('Cheers', look, (t) => {
    const pose: BodyPose = getCheerPose(kind, t);
    return club ? withClub(pose) : pose;
  });
export const pinned = (look: LookAt): DesignView => posed('Pinned by the foot', look, (t) => getPinnedPose(t));

/** Blown apart by a direct explosive hit (the game's gib simulation, drawn in the enemy's look), on a loop. */
export const GIB_LOOP_MS = 2800;
export const blownApart = (kind: UnitType): DesignView => ({
  label: 'Blown apart',
  // The pieces fly far back from a blast at the chest: framed smaller and shifted.
  scale: 0.55,
  offsetX: 130,
  draw: (g, t) => {
    const simulation = new GibSimulation({ x: 16, y: -20 }, 1 + Math.floor(t / GIB_LOOP_MS), 1);
    simulation.step(t % GIB_LOOP_MS);
    drawEnemyGibs(g, kind, simulation, 0, t);
  },
});

/** The mounted knight (or its riderless horse) in a horse pose; `speed` scrolls the ground at a gallop. */
export const mounted = (label: string, pose: (timeMs: number) => HorsePose, speed?: number, riderless = false): DesignView => ({
  label,
  speed,
  scale: 0.62,
  offsetX: -22,
  draw: (g, timeMs) => {
    g.clear();
    drawMountedKnight(g, pose(timeMs), timeMs, { riderless });
  },
});

/** The horse killed under the knight (rendering/horseDeath), on a loop; once thrown, the rider is an enemy of his own in the game. */
export const HORSE_DEATH_PAUSE_MS = 1400;
export const horseDeath = (label: string, kind: HorseDeathKind): DesignView => ({
  label,
  scale: 0.5,
  offsetX: -10,
  draw: (g, timeMs) => {
    const { horse, riderThrown } = getHorseDeath(kind, timeMs % (HORSE_DEATH_MS[kind] + HORSE_DEATH_PAUSE_MS));
    g.clear();
    drawMountedKnight(g, horse, timeMs, { riderless: riderThrown });
  },
});

/** Enemy archer: raise the bow, draw, loose, lower; on a loop. */
export const SHOT_MS = 2200;
export const shooting = (look: LookAt): DesignView => posed('Draw and shoot', look, (t) => {
  const c = (t % SHOT_MS) / SHOT_MS;
  const ready = c < 0.88 ? Math.min(1, c * 5) : Math.max(0, 1 - (c - 0.88) * 8);
  const tension = c < 0.78 ? Math.max(0, Math.min(1, (c - 0.2) / 0.55)) : 0;
  return archerBody(-0.12, tension, ready);
});

/** A stickman look, for comparison: drawStickman (the enemies' old look, the player's current one). */
export const now = (pose: (timeMs: number) => StickmanPose & { phase: number; tint?: number }, speed?: number, label = 'Old'): DesignView => ({
  label,
  speed,
  draw: (g, timeMs) => {
    const { phase, tint = 0xffffff, ...rest } = pose(timeMs);
    g.tint = tint;
    drawStickman(g, phase, { originY: 2, ...rest });
  },
});
export const walkPhase = (timeMs: number, speed: number, stride = WALK_STRIDE_PER_RADIAN): number => (timeMs * speed) / stride;
export const runPhase = (timeMs: number, speed: number): number => (timeMs * speed) / RUN_STRIDE_PER_RADIAN;
