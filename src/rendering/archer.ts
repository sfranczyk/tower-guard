import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';

/**
 * Archer geometry in stickman sprite space. Everything rotates around the neck, so the bow, both
 * hands and the nocked arrow always lie on the aim ray that starts at the neck.
 *
 * "Aim frame": x points along the aim direction, y is perpendicular (positive = below the ray).
 */
export const ARCHER_NECK: Vec2 = { x: 0, y: -43 };

/** Distance from the neck to the bow grip (front hand). */
const GRIP_DISTANCE = 56;
/** Where the string rests (and the string hand sits) at zero tension. */
const STRING_REST_X = 35;
/** How far the string hand travels back at full tension. */
const STRING_PULL = 35;
const LIMB_HALF_HEIGHT = 51;

export interface ArcherRig {
  woodHand: Vec2;
  woodElbow: Vec2;
  stringHand: Vec2;
  stringElbow: Vec2;
  /** Middle of the string: the arrow nock / release point. Equals stringHand once the bow is ready. */
  stringNock: Vec2;
  bowTop: Vec2;
  bowBottom: Vec2;
  /** Quadratic control point of the bow limb curve. */
  bowControl: Vec2;
}

/** The free (string) arm while the bow is lowered, e.g. a normal walking arm swing. */
export interface FreeArm {
  elbow: Vec2;
  hand: Vec2;
}

/**
 * Lowered bow ("low ready"): bow arm hanging forward with the bow pointing at the ground ahead.
 * Sprite space, facing +x.
 */
const LOWERED_GRIP: Vec2 = { x: 24, y: -4 };
const LOWERED_ELBOW: Vec2 = { x: 12, y: -21 };
/** Aim-direction angle of the lowered bow (radians, positive = pointing down). */
const LOWERED_ANGLE = 0.5;
const DEFAULT_FREE_ARM: FreeArm = { elbow: { x: 2, y: -14 }, hand: { x: 8, y: 6 } };

const lerp = (a: number, b: number, amount: number): number => a + (b - a) * amount;
const lerpPoint = (a: Vec2, b: Vec2, amount: number): Vec2 => ({ x: lerp(a.x, b.x, amount), y: lerp(a.y, b.y, amount) });
/** Interpolates angles along the shorter way round. */
const lerpAngle = (a: number, b: number, amount: number): number => {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * amount;
};
const smooth = (value: number): number => value * value * (3 - 2 * value);

/**
 * Converts an aim angle in the sprite's parent space into the sprite's local space, undoing the
 * sprite's own rotation (body lean) and horizontal mirroring (facing). Pixi applies scale, then
 * rotation, so local = S⁻¹ · R(−rotation) · world.
 */
export const toArcherLocalAngle = (aimAngle: number, spriteRotation: number, facingDirection: number): number => {
  const relative = aimAngle - spriteRotation;
  return Math.atan2(Math.sin(relative), Math.sign(facingDirection || 1) * Math.cos(relative));
};

/**
 * Bow and arm positions in sprite space.
 * @param localAngle aim angle in sprite space (see toArcherLocalAngle)
 * @param tension draw tension 0..1; only takes effect as the bow comes up to ready
 * @param ready 0 = bow lowered, 1 = bow raised to aim; values in between blend smoothly
 * @param freeArm where the string arm is while the bow is lowered (defaults to a hanging arm)
 */
export const getArcherRig = (localAngle: number, tension: number, ready = 1, freeArm: FreeArm = DEFAULT_FREE_ARM): ArcherRig => {
  const r = Math.max(0, Math.min(1, ready));
  const eased = smooth(r);
  // The string can only be drawn once the bow is up.
  const t = Math.max(0, Math.min(1, tension)) * eased;

  // Bow grip and orientation move from the lowered pose to the aim pose.
  const readyGrip = {
    x: ARCHER_NECK.x + Math.cos(localAngle) * GRIP_DISTANCE,
    y: ARCHER_NECK.y + Math.sin(localAngle) * GRIP_DISTANCE,
  };
  const grip = lerpPoint(LOWERED_GRIP, readyGrip, eased);
  const angle = lerpAngle(LOWERED_ANGLE, localAngle, eased);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  /** Bow frame: x along the aim from the grip, y perpendicular. */
  const fromBowFrame = (x: number, y: number): Vec2 => ({
    x: grip.x + x * cos - y * sin,
    y: grip.y + x * sin + y * cos,
  });
  const fromAimFrame = (x: number, y: number): Vec2 => ({
    x: ARCHER_NECK.x + x * Math.cos(localAngle) - y * Math.sin(localAngle),
    y: ARCHER_NECK.y + x * Math.sin(localAngle) + y * Math.cos(localAngle),
  });

  // As the bow is drawn its tips bend back towards the archer, keeping the grip in place.
  const tipX = STRING_REST_X - 12 * t - GRIP_DISTANCE;
  const tipY = LIMB_HALF_HEIGHT - 6 * t;
  const stringNock = fromBowFrame(STRING_REST_X - STRING_PULL * t - GRIP_DISTANCE, 0);

  return {
    woodHand: grip,
    woodElbow: lerpPoint(LOWERED_ELBOW, fromAimFrame(28, 4), eased),
    stringHand: lerpPoint(freeArm.hand, stringNock, eased),
    stringElbow: lerpPoint(freeArm.elbow, fromAimFrame(17.5 - 37.5 * t, 4 + 9 * t), eased),
    stringNock,
    bowTop: fromBowFrame(tipX, -tipY),
    bowBottom: fromBowFrame(tipX, tipY),
    // Control point chosen so the curve's midpoint lands exactly on the grip.
    bowControl: fromBowFrame(-tipX, 0),
  };
};

/** Draws the bow limbs and the string pulled to the nock. */
export const drawBow = (sprite: Graphics, rig: ArcherRig): void => {
  const { bowTop, bowBottom, bowControl, stringNock } = rig;
  const limb = (width: number, color: number): void => {
    sprite.moveTo(bowTop.x, bowTop.y)
      .quadraticCurveTo(bowControl.x, bowControl.y, bowBottom.x, bowBottom.y)
      .stroke({ width, color, cap: 'round', join: 'round' });
  };
  limb(5, 0x30243a);
  limb(3, 0xe3ad4f);
  sprite.moveTo(bowTop.x, bowTop.y)
    .lineTo(stringNock.x, stringNock.y)
    .lineTo(bowBottom.x, bowBottom.y)
    .stroke({ width: 1.5, color: 0xf6e2a4, cap: 'round', join: 'round' });
};
