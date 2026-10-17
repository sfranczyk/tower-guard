import type { Vec2 } from '../types';

/** Where a stuck arrow is when what it's in blows apart: its centre, heading and drawn length (px). */
export interface ArrowPose {
  position: Vec2;
  rotation: number;
  length: number;
}

/** One piece of a broken arrow: the part of its length it keeps (0 = the nock, 1 = the tip) and how it flies. */
export interface ArrowShard {
  from: number;
  to: number;
  position: Vec2;
  rotation: number;
  velocity: Vec2;
  /** Radians per second. */
  spin: number;
  ageMs: number;
  /** Lying on the ground: it no longer moves, only fades. */
  resting: boolean;
}

export interface ShardTuning {
  /** Where the shaft snaps, as a share of its length (random between). */
  breakMin: number;
  breakMax: number;
  /** Speed away from the blast (px/s, random between) and extra upward kick. */
  speedMin: number;
  speedMax: number;
  lift: number;
  /** Most spin (rad/s, either way). */
  spin: number;
  gravity: number;
  /** Visible this long, the last `fadeMs` of it fading out. */
  lifeMs: number;
  fadeMs: number;
}

/** The arrow snapped in two at a random point, each half thrown away from the blast, spinning. */
export const breakArrow = (arrow: ArrowPose, blast: Vec2, tuning: ShardTuning, random: () => number = Math.random): ArrowShard[] => {
  const cut = tuning.breakMin + (tuning.breakMax - tuning.breakMin) * random();
  const along = { x: Math.cos(arrow.rotation), y: Math.sin(arrow.rotation) };
  return [[0, cut], [cut, 1]].map(([from, to]) => {
    const offset = ((from + to) / 2 - 0.5) * arrow.length;
    const position = { x: arrow.position.x + along.x * offset, y: arrow.position.y + along.y * offset };
    const away = { x: position.x - blast.x, y: position.y - blast.y };
    const distance = Math.hypot(away.x, away.y) || 1;
    const speed = tuning.speedMin + (tuning.speedMax - tuning.speedMin) * random();
    return {
      from, to, position, rotation: arrow.rotation,
      velocity: { x: (away.x / distance) * speed, y: (away.y / distance) * speed - tuning.lift },
      spin: (random() * 2 - 1) * tuning.spin,
      ageMs: 0,
      resting: false,
    };
  });
};

/** Moves a shard on by `deltaMs`: falls, spins, and stops where it hits the ground (`groundY` at its x). */
export const stepShard = (shard: ArrowShard, deltaMs: number, tuning: ShardTuning, groundY: (x: number) => number): void => {
  shard.ageMs += deltaMs;
  if (shard.resting) {
    return;
  }
  const seconds = deltaMs / 1000;
  shard.velocity.y += tuning.gravity * seconds;
  shard.position.x += shard.velocity.x * seconds;
  shard.position.y += shard.velocity.y * seconds;
  shard.rotation += shard.spin * seconds;
  const ground = groundY(shard.position.x);
  if (shard.position.y >= ground) {
    shard.position.y = ground;
    shard.resting = true;
    // Lands lying (nearly) flat.
    shard.rotation = Math.cos(shard.rotation) >= 0 ? 0 : Math.PI;
  }
};

/** 1 while fresh, down to 0 over the last `fadeMs`; a shard at 0 is gone. */
export const shardAlpha = (shard: ArrowShard, tuning: ShardTuning): number =>
  Math.max(0, Math.min(1, (tuning.lifeMs - shard.ageMs) / tuning.fadeMs));
