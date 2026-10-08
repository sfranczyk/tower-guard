import { THROW_GRAVITY } from '../config';

/**
 * A body thrown through the air (pure, tested): falls under THROW_GRAVITY, tumbles while it rises and, coming
 * down, turns to land on its back in the direction it flies (`landingRotation`), so it lands into the
 * knockback's lying pose.
 */
export interface Flight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Body rotation (radians) and how fast it tumbles while rising (radians/s). */
  rotation: number;
  spin: number;
  timeMs: number;
}

/** How quickly the body turns to its landing angle on the way down (per second). */
const SETTLE_RATE = 6;
/** Lying on its back along the way it flies: the knockback pose's torso as the sprite's rotation. */
const LYING = 1.5;

/** The rotation a body flying with `vx` lands at (its head towards where it's going). */
export const landingRotation = (vx: number): number => LYING * Math.sign(vx || 1);

/** `angle` moved to within π of `target` (whole turns removed). */
const nearest = (angle: number, target: number): number => target + ((((angle - target) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

/**
 * One step of the flight (x clamped to `minX`..`maxX`); `landed` once it reaches `groundAt(x)` on the way down,
 * with the speed it hit the ground at.
 */
export const stepFlight = (
  flight: Readonly<Flight>, deltaMs: number, groundAt: (x: number) => number, minX: number, maxX: number,
): { flight: Flight; landed: boolean; impactSpeed: number } => {
  const dt = deltaMs / 1000;
  const vy = flight.vy + THROW_GRAVITY * dt;
  const x = Math.max(minX, Math.min(maxX, flight.x + flight.vx * dt));
  const y = flight.y + vy * dt;
  const target = landingRotation(flight.vx);
  const rotation = vy < 0
    ? flight.rotation + flight.spin * dt
    : target + (nearest(flight.rotation, target) - target) * Math.exp(-SETTLE_RATE * dt);
  const ground = groundAt(x);
  if (vy > 0 && y >= ground) {
    return { flight: { ...flight, x, y: ground, vy: 0, rotation: target, timeMs: flight.timeMs + deltaMs }, landed: true, impactSpeed: vy };
  }
  return { flight: { ...flight, x, y, vy, rotation, timeMs: flight.timeMs + deltaMs }, landed: false, impactSpeed: 0 };
};
