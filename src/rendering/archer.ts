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
  /** Also the arrow nock / release point. */
  stringHand: Vec2;
  stringElbow: Vec2;
  bowTop: Vec2;
  bowBottom: Vec2;
  /** Quadratic control point of the bow limb curve. */
  bowControl: Vec2;
}

/**
 * Converts an aim angle in the sprite's parent space into the sprite's local space, undoing the
 * sprite's own rotation (body lean) and horizontal mirroring (facing). Pixi applies scale, then
 * rotation, so local = S⁻¹ · R(−rotation) · world.
 */
export const toArcherLocalAngle = (aimAngle: number, spriteRotation: number, facingDirection: number): number => {
  const relative = aimAngle - spriteRotation;
  return Math.atan2(Math.sin(relative), Math.sign(facingDirection || 1) * Math.cos(relative));
};

/** Bow and arm positions in sprite space for a local aim angle and bow tension (0..1). */
export const getArcherRig = (localAngle: number, tension: number): ArcherRig => {
  const t = Math.max(0, Math.min(1, tension));
  const cos = Math.cos(localAngle);
  const sin = Math.sin(localAngle);
  const fromAimFrame = (x: number, y: number): Vec2 => ({
    x: ARCHER_NECK.x + x * cos - y * sin,
    y: ARCHER_NECK.y + x * sin + y * cos,
  });

  // As the bow is drawn its tips bend back towards the archer, keeping the grip in place.
  const tipX = STRING_REST_X - 12 * t;
  const tipY = LIMB_HALF_HEIGHT - 6 * t;
  const stringHandX = STRING_REST_X - STRING_PULL * t;

  return {
    woodHand: fromAimFrame(GRIP_DISTANCE, 0),
    woodElbow: fromAimFrame(28, 4),
    stringHand: fromAimFrame(stringHandX, 0),
    stringElbow: fromAimFrame(17.5 - 37.5 * t, 4 + 9 * t),
    bowTop: fromAimFrame(tipX, -tipY),
    bowBottom: fromAimFrame(tipX, tipY),
    // Control point chosen so the curve's midpoint lands exactly on the grip.
    bowControl: fromAimFrame(2 * GRIP_DISTANCE - tipX, 0),
  };
};

/** Draws the bow limbs and the string pulled to the string hand. */
export const drawBow = (sprite: Graphics, rig: ArcherRig): void => {
  const { bowTop, bowBottom, bowControl, stringHand } = rig;
  const limb = (width: number, color: number): void => {
    sprite.moveTo(bowTop.x, bowTop.y)
      .quadraticCurveTo(bowControl.x, bowControl.y, bowBottom.x, bowBottom.y)
      .stroke({ width, color, cap: 'round', join: 'round' });
  };
  limb(5, 0x30243a);
  limb(3, 0xe3ad4f);
  sprite.moveTo(bowTop.x, bowTop.y)
    .lineTo(stringHand.x, stringHand.y)
    .lineTo(bowBottom.x, bowBottom.y)
    .stroke({ width: 1.5, color: 0xf6e2a4, cap: 'round', join: 'round' });
};
