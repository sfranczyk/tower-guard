import type { Graphics } from 'pixi.js';
import type { Vec2 as Point } from '../types';
import { drawBow, getArcherRig, toArcherLocalAngle } from './archer';
import { RUN_GROUND_Y, runArmSwing, runBounce, runFoot } from './runCycle';
import { ARMOR_COLORS, drawArmor, drawArmoredBow, drawHood, drawPauldron, drawQuiver } from './armor';

/** skeleton = thin white bones (enemies, previews); armored = the player's armored archer look. */
export type StickmanSkin = 'skeleton' | 'armored';

export interface StickmanPose {
  /** 0 = walk cycle, 1 = standing idle. */
  idleBlend?: number;
  /** Draws a club in the front hand (enemies). */
  armed?: boolean;
  /** Forces the full run cycle regardless of runningBlend. */
  running?: boolean;
  /** 0 = walk, 1 = run. */
  runningBlend?: number;
  /** Hip height written to sprite.y (bounce is added on top). Defaults to 430. */
  originY?: number;
  /** 0 = no attack, otherwise radians through the club swing. */
  attackPhase?: number;
  /** Replaces swinging arms with arms holding a bow (drawn too), pivoting at the neck. */
  archerPose?: boolean;
  /** 0 = string at rest, 1 = fully drawn. */
  bowTension?: number;
  /** Aim angle in the sprite's parent space (radians, 0 = right). Lean and facing are compensated. */
  bowAngle?: number;
  /** 1 = facing right, -1 = facing left. Must match the sprite's scale.x sign. */
  facingDirection?: number;
  /**
   * Lean multiplier in [-1, 1]; defaults to the facing sign. Animate it towards the new facing
   * after a turn so the lean swings over smoothly instead of flipping.
   */
  leanDirection?: number;
  skin?: StickmanSkin;
}

/** Knee bend while standing: soft knees pointing slightly forward. */
const IDLE_KNEE_BEND = -0.35;

/** Head circle in stickman sprite space (shared with hitboxes). */
export const STICKMAN_HEAD = { x: 0, y: -52, radius: 10 } as const;

export type StickmanRenderer = (sprite: Graphics, phase: number, pose?: StickmanPose) => void;

/** Redraws a stickman into `sprite` for the given animation phase (radians) and pose. */
export const drawStickman: StickmanRenderer = (sprite, phase, pose = {}) => {
  const {
    idleBlend = 0,
    armed = false,
    running = false,
    runningBlend = running ? 1 : 0,
    originY = 430,
    attackPhase = 0,
    archerPose = false,
    bowTension = 0,
    bowAngle = 0,
    facingDirection = 1,
    leanDirection = Math.sign(facingDirection || 1),
    skin = 'skeleton',
  } = pose;
  const armored = skin === 'armored';
  sprite.clear();
  const motionBlend = running ? 1 : runningBlend;
  const normalizedAttackPhase = ((attackPhase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const attackImpactEnd = Math.PI * 0.38;
  const smoothAttack = (value: number): number => value * value * (3 - 2 * value);
  const strikeProgress = normalizedAttackPhase < attackImpactEnd
    ? smoothAttack(normalizedAttackPhase / attackImpactEnd)
    : 1;
  const recoveryProgress = normalizedAttackPhase >= attackImpactEnd
    ? smoothAttack((normalizedAttackPhase - attackImpactEnd) / (Math.PI * 2 - attackImpactEnd))
    : 0;
  const attackLean = (0.12 - 0.34 * strikeProgress + 0.34 * recoveryProgress) * (1 - idleBlend);
  // Lean forward in the facing direction (a mirrored sprite needs the rotation flipped too).
  sprite.rotation = ((0.06 + 0.04 * motionBlend) * (1 - idleBlend) + attackLean) * leanDirection;
  const walkingBounce = (0.5 + Math.cos(phase * 2) * 0.5) * 1.4 * (1 - motionBlend) * (1 - idleBlend);
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // Run cycle progress for the front (right) leg, shifted so its swing lines up with the walk's swing
  // and walk↔run blends don't pull the legs in opposite directions.
  const runProgress = cycle / (Math.PI * 2) + 0.4;
  const runningBounce = runBounce(runProgress) * motionBlend;
  sprite.y = originY + 5 * motionBlend
    + walkingBounce
    + runningBounce;
  const skeleton = 0xf4f7fb;
  const rear = 0xb7c1d1;
  const hip = { x: 0, y: 0 };
  const shoulder = { x: 0, y: -35 };
  const rightLegIsSwinging = cycle < Math.PI;
  const progress = rightLegIsSwinging ? cycle / Math.PI : (cycle - Math.PI) / Math.PI;
  const easedProgress = progress * progress * (3 - 2 * progress);
  const legSwing = (rightLegIsSwinging ? 1 : -1) * Math.sin(progress * Math.PI);
  const footLift = 20;
  const kneeBendAmount = 0.85;
  // Arm swing angle for the rear arm (it moves with the front leg); the front arm mirrors it.
  const walkArmSwing = legSwing * 0.58;
  const runArm = runArmSwing(runProgress) * 0.9;
  const armSwingAngle = walkArmSwing + (runArm - walkArmSwing) * motionBlend;
  const attackArmOffset = attackPhase === 0
    ? 0
    : (Math.PI - 0.1) + strikeProgress * (-Math.PI - 0.95)
      + recoveryProgress * (Math.PI + 0.95);
  const attackForearmBend = attackPhase === 0
    ? 0.48
    : 1.13 - 0.93 * strikeProgress + 0.93 * recoveryProgress;

  const frontColor = armored ? ARMOR_COLORS.limb : skeleton;
  const rearColor = armored ? ARMOR_COLORS.limbRear : rear;
  // Armored limbs are drawn about 2.3× thicker, without joint rings.
  const widthScale = armored ? 2.3 : 1;
  const line = (a: Point, b: Point, isRear = false, width = 3.5): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
      width: (isRear ? width - 0.5 : width) * widthScale,
      color: isRear ? rearColor : frontColor,
      cap: 'round',
      join: 'round',
    });
  };
  const joint = (point: Point, isRear = false): void => {
    if (!armored) {
      sprite.circle(point.x, point.y, 3).stroke({ width: 1.5, color: isRear ? rear : skeleton });
    }
  };
  const endpoint = (point: Point, isRear = false): void => {
    sprite.circle(point.x, point.y, armored ? 4.5 : 2.5).fill({ color: isRear ? rearColor : frontColor });
  };

  const drawLeg = (foot: Point, kneeBend: number, isRear: boolean): void => {
    const upperLength = 30;
    const lowerLength = 30;
    const dx = foot.x - hip.x;
    const dy = foot.y - hip.y;
    const targetLength = Math.max(1, Math.min(upperLength + lowerLength - 0.01, Math.hypot(dx, dy)));
    const ux = dx / Math.max(1, Math.hypot(dx, dy));
    const uy = dy / Math.max(1, Math.hypot(dx, dy));
    const along = (upperLength ** 2 - lowerLength ** 2 + targetLength ** 2) / (2 * targetLength);
    const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
    const knee = {
      x: hip.x + ux * along - uy * height * kneeBend,
      y: hip.y + uy * along + ux * height * kneeBend,
    };
    line(hip, knee, isRear);
    line(knee, foot, isRear);
    joint(knee, isRear);
    endpoint(foot, isRear);
    const shinLength = Math.hypot(foot.x - knee.x, foot.y - knee.y) || 1;
    const shinDirection = {
      x: (foot.x - knee.x) / shinLength,
      y: (foot.y - knee.y) / shinLength,
    };
    // Feet follow the shin while moving and lie flat on the ground when standing.
    const shinFoot = { x: shinDirection.y, y: -shinDirection.x };
    const flatX = shinFoot.x + (1 - shinFoot.x) * idleBlend;
    const flatY = shinFoot.y * (1 - idleBlend);
    const flatLength = Math.hypot(flatX, flatY) || 1;
    const footDirection = { x: flatX / flatLength, y: flatY / flatLength };
    line(
      { x: foot.x - footDirection.x * 2, y: foot.y - footDirection.y * 2 },
      { x: foot.x + footDirection.x * 9, y: foot.y + footDirection.y * 9 },
      isRear,
      3,
    );
  };

  const drawArm = (angle: number, isRear: boolean, armed = false): Point => {
    const elbow = {
      x: shoulder.x + Math.sin(angle) * 21,
      y: shoulder.y + Math.cos(angle) * 21,
    };
    const forearmAngle = angle + (armed ? attackForearmBend : 0.2 + (Math.PI / 2 - 0.2) * motionBlend);
    const hand = {
      x: elbow.x + Math.sin(forearmAngle) * 21,
      y: elbow.y + Math.cos(forearmAngle) * 21,
    };
    line(shoulder, elbow, isRear);
    line(elbow, hand, isRear);
    joint(elbow, isRear);
    endpoint(hand, isRear);
    return hand;
  };
  const drawArcherArm = (elbow: Point, hand: Point, isRear: boolean): Point => {
    line(shoulder, elbow, isRear);
    line(elbow, hand, isRear);
    joint(elbow, isRear);
    endpoint(hand, isRear);
    return hand;
  };

  const walkSwingFoot = {
    x: -22 + easedProgress * 22 * 2,
    y: 55 - Math.sin(progress * Math.PI) * footLift,
  };
  const walkStanceFoot = {
    x: 22 - easedProgress * 22 * 2,
    y: 55,
  };
  const runnerFootAt = (progressOfLeg: number): Point => {
    const foot = runFoot(progressOfLeg);
    return { x: foot.x, y: RUN_GROUND_Y - runBounce(runProgress) - foot.lift };
  };
  const blendMotionPoint = (walking: Point, runningPoint: Point): Point => ({
    x: walking.x + (runningPoint.x - walking.x) * motionBlend,
    y: walking.y + (runningPoint.y - walking.y) * motionBlend,
  });
  const rightFoot = blendMotionPoint(rightLegIsSwinging ? walkSwingFoot : walkStanceFoot, runnerFootAt(runProgress));
  const leftFoot = blendMotionPoint(rightLegIsSwinging ? walkStanceFoot : walkSwingFoot, runnerFootAt(runProgress + 0.5));
  // Running legs use the exact two-bone solution with the knee in front (bend −1).
  const runnerKneeBend = -1;
  const swingKneeBend = 0.2 - Math.sin(progress * Math.PI) * kneeBendAmount;
  const idleLeftFoot = { x: -16, y: 55 };
  const idleRightFoot = { x: 16, y: 55 };
  const blendPoint = (walking: Point, standing: Point): Point => ({
    x: walking.x + (standing.x - walking.x) * idleBlend,
    y: walking.y + (standing.y - walking.y) * idleBlend,
  });
  const walkingLeftKneeBend = rightLegIsSwinging ? 0.2 : swingKneeBend;
  const walkingRightKneeBend = rightLegIsSwinging ? swingKneeBend : 0.2;
  const movingLeftKneeBend = walkingLeftKneeBend + (runnerKneeBend - walkingLeftKneeBend) * motionBlend;
  const movingRightKneeBend = walkingRightKneeBend + (runnerKneeBend - walkingRightKneeBend) * motionBlend;
  // Standing uses its own symmetric, slightly forward knee bend instead of whatever walk phase the
  // character stopped in (positive bends push the knee backwards).
  const leftKneeBend = movingLeftKneeBend + (IDLE_KNEE_BEND - movingLeftKneeBend) * idleBlend;
  const rightKneeBend = movingRightKneeBend + (IDLE_KNEE_BEND - movingRightKneeBend) * idleBlend;

  drawLeg(blendPoint(leftFoot, idleLeftFoot), leftKneeBend, true);
  // Rear gray arm follows the front white leg; the front white arm follows the rear gray leg.
  const archerRig = archerPose
    ? getArcherRig(toArcherLocalAngle(bowAngle, sprite.rotation, facingDirection), bowTension)
    : undefined;
  // Archer: the rear (lower-layer) arm holds the bow, the front arm draws the string so the
  // drawing hand stays visible in front of the face.
  if (archerRig) {
    drawArcherArm(archerRig.woodElbow, archerRig.woodHand, true);
    if (!armored) {
      drawArcherArm(archerRig.stringElbow, archerRig.stringHand, false);
    }
  } else {
    const rearArmAngle = armSwingAngle * (1 - idleBlend) + 0.1 * idleBlend;
    drawArm(rearArmAngle, true);
  }
  if (armored) {
    // Back to front: quiver, torso, front leg, armor over the legs, hood, drawing arm, shoulder plate.
    drawQuiver(sprite);
    line(hip, shoulder);
    drawLeg(blendPoint(rightFoot, idleRightFoot), rightKneeBend, false);
    drawArmor(sprite);
    drawHood(sprite, STICKMAN_HEAD);
    if (archerRig) {
      drawArcherArm(archerRig.stringElbow, archerRig.stringHand, false);
    }
    drawPauldron(sprite, shoulder);
  } else {
    line(hip, shoulder);
    joint(hip);
    line(shoulder, { x: 0, y: -43 });
    sprite.circle(STICKMAN_HEAD.x, STICKMAN_HEAD.y, STICKMAN_HEAD.radius).stroke({ width: 2, color: skeleton });
    drawLeg(blendPoint(rightFoot, idleRightFoot), rightKneeBend, false);
  }
  const frontArmAngle = -armSwingAngle * (1 - idleBlend) + 0.1 * idleBlend + attackArmOffset;
  const weaponHand = archerPose
    ? { x: 0, y: 0 }
    : drawArm(frontArmAngle, false, armed);
  if (armed) {
    const forearmAngle = frontArmAngle + attackForearmBend;
    const weaponDirection = { x: Math.cos(forearmAngle), y: -Math.sin(forearmAngle) };
    sprite.moveTo(
      weaponHand.x - weaponDirection.x * 8,
      weaponHand.y - weaponDirection.y * 8,
    )
      .lineTo(
        weaponHand.x + weaponDirection.x * 28,
        weaponHand.y + weaponDirection.y * 28,
      )
      .stroke({ width: 5, color: 0x30243a, cap: 'round' });
    sprite.moveTo(
      weaponHand.x - weaponDirection.x * 8,
      weaponHand.y - weaponDirection.y * 8,
    )
      .lineTo(
        weaponHand.x + weaponDirection.x * 28,
        weaponHand.y + weaponDirection.y * 28,
      )
      .stroke({ width: 2.5, color: 0xe3ad4f, cap: 'round' });
  }
  if (archerRig) {
    if (armored) {
      drawArmoredBow(sprite, archerRig, bowTension);
    } else {
      drawBow(sprite, archerRig);
    }
  }
};
