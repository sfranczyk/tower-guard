import type { Vec2 } from '../types';

/** Max distance an arrow moves per integration sub-step (keeps fast arrows from tunnelling). */
export const MAX_STEP_DISTANCE = 4;

export interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface FlightParams {
  /** Downward acceleration, px/s². */
  gravity: number;
  /** Quadratic drag coefficient k in a = −k·|v|·v (1/px). Terminal fall speed is √(gravity / k). */
  drag: number;
}

/**
 * Advances a projectile by `dt` seconds with semi-implicit Euler: velocity first (gravity plus
 * quadratic air drag opposing the velocity), then position. Mutates and returns `state`.
 */
export const stepProjectile = (state: ProjectileState, dt: number, { gravity, drag }: FlightParams): ProjectileState => {
  const speed = Math.hypot(state.vx, state.vy);
  state.vx -= drag * speed * state.vx * dt;
  state.vy += (gravity - drag * speed * state.vy) * dt;
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  return state;
};

/** Advances one frame, split into sub-steps of at most MAX_STEP_DISTANCE pixels. */
export const advanceProjectile = (state: ProjectileState, frameSeconds: number, params: FlightParams): ProjectileState => {
  const speed = Math.hypot(state.vx, state.vy);
  const stepCount = Math.max(1, Math.ceil((speed * frameSeconds) / MAX_STEP_DISTANCE));
  const stepSeconds = frameSeconds / stepCount;
  for (let step = 0; step < stepCount; step += 1) {
    stepProjectile(state, stepSeconds, params);
  }
  return state;
};

export interface TrajectoryOptions {
  /** Stop when the projectile reaches this y (e.g. the ground). */
  groundY: number;
  /** Stop when x leaves [minX, maxX]. */
  minX: number;
  maxX: number;
  /** Simulated frame length; matches a 60 fps ticker by default. */
  frameSeconds?: number;
  maxSeconds?: number;
}

/** Predicted positions, one per simulated frame, using the same integrator as the arrows. */
export const simulateTrajectory = (
  start: Vec2,
  velocity: Vec2,
  params: FlightParams,
  { groundY, minX, maxX, frameSeconds = 1 / 60, maxSeconds = 4 }: TrajectoryOptions,
): Vec2[] => {
  const state: ProjectileState = { x: start.x, y: start.y, vx: velocity.x, vy: velocity.y };
  const points: Vec2[] = [];
  for (let time = 0; time < maxSeconds; time += frameSeconds) {
    advanceProjectile(state, frameSeconds, params);
    if (state.y >= groundY) {
      points.push({ x: state.x, y: groundY });
      break;
    }
    if (state.x < minX || state.x > maxX) {
      break;
    }
    points.push({ x: state.x, y: state.y });
  }
  return points;
};

/** Height of the path where it crosses `targetX`, or undefined if it lands/stops before getting there. */
const heightAtX = (start: Vec2, velocity: Vec2, params: FlightParams, targetX: number, groundY: number): number | undefined => {
  const state: ProjectileState = { x: start.x, y: start.y, vx: velocity.x, vy: velocity.y };
  const direction = Math.sign(targetX - start.x) || 1;
  for (let frame = 0; frame < 600; frame += 1) {
    const previous = { x: state.x, y: state.y };
    advanceProjectile(state, 1 / 60, params);
    if ((state.x - targetX) * direction >= 0) {
      const t = (targetX - previous.x) / (state.x - previous.x || 1);
      return previous.y + (state.y - previous.y) * t;
    }
    if (state.y > groundY || Math.abs(state.vx) < 1) {
      return undefined;
    }
  }
  return undefined;
};

/**
 * Launch angle (world radians) that sends a projectile at `speed` through `target`, preferring the
 * flattest arc that gets there. Falls back to the closest miss when the target is out of reach.
 */
export const solveLaunchAngle = (start: Vec2, target: Vec2, speed: number, params: FlightParams, groundY: number): number => {
  const direction = Math.sign(target.x - start.x) || 1;
  let best = { angle: direction > 0 ? 0 : Math.PI, miss: Number.POSITIVE_INFINITY };
  for (let elevation = -0.6; elevation <= 1.3; elevation += 0.01) {
    const velocity = { x: direction * Math.cos(elevation) * speed, y: -Math.sin(elevation) * speed };
    const y = heightAtX(start, velocity, params, target.x, groundY);
    const miss = y === undefined ? Number.POSITIVE_INFINITY : Math.abs(y - target.y);
    // Strictly better only, so the first (flattest) good solution wins.
    if (miss < best.miss - 0.5) {
      best = { angle: Math.atan2(velocity.y, velocity.x), miss };
    }
    if (best.miss < 1) {
      break;
    }
  }
  return best.angle;
};
