import type { Graphics } from 'pixi.js';
import type { Vec2 as Point } from '../types';

export interface StickmanPose {
  /** 0 = walk cycle, 1 = standing idle. */
  idleBlend?: number;
  /** Draws a club in the front hand (enemies). */
  armed?: boolean;
  /** Forces the full run cycle regardless of runningBlend. */
  running?: boolean;
  /** 0 = walk, 1 = run. */
  runningBlend?: number;
  /** Baseline written to sprite.y (bounce is added on top). */
  originY?: number;
  /** 0 = no attack, otherwise radians through the club swing. */
  attackPhase?: number;
  /** Replaces swinging arms with arms holding a bow. */
  archerPose?: boolean;
  bowTension?: number;
  bowAngle?: number;
  facingDirection?: number;
}

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
  } = pose;
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
  sprite.rotation = (0.06 + 0.04 * motionBlend) * (1 - idleBlend) + attackLean;
  const walkingBounce = (0.5 + Math.cos(phase * 2) * 0.5) * 1.4 * (1 - motionBlend) * (1 - idleBlend);
  const runningBounce = (0.5 - Math.cos(phase * 2) * 0.5) * 2.4 * motionBlend;
  sprite.y = originY + 5 * motionBlend
    + walkingBounce
    + runningBounce;
  const skeleton = 0xf4f7fb;
  const rear = 0xb7c1d1;
  const hip = { x: 0, y: 0 };
  const shoulder = { x: 0, y: -35 };
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const rightLegIsSwinging = cycle < Math.PI;
  const progress = rightLegIsSwinging ? cycle / Math.PI : (cycle - Math.PI) / Math.PI;
  const easedProgress = progress * progress * (3 - 2 * progress);
  const legSwing = (rightLegIsSwinging ? 1 : -1) * Math.sin(progress * Math.PI);
  const footLift = 20 + (32 - 20) * motionBlend;
  const kneeBendAmount = 0.85 + (1.15 - 0.85) * motionBlend;
  const armSwing = 0.58 + (1.0 - 0.58) * motionBlend;
  const attackArmOffset = attackPhase === 0
    ? 0
    : (Math.PI - 0.1) + strikeProgress * (-Math.PI - 0.95)
      + recoveryProgress * (Math.PI + 0.95);
  const attackForearmBend = attackPhase === 0
    ? 0.48
    : 1.13 - 0.93 * strikeProgress + 0.93 * recoveryProgress;

  const line = (a: Point, b: Point, isRear = false, width = 3.5): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
      width: isRear ? width - 0.5 : width,
      color: isRear ? rear : skeleton,
      cap: 'round',
      join: 'round',
    });
  };
  const joint = (point: Point, isRear = false): void => {
    sprite.circle(point.x, point.y, 3).stroke({ width: 1.5, color: isRear ? rear : skeleton });
  };
  const endpoint = (point: Point, isRear = false): void => {
    sprite.circle(point.x, point.y, 2.5).fill({ color: isRear ? rear : skeleton });
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
    const footDirection = { x: shinDirection.y, y: -shinDirection.x };
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
  const rotateFromBodyCenter = (offset: Point): Point => ({
    x: offset.x * Math.cos(bowAngle) - offset.y * Math.sin(bowAngle),
    y: offset.x * Math.sin(bowAngle) + offset.y * Math.cos(bowAngle),
  });
  const mirrorForFacing = (point: Point): Point => ({
    x: point.x * facingDirection,
    y: point.y,
  });

  const runnerFoot = (x: number): Point => ({
    x,
    y: Math.sqrt(Math.max(0, 58 ** 2 - x ** 2)),
  });
  const walkSwingFoot = {
    x: -22 + easedProgress * 22 * 2,
    y: 55 - Math.sin(progress * Math.PI) * footLift,
  };
  const walkStanceFoot = {
    x: 22 - easedProgress * 22 * 2,
    y: 55,
  };
  const runnerSwingFoot = runnerFoot(-55 * Math.cos(progress * Math.PI));
  const runnerStanceFoot = runnerFoot(55 * Math.cos(progress * Math.PI));
  runnerSwingFoot.y -= 8;
  runnerStanceFoot.y -= 8;
  const blendMotionPoint = (walking: Point, runningPoint: Point): Point => ({
    x: walking.x + (runningPoint.x - walking.x) * motionBlend,
    y: walking.y + (runningPoint.y - walking.y) * motionBlend,
  });
  const swingFoot = blendMotionPoint(walkSwingFoot, runnerSwingFoot);
  const stanceFoot = blendMotionPoint(walkStanceFoot, runnerStanceFoot);
  const rightFoot = rightLegIsSwinging ? swingFoot : stanceFoot;
  const leftFoot = rightLegIsSwinging ? stanceFoot : swingFoot;
  const smoothStep = (value: number): number => value * value * value * (value * (value * 6 - 15) + 10);
  const bendTransition = Math.min(1, progress / 0.35);
  const runnerForwardKneeBend = -smoothStep(bendTransition);
  const runnerReturnKneeBend = -1 + smoothStep(bendTransition);
  const swingKneeBend = 0.2 - Math.sin(progress * Math.PI) * kneeBendAmount;
  const idleLeftFoot = { x: -16, y: 55 };
  const idleRightFoot = { x: 16, y: 55 };
  const blendPoint = (walking: Point, standing: Point): Point => ({
    x: walking.x + (standing.x - walking.x) * idleBlend,
    y: walking.y + (standing.y - walking.y) * idleBlend,
  });
  const walkingLeftKneeBend = rightLegIsSwinging ? 0.2 : swingKneeBend;
  const walkingRightKneeBend = rightLegIsSwinging ? swingKneeBend : 0.2;
  const runningLeftKneeBend = rightLegIsSwinging ? runnerReturnKneeBend : runnerForwardKneeBend;
  const runningRightKneeBend = rightLegIsSwinging ? runnerForwardKneeBend : runnerReturnKneeBend;
  const leftKneeBend = walkingLeftKneeBend
    + (runningLeftKneeBend - walkingLeftKneeBend) * motionBlend;
  const rightKneeBend = walkingRightKneeBend
    + (runningRightKneeBend - walkingRightKneeBend) * motionBlend;

  drawLeg(blendPoint(leftFoot, idleLeftFoot), leftKneeBend, true);
  // Rear gray arm follows the front white leg; the front white arm follows the rear gray leg.
  if (archerPose) {
    const stringHandX = -21 - bowTension * 35;
    const woodHand = rotateFromBodyCenter({ x: 56, y: -43 });
    const woodElbow = rotateFromBodyCenter({ x: 28, y: -39 });
    const stringHand = rotateFromBodyCenter({ x: 56 + stringHandX, y: -43 });
    const stringElbow = rotateFromBodyCenter({
      x: 28 + stringHandX * 0.5 - bowTension * 20,
      y: -39 + bowTension * 9,
    });
    drawArcherArm(
      mirrorForFacing(stringElbow),
      mirrorForFacing(stringHand),
      true,
    );
    drawArcherArm(mirrorForFacing(woodElbow), mirrorForFacing(woodHand), false);
  } else {
    const rearArmAngle = legSwing * armSwing * (1 - idleBlend) + 0.1 * idleBlend;
    drawArm(rearArmAngle, true);
  }
  line(hip, shoulder);
  joint(hip);
  line(shoulder, { x: 0, y: -43 });
  sprite.circle(0, -52, 10).stroke({ width: 2, color: skeleton });
  drawLeg(blendPoint(rightFoot, idleRightFoot), rightKneeBend, false);
  const frontArmAngle = -legSwing * armSwing * (1 - idleBlend) + 0.1 * idleBlend + attackArmOffset;
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
};

/** Standing archer with a bow that cycles its draw tension (animation lab preview). */
export const drawTensionArcher = (sprite: Graphics, phase: number): void => {
  const tension = 0.25 + (Math.sin(phase) + 1) * 0.375;
  drawStickman(sprite, 0, { idleBlend: 1, archerPose: true, bowTension: tension });
  const bowX = 35;
  const stringX = 56 * (1 - tension);
  const stringY = -43 + tension * 8;
  sprite.moveTo(bowX, -94).quadraticCurveTo(bowX + 42 + tension * 12, -43, bowX, 8).stroke({
    width: 3.5,
    color: 0xe3ad4f,
    cap: 'round',
  });
  sprite.moveTo(bowX, -94).lineTo(stringX, stringY).lineTo(bowX, 8).stroke({
    width: 1.5,
    color: 0xf6e2a4,
    cap: 'round',
  });
};
