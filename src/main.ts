import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Texture,
} from 'pixi.js';
import Arrow from './objects/Arrow';
import Enemy from './objects/Enemy';
import Tower, { TOWER_HEIGHT } from './objects/Tower';
import Bowman from './objects/Bowman';
import InputManager, { type AimInput, type Vec2 } from './managers/InputManager';
import { LevelManager } from './managers/LevelManager';
import type { ILevelData, IWave, ProjectileType } from './types';
import towerAsset from './assets/tower.svg';
import arrowAsset from './assets/arrow.svg';
import {
  ARROW_GRAVITY,
  ARROW_BASE_SPEED,
  ARROW_FORCE_SPEED,
  ARROW_SPEED_FACTOR,
  BOWMAN_START_X,
  BOWMAN_Y,
  ENEMY_HEALTH,
  ENEMY_HIT_DAMAGE,
  ENEMY_TOWER_DAMAGE,
  EXPLOSION_DAMAGE,
  EXPLOSION_RADIUS,
  ENEMY_SPEED,
  ENEMY_TOWER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  PLAYER_TOWER_X,
  PIERCING_DAMAGE_MULTIPLIER,
  PROJECTILE_DAMAGE,
  SHOW_HITBOX_DEBUG,
  TOTAL_LEVEL_ENEMIES,
  TOWER_ENTRY_ZONE_HEIGHT,
  TOWER_ENTRY_ZONE_WIDTH,
  TOWER_EXIT_X_OFFSET,
  TOWER_MAX_HEALTH,
  WORLD_WIDTH,
} from './config';

type Mode = 'test' | 'menu' | 'game';

type Cloud = {
  sprite: Graphics;
  speed: number;
  width: number;
};

type BloodParticle = {
  sprite: Graphics;
  velocity: Vec2;
  lifeMs: number;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const makeFrames = (texture: Texture, frameWidth: number, frameHeight: number): Texture[] => {
  const frameCount = Math.max(1, Math.floor(texture.width / frameWidth));
  return Array.from({ length: frameCount }, (_, index) => new Texture({
    source: texture.source,
    frame: new Rectangle(index * frameWidth, 0, frameWidth, frameHeight),
  }));
};

type Point = { x: number; y: number };

type StaticPose = 'neutral' | 'front' | 'rear';

type LabAnimation = {
  sprite: Graphics;
  elapsed: number;
};

const drawStaticStickman = (sprite: Graphics, pose: StaticPose): void => {
  sprite.clear();
  const skeleton = 0xf4f7fb;
  const rear = 0xb7c1d1;
  const line = (a: Point, b: Point, isRear = false): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
      width: isRear ? 3 : 3.5,
      color: isRear ? rear : skeleton,
      cap: 'round',
      join: 'round',
    });
  };
  const joint = (point: Point, isRear = false): void => {
    sprite.circle(point.x, point.y, 3).stroke({
      width: 1.5,
      color: isRear ? rear : skeleton,
    });
  };
  const hip = { x: 0, y: 0 };
   const shoulder = { x: pose === 'neutral' ? 0 : 2, y: -52 };
   const head = { x: pose === 'neutral' ? 0 : 4, y: -68 };
   const frontLeg = pose === 'neutral'
     ? [{ x: 0, y: 30 }, { x: 0, y: 60 }]
     : pose === 'front'
     ? [{ x: 28, y: 24 }, { x: 52, y: 52 }]
     : [{ x: 12, y: 30 }, { x: 18, y: 60 }];
  const rearLeg = pose === 'rear'
    ? [{ x: -28, y: 22 }, { x: -52, y: 52 }]
    : [{ x: -12, y: 30 }, { x: -18, y: 60 }];
  const drawLimb = (root: Point, jointPoint: Point, end: Point, isRear: boolean): void => {
    line(root, jointPoint, isRear);
    line(jointPoint, end, isRear);
    joint(jointPoint, isRear);
  };

   if (pose !== 'neutral') {
     drawLimb(hip, rearLeg[0], rearLeg[1], true);
     drawLimb(shoulder, { x: -18, y: -28 }, { x: -30, y: -4 }, true);
   }
   line(hip, shoulder);
   joint(hip);
  line(shoulder, { x: head.x, y: head.y + 8 });
  sprite.circle(head.x, head.y, 10).stroke({ width: 2, color: skeleton });
  drawLimb(hip, frontLeg[0], frontLeg[1], false);
   drawLimb(
     shoulder,
     pose === 'neutral' ? { x: 0, y: -28 } : { x: 21, y: -30 },
     pose === 'neutral' ? { x: 0, y: -4 } : { x: 34, y: -8 },
     false,
  );
};

type WalkKeyframe = {
  leftLeg: { knee: Point; ankle: Point; foot: { heel: Point; toe: Point } };
  rightLeg: { knee: Point; ankle: Point; foot: { heel: Point; toe: Point } };
  leftArm: { elbow: Point; hand: Point };
  rightArm: { elbow: Point; hand: Point };
};

const WALK_KEYFRAMES: WalkKeyframe[] = [
  { leftLeg: { knee: { x: -8, y: 25 }, ankle: { x: -22, y: 53 }, foot: { heel: { x: -25, y: 58 }, toe: { x: -12, y: 58 } } }, rightLeg: { knee: { x: 13, y: 28 }, ankle: { x: 25, y: 53 }, foot: { heel: { x: 20, y: 58 }, toe: { x: 34, y: 58 } } }, leftArm: { elbow: { x: -12, y: -12 }, hand: { x: -17, y: 8 } }, rightArm: { elbow: { x: 11, y: -12 }, hand: { x: 24, y: 4 } } },
  { leftLeg: { knee: { x: -4, y: 17 }, ankle: { x: 2, y: 47 }, foot: { heel: { x: -3, y: 55 }, toe: { x: 11, y: 55 } } }, rightLeg: { knee: { x: 14, y: 30 }, ankle: { x: 28, y: 53 }, foot: { heel: { x: 23, y: 58 }, toe: { x: 37, y: 58 } } }, leftArm: { elbow: { x: -12, y: -8 }, hand: { x: -18, y: 12 } }, rightArm: { elbow: { x: 12, y: -13 }, hand: { x: 25, y: 4 } } },
  { leftLeg: { knee: { x: -14, y: 27 }, ankle: { x: -32, y: 51 }, foot: { heel: { x: -37, y: 57 }, toe: { x: -24, y: 57 } } }, rightLeg: { knee: { x: 10, y: 21 }, ankle: { x: 28, y: 51 }, foot: { heel: { x: 24, y: 57 }, toe: { x: 39, y: 57 } } }, leftArm: { elbow: { x: -12, y: -5 }, hand: { x: -12, y: 15 } }, rightArm: { elbow: { x: 15, y: -10 }, hand: { x: 29, y: 2 } } },
  { leftLeg: { knee: { x: -19, y: 29 }, ankle: { x: -39, y: 51 }, foot: { heel: { x: -44, y: 57 }, toe: { x: -31, y: 57 } } }, rightLeg: { knee: { x: 14, y: 20 }, ankle: { x: 34, y: 51 }, foot: { heel: { x: 30, y: 57 }, toe: { x: 45, y: 57 } } }, leftArm: { elbow: { x: -13, y: -8 }, hand: { x: -18, y: 10 } }, rightArm: { elbow: { x: 16, y: -9 }, hand: { x: 31, y: 2 } } },
  { leftLeg: { knee: { x: -14, y: 25 }, ankle: { x: -32, y: 51 }, foot: { heel: { x: -37, y: 57 }, toe: { x: -24, y: 57 } } }, rightLeg: { knee: { x: 18, y: 17 }, ankle: { x: 39, y: 50 }, foot: { heel: { x: 35, y: 57 }, toe: { x: 50, y: 57 } } }, leftArm: { elbow: { x: -12, y: -12 }, hand: { x: -17, y: 6 } }, rightArm: { elbow: { x: 15, y: -10 }, hand: { x: 29, y: 2 } } },
];

const drawKeyframedWalkingStickman = (sprite: Graphics, phase: number): void => {
  sprite.clear();
  const skeleton = 0xf4f7fb;
  const rear = 0xb7c1d1;
  const smooth = (value: number): number => value * value * (3 - 2 * value);
  const cycle = ((phase % WALK_KEYFRAMES.length) + WALK_KEYFRAMES.length) % WALK_KEYFRAMES.length;
  const frameIndex = Math.floor(cycle);
  const nextIndex = (frameIndex + 1) % WALK_KEYFRAMES.length;
  const amount = smooth(cycle - frameIndex);
  const start = WALK_KEYFRAMES[frameIndex];
  const end = WALK_KEYFRAMES[nextIndex];
  const interpolate = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
  });
  const frame = {
    leftLeg: {
      knee: interpolate(start.leftLeg.knee, end.leftLeg.knee),
      ankle: interpolate(start.leftLeg.ankle, end.leftLeg.ankle),
      foot: {
        heel: interpolate(start.leftLeg.foot.heel, end.leftLeg.foot.heel),
        toe: interpolate(start.leftLeg.foot.toe, end.leftLeg.foot.toe),
      },
    },
    rightLeg: {
      knee: interpolate(start.rightLeg.knee, end.rightLeg.knee),
      ankle: interpolate(start.rightLeg.ankle, end.rightLeg.ankle),
      foot: {
        heel: interpolate(start.rightLeg.foot.heel, end.rightLeg.foot.heel),
        toe: interpolate(start.rightLeg.foot.toe, end.rightLeg.foot.toe),
      },
    },
    leftArm: { elbow: interpolate(start.leftArm.elbow, end.leftArm.elbow), hand: interpolate(start.leftArm.hand, end.leftArm.hand) },
    rightArm: { elbow: interpolate(start.rightArm.elbow, end.rightArm.elbow), hand: interpolate(start.rightArm.hand, end.rightArm.hand) },
  };
  const hip = { x: 0, y: 0 };
  const shoulder = { x: 0, y: -35 };
  const line = (a: Point, b: Point, isRear = false): void => {
    sprite.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
      width: isRear ? 3 : 3.5,
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
  const drawFoot = (foot: { heel: Point; toe: Point }, isRear: boolean): void => {
    line(foot.heel, foot.toe, isRear);
    endpoint(foot.heel, isRear);
    endpoint(foot.toe, isRear);
  };
  const drawLimb = (root: Point, jointPoint: Point, ankle: Point, foot: { heel: Point; toe: Point }, isRear: boolean): void => {
    line(root, jointPoint, isRear);
    line(jointPoint, ankle, isRear);
    joint(jointPoint, isRear);
    joint(ankle, isRear);
    drawFoot(foot, isRear);
  };
  const drawArm = (root: Point, elbow: Point, hand: Point, isRear: boolean): void => {
    line(root, elbow, isRear);
    line(elbow, hand, isRear);
    joint(elbow, isRear);
    endpoint(hand, isRear);
  };

  // Left limbs are the rear pair; draw them before the stable torso and front pair.
  drawLimb(hip, frame.leftLeg.knee, frame.leftLeg.ankle, frame.leftLeg.foot, true);
  drawArm(shoulder, frame.leftArm.elbow, frame.leftArm.hand, true);
  line(hip, shoulder);
  joint(hip);
  line(shoulder, { x: 0, y: -43 });
  sprite.circle(0, -52, 10).stroke({ width: 2, color: skeleton });
  drawLimb(hip, frame.rightLeg.knee, frame.rightLeg.ankle, frame.rightLeg.foot, false);
  drawArm(shoulder, frame.rightArm.elbow, frame.rightArm.hand, false);
};

const drawWalkingStickman = (
  sprite: Graphics,
  phase: number,
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
): void => {
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

const drawStandingArcher = (sprite: Graphics): void => {
  drawWalkingStickman(sprite, 0, 1, false, false, 0, 430, 0, true);
  sprite.moveTo(35, -94).quadraticCurveTo(77, -43, 35, 8).stroke({
    width: 3.5,
    color: 0xe3ad4f,
    cap: 'round',
  });
  sprite.moveTo(35, -94).lineTo(35, 8).stroke({
    width: 1.5,
    color: 0xf6e2a4,
    cap: 'round',
  });
};

const drawTensionArcher = (sprite: Graphics, phase: number): void => {
  const tension = 0.25 + (Math.sin(phase) + 1) * 0.375;
  drawWalkingStickman(sprite, 0, 1, false, false, 0, 430, 0, true, tension);
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

class TowerGuardApp {
  private readonly app: Application;
  private mode: Mode = 'menu';
  private readonly root = new Container();
  private cleanupFns: Array<() => void> = [];
  private cameraX = 0;
  private keys = new Set<string>();

  private arrowTexture = Texture.WHITE;
  private towerTexture = Texture.WHITE;

  private levelManager = new LevelManager();
  private enemies: Enemy[] = [];
  private arrows: Arrow[] = [];
  private jumpedEnemies = new Set<Enemy>();
  private playerTower!: Tower;
  private enemyTower!: Tower;
  private bowman!: Bowman;
  private inputManager?: InputManager;
  private gameContainer = new Container();
  private uiContainer = new Container();
  private aimGraphics = new Graphics();
  private hitboxDebugGraphics = new Graphics();
  private optionsVisible = false;
  private bowTension = 1;
  private scheduledWaves = 0;
  private spawnedEnemies = 0;
  private defeatedEnemies = 0;
  private bowmanHealth = 100;
  private lastReleaseRadius = 0;
  private lastReleaseDirection: Vec2 = { x: 1, y: 0 };
  private enemiesVisible = true;
  private gameEnded = false;
  private currentLevel!: ILevelData;
  private selectedProjectile: ProjectileType = 'normal';
  private levelNumber = 1;
  private gold = 0;
  private effects: Array<{ sprite: Graphics; lifeMs: number; maxLifeMs: number }> = [];
  private arrowHitEnemies = new Map<Arrow, Set<Enemy>>();
  private cloudLayers: Cloud[] = [];
  private pendingTimers: number[] = [];
  private bloodParticles: BloodParticle[] = [];
  private bloodStains: Graphics[] = [];
  private uiRoot?: HTMLDivElement;
  private menuScreen?: HTMLElement;
  private gameUi?: HTMLElement;
  private optionsDrawer?: HTMLElement;
  private endScreen?: HTMLElement;
  private statusElement?: HTMLElement;
  private strengthElement?: HTMLElement;
  private towerHealthElement?: HTMLElement;
  private bowmanHealthElement?: HTMLElement;
  private enemyCountElement?: HTMLElement;
  private projectileButtons?: HTMLElement;
  private levelElement?: HTMLElement;
  private goldElement?: HTMLElement;
  private testScreen?: HTMLElement;
  private testJointElement?: HTMLElement;
  private testWalkSprite?: Graphics;
  private testArmedWalkSprite?: Graphics;
  private testRunningSprite?: Graphics;
  private testAttackSprite?: Graphics;
  private testArcherSprite?: Graphics;
  private testArcherPhase = 0;
  private testSequenceSprite?: Graphics;
  private testRunPhase = 0;
  private testAttackPhase = 0;
  private testSequencePhase = 0;
  private testSequenceRunPhase = 0;
  private testSequenceRunBlend = 0;
  private testSequenceSteps = 0;
  private testSequenceTimerMs = 0;
  private testSequenceIdleBlend = 0;
  private testSequenceState: 'walkFirst' | 'stand' | 'walkSecond' | 'run' | 'runToWalk' = 'walkFirst';
  private testWalkPhase = 0;
  private testStepsSinceStand = 0;
  private testIdleRemainingMs = 0;
  private testIdleBlend = 0;
  private gravityInput?: HTMLInputElement;
  private tensionInput?: HTMLInputElement;
  private gravityValue?: HTMLElement;
  private tensionValue?: HTMLElement;

  public constructor(app: Application) {
    this.app = app;
    this.root.sortableChildren = true;
    this.app.stage.addChild(this.root);
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS));
  }

  public async bootstrap(): Promise<void> {
    await this.loadAssets();
    this.setupCanvasScaling();
    this.createDomUi();
    this.enterMenu();
  }

  private async loadAssets(): Promise<void> {
    const [towerTex, arrowTex] = await Promise.all([
      Assets.load<Texture>(towerAsset),
      Assets.load<Texture>(arrowAsset),
    ]);

    this.towerTexture = towerTex;
    this.arrowTexture = arrowTex;
  }

  private setupCanvasScaling(): void {
    const resize = (): void => {
      const ratio = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
      const width = Math.max(1, Math.floor(GAME_WIDTH * ratio));
      const height = Math.max(1, Math.floor(GAME_HEIGHT * ratio));
      this.app.canvas.style.width = `${width}px`;
      this.app.canvas.style.height = `${height}px`;
      this.app.canvas.style.display = 'block';
      this.app.canvas.style.margin = '0 auto';
      this.app.canvas.style.imageRendering = 'auto';
    };

    resize();
    window.addEventListener('resize', resize);
    this.cleanupFns.push(() => window.removeEventListener('resize', resize));
  }

  private createDomUi(): void {
    const host = this.app.canvas.parentElement;
    if (!host) {
      throw new Error('Game canvas must be attached before creating the UI.');
    }

    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'ui-root';
    this.uiRoot.innerHTML = `
      <section class="screen" data-menu>
        <div class="menu-card">
          <div class="eyebrow">Medieval defense / level 01</div>
          <h1>Tower Guard</h1>
          <p>Protect the keep, control your position and fire with precision.</p>
          <button class="primary-button" data-start>Begin defense <span>1 / Space</span></button>
          <button class="secondary-button" data-open-test>Open animation test panel</button>
        </div>
      </section>
      <section class="test-screen" data-test>
        <div class="test-header">
          <div>
            <div class="eyebrow">Animation workshop / prototype</div>
            <h1>Character test panel</h1>
          <p>Compare the movement cycles and the archer's bow silhouette.</p>
          </div>
          <button class="secondary-button" data-open-game>Open game</button>
        </div>
        <div class="test-panel">
          <div class="test-panel-heading">
            <div><span class="eyebrow">Active character</span><strong>Archer stickman</strong></div>
          <span class="test-badge">ANIMATION LAB</span>
          </div>
          <p>All previews use the same stickman proportions as the in-game characters.</p>
          <div class="test-selection">
            <button class="character-chip active">Archer</button>
            <button class="character-chip enemy-chip">Enemy</button>
          </div>
          <div class="test-readout" data-test-joint>Animation previews and archer model</div>
          <div class="test-animation-note">Walking, sprinting and club attack cycles are shown below.</div>
        </div>
      </section>
      <section class="game-ui" data-game-ui hidden>
        <div class="topbar">
           <div class="metrics">
             <div class="metric-card"><span class="metric-label">Keep health</span><strong class="metric-value" data-tower-health>570 HP</strong></div>
             <div class="metric-card"><span class="metric-label">Bowman health</span><strong class="metric-value" data-bowman-health>100 HP</strong></div>
             <div class="metric-card"><span class="metric-label">Wave / enemies</span><strong class="metric-value" data-enemy-count>0 / 10</strong></div>
             <div class="metric-card"><span class="metric-label">Level · gold</span><strong class="metric-value"><span data-level>1</span> · <span data-gold>0</span></strong></div>
           </div>
          <div class="toolbar">
            <div><div class="toolbar-label">Aim power</div><div class="toolbar-title"><span data-force>0%</span> · The First Wave</div></div>
            <button class="icon-button" data-options aria-label="Open settings">⚙</button>
          </div>
        </div>
           <div class="projectile-bar" data-projectiles>
             <button class="projectile-button active" data-projectile="normal"><b>1</b> Normal</button>
             <button class="projectile-button" data-projectile="explosive"><b>2</b> Explosive</button>
             <button class="projectile-button" data-projectile="piercing"><b>3</b> Piercing</button>
           </div>
           <div class="status-bar" data-status>Drag from the bowman and release to fire</div>
        <div class="drawer" data-drawer hidden>
          <div class="drawer-header"><h2>Game settings</h2><button class="icon-button" data-close-options aria-label="Close settings">×</button></div>
          <div class="field"><div class="field-row"><span class="toolbar-label">Arrow gravity</span><strong class="field-value" data-gravity-value>700</strong></div><input data-gravity type="range" min="80" max="1000" step="1" value="700"></div>
          <div class="field"><div class="field-row"><span class="toolbar-label">Bow tension</span><strong class="field-value" data-tension-value>100%</strong></div><input data-tension type="range" min="0" max="1" step=".01" value="1"></div>
        </div>
      </section>
      <section class="screen" data-end hidden>
        <div class="end-card"><h2 data-end-title>Victory</h2><p data-end-copy>Press Space to return to the main menu.</p><button class="primary-button" data-end-button>Return to menu</button></div>
      </section>
    `;
    host.appendChild(this.uiRoot);

    this.menuScreen = this.getUiElement<HTMLElement>('[data-menu]');
    this.testScreen = this.getUiElement<HTMLElement>('[data-test]');
    this.gameUi = this.getUiElement<HTMLElement>('[data-game-ui]');
    this.optionsDrawer = this.getUiElement<HTMLElement>('[data-drawer]');
    this.endScreen = this.getUiElement<HTMLElement>('[data-end]');
    this.statusElement = this.getUiElement<HTMLElement>('[data-status]');
    this.strengthElement = this.getUiElement<HTMLElement>('[data-force]');
    this.towerHealthElement = this.getUiElement<HTMLElement>('[data-tower-health]');
    this.bowmanHealthElement = this.getUiElement<HTMLElement>('[data-bowman-health]');
    this.enemyCountElement = this.getUiElement<HTMLElement>('[data-enemy-count]');
    this.projectileButtons = this.getUiElement<HTMLElement>('[data-projectiles]');
    this.levelElement = this.getUiElement<HTMLElement>('[data-level]');
    this.goldElement = this.getUiElement<HTMLElement>('[data-gold]');
    this.gravityInput = this.getUiElement<HTMLInputElement>('[data-gravity]');
    this.tensionInput = this.getUiElement<HTMLInputElement>('[data-tension]');
    this.gravityValue = this.getUiElement<HTMLElement>('[data-gravity-value]');
    this.tensionValue = this.getUiElement<HTMLElement>('[data-tension-value]');

    this.getUiElement<HTMLButtonElement>('[data-start]').addEventListener('click', () => this.enterGame());
    this.getUiElement<HTMLButtonElement>('[data-open-test]').addEventListener('click', () => this.enterTest());
    this.getUiElement<HTMLButtonElement>('[data-open-game]').addEventListener('click', () => this.enterGame());
    this.testJointElement = this.getUiElement<HTMLElement>('[data-test-joint]');
    this.getUiElement<HTMLButtonElement>('[data-end-button]').addEventListener('click', () => this.enterMenu());
    this.getUiElement<HTMLButtonElement>('[data-options]').addEventListener('click', () => this.toggleOptions());
    this.getUiElement<HTMLButtonElement>('[data-close-options]').addEventListener('click', () => this.toggleOptions());
    this.projectileButtons.querySelectorAll<HTMLButtonElement>('[data-projectile]').forEach((button) => {
      button.addEventListener('click', () => this.selectProjectile(button.dataset.projectile as ProjectileType));
    });
    this.gravityInput.addEventListener('input', () => {
      Arrow.setGravity(Number(this.gravityInput?.value ?? ARROW_GRAVITY));
      this.updateDomOptions();
    });
    this.tensionInput.addEventListener('input', () => {
      this.bowTension = Number(this.tensionInput?.value ?? 1);
      this.updateDomOptions();
    });
  }

  private getUiElement<T extends HTMLElement>(selector: string): T {
    const element = this.uiRoot?.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }

  private updateDomOptions(): void {
    if (this.gravityValue) {
      this.gravityValue.textContent = `${Math.round(Arrow.getGravity())}`;
    }
    if (this.tensionValue) {
      this.tensionValue.textContent = `${Math.round(this.bowTension * 100)}%`;
    }
  }

  private setStatus(text: string): void {
    if (this.statusElement) {
      this.statusElement.textContent = text;
    }
  }

  private clearScene(): void {
    this.cleanupFns.forEach((cleanup) => cleanup());
    this.cleanupFns = [];
    this.pendingTimers.forEach((timerId) => window.clearTimeout(timerId));
    this.pendingTimers = [];
    this.root.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.inputManager?.destroy();
    this.inputManager = undefined;
    this.keys = new Set<string>();
  }

  private enterMenu(): void {
    this.clearScene();
    this.mode = 'menu';
    this.levelNumber = 1;
    this.gold = 0;
    this.testWalkSprite = undefined;
    this.testArmedWalkSprite = undefined;
    this.testRunningSprite = undefined;
    this.testAttackSprite = undefined;
    this.testArcherSprite = undefined;
    this.testArcherPhase = 0;
    this.testSequenceSprite = undefined;
    this.testStepsSinceStand = 0;
    this.testIdleRemainingMs = 0;
    this.testIdleBlend = 0;
    const keyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Digit1' || event.code === 'Space') {
        this.enterGame();
      }
    };

    window.addEventListener('keydown', keyDown);
    this.cleanupFns.push(() => window.removeEventListener('keydown', keyDown));
    if (this.menuScreen) {
      this.menuScreen.hidden = false;
    }
    if (this.testScreen) {
      this.testScreen.hidden = true;
    }
    if (this.gameUi) {
      this.gameUi.hidden = true;
    }
    if (this.endScreen) {
      this.endScreen.hidden = true;
    }
  }

  private enterTest(): void {
    this.clearScene();
    this.mode = 'test';
    this.root.addChild(new Graphics().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x0d1728 }));
    const grid = new Graphics();
    for (let x = 40; x < GAME_WIDTH; x += 40) {
      grid.moveTo(x, 0).lineTo(x, GAME_HEIGHT);
    }
    for (let y = 40; y < GAME_HEIGHT; y += 40) {
      grid.moveTo(0, y).lineTo(GAME_WIDTH, y);
    }
    grid.stroke({ width: 1, color: 0x1c2b43, alpha: 0.7 });
    this.root.addChild(grid);

    const floor = new Graphics()
      .moveTo(80, 495)
      .lineTo(690, 495)
      .stroke({ width: 2, color: 0x42617f });
    this.root.addChild(floor);

    this.testArcherSprite = new Graphics();
    this.testArcherSprite.position.set(100, 430);
    this.root.addChild(this.testArcherSprite);
    this.testWalkSprite = new Graphics();
    this.testWalkSprite.position.set(365, 430);
    this.root.addChild(this.testWalkSprite);
    this.testArmedWalkSprite = new Graphics();
    this.testArmedWalkSprite.position.set(560, 430);
    this.root.addChild(this.testArmedWalkSprite);
    this.testRunningSprite = new Graphics();
    this.testRunningSprite.position.set(460, 430);
    this.root.addChild(this.testRunningSprite);
    this.testAttackSprite = new Graphics();
    this.testAttackSprite.position.set(655, 430);
    this.root.addChild(this.testAttackSprite);
    this.testSequenceSprite = new Graphics();
    this.testSequenceSprite.position.set(265, 430);
    this.root.addChild(this.testSequenceSprite);
    this.testWalkPhase = 0;
    this.testRunPhase = 0;
    this.testAttackPhase = 0;
    this.testArcherPhase = 0;
    this.testSequencePhase = 0;
    this.testSequenceRunPhase = 0;
    this.testSequenceRunBlend = 0;
    this.testSequenceSteps = 0;
    this.testSequenceTimerMs = 0;
    this.testSequenceIdleBlend = 0;
    this.testSequenceState = 'walkFirst';
    this.testStepsSinceStand = 0;
    this.testIdleRemainingMs = 0;
    this.testIdleBlend = 0;
    drawWalkingStickman(this.testWalkSprite, this.testWalkPhase, this.testIdleBlend);
    drawWalkingStickman(this.testArmedWalkSprite, this.testWalkPhase, this.testIdleBlend, true);
    drawWalkingStickman(this.testRunningSprite, this.testRunPhase, 0, false, true);
    drawWalkingStickman(this.testAttackSprite, 0, 1, true, false, 0, 430, this.testAttackPhase);
    drawWalkingStickman(this.testSequenceSprite, this.testSequencePhase);
    drawTensionArcher(this.testArcherSprite, this.testArcherPhase);

    if (this.menuScreen) {
      this.menuScreen.hidden = true;
    }
    if (this.testScreen) {
      this.testScreen.hidden = false;
    }
    if (this.gameUi) {
      this.gameUi.hidden = true;
    }
    if (this.endScreen) {
      this.endScreen.hidden = true;
    }
  }

  private updateTestReadout(): void {
    if (this.testJointElement) {
      this.testJointElement.textContent = 'Animation previews and archer model';
    }
  }

  private enterGame(): void {
    this.clearScene();
    this.mode = 'game';
    this.optionsVisible = false;
    if (this.menuScreen) {
      this.menuScreen.hidden = true;
    }
    if (this.gameUi) {
      this.gameUi.hidden = false;
    }
    if (this.optionsDrawer) {
      this.optionsDrawer.hidden = true;
    }
    if (this.endScreen) {
      this.endScreen.hidden = true;
    }
    this.cameraX = 0;

    this.enemies = [];
    this.arrows = [];
    this.bloodParticles = [];
    this.bloodStains = [];
    this.effects = [];
    this.arrowHitEnemies = new Map<Arrow, Set<Enemy>>();
    this.jumpedEnemies = new Set<Enemy>();
    this.scheduledWaves = 0;
    this.spawnedEnemies = 0;
    this.defeatedEnemies = 0;
    this.bowmanHealth = 100;
    this.lastReleaseRadius = 0;
    this.lastReleaseDirection = { x: 1, y: 0 };
    this.enemiesVisible = true;
    this.gameEnded = false;
    this.currentLevel = this.levelManager.loadLevel(this.levelNumber);

    this.gameContainer = new Container();
    this.gameContainer.sortableChildren = true;
    this.uiContainer = new Container();
    this.uiContainer.sortableChildren = true;
    this.root.addChild(this.gameContainer, this.uiContainer);

    this.createBackground();

    this.playerTower = new Tower(PLAYER_TOWER_X, GROUND_Y, this.towerTexture, this.currentLevel.towerHealth);
    this.enemyTower = new Tower(ENEMY_TOWER_X, GROUND_Y, this.towerTexture, this.currentLevel.towerHealth);
    this.enemyTower.tint = 0xb85a4a;
    this.bowman = new Bowman(
      BOWMAN_START_X,
      BOWMAN_Y,
      { x: 50, y: 0, width: WORLD_WIDTH - 100, height: GAME_HEIGHT },
      { animationRenderer: drawWalkingStickman },
    );

    this.gameContainer.addChild(this.playerTower, this.enemyTower, this.bowman);

    this.aimGraphics = new Graphics();
    this.aimGraphics.zIndex = 3;
    this.hitboxDebugGraphics = new Graphics();
    this.hitboxDebugGraphics.zIndex = 4;
    this.gameContainer.addChild(this.aimGraphics, this.hitboxDebugGraphics);

    this.setStatus('Drag from the bowman and release to fire');
    this.updateDomOptions();
    this.bindGameInput();
    this.startLevel();
  }

  private createBackground(): void {
    const bg = new Graphics().rect(0, 0, WORLD_WIDTH, GAME_HEIGHT).fill({ color: 0x10233a });
    const sky = new Graphics().rect(0, 0, WORLD_WIDTH, GROUND_Y).fill({ color: 0x80b8d1, alpha: 1 });
    const glow = new Graphics().circle(790, 105, 68).fill({ color: 0xf8dc9b, alpha: 0.88 });
    glow.circle(790, 105, 88).fill({ color: 0xf8dc9b, alpha: 0.12 });
    this.gameContainer.addChild(bg, sky, glow);

    this.createDistantLandscape();
    this.createClouds();
    this.createTerrain();

  }

  private createClouds(): void {
    this.cloudLayers = [
      { x: 160, y: 105, width: 170, height: 42, speed: 3 },
      { x: 610, y: 155, width: 125, height: 30, speed: 2 },
      { x: 1040, y: 90, width: 210, height: 48, speed: 4 },
      { x: 1430, y: 140, width: 145, height: 34, speed: 2 },
    ].map(({ x, y, width, height, speed }) => {
      const cloud = new Graphics();
      cloud.ellipse(x, y, width * 0.5, height * 0.5).fill({ color: 0xf7fbf5, alpha: 0.68 });
      cloud.ellipse(x - width * 0.25, y + 4, width * 0.225, height * 0.4).fill({ color: 0xf7fbf5, alpha: 0.68 });
      cloud.ellipse(x + width * 0.2, y - 5, width * 0.25, height * 0.5).fill({ color: 0xf7fbf5, alpha: 0.68 });
      cloud.zIndex = 0;
      this.gameContainer.addChild(cloud);
      return { sprite: cloud, speed, width };
    });
  }

  private createDistantLandscape(): void {
    const hills = new Graphics();
    hills.moveTo(0, 360).bezierCurveTo(180, 250, 310, 340, 480, 275)
      .bezierCurveTo(650, 215, 820, 330, WORLD_WIDTH, 245)
      .lineTo(WORLD_WIDTH, GROUND_Y).lineTo(0, GROUND_Y).closePath().fill({ color: 0x587d85 });
    hills.moveTo(0, 412).bezierCurveTo(190, 320, 390, 390, 570, 330)
      .bezierCurveTo(760, 270, 900, 390, WORLD_WIDTH, 312)
      .lineTo(WORLD_WIDTH, GROUND_Y).lineTo(0, GROUND_Y).closePath().fill({ color: 0x3f6965 });

    const forest = new Graphics();
    for (let x = 20; x < WORLD_WIDTH; x += 92) {
      const height = 38 + ((x / 92) % 3) * 14;
      forest.circle(x, GROUND_Y - height, 18).fill({ color: 0x2d594f });
      forest.circle(x - 14, GROUND_Y - height + 12, 15).fill({ color: 0x35695a });
      forest.circle(x + 15, GROUND_Y - height + 12, 15).fill({ color: 0x264e4b });
      forest.rect(x - 3, GROUND_Y - height + 16, 6, height).fill({ color: 0x584d42 });
    }
    hills.zIndex = 0;
    forest.zIndex = 0;
    this.gameContainer.addChild(hills, forest);
  }

  private createTerrain(): void {
    const ground = new Graphics();
    ground.rect(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y).fill({ color: 0x79a866 });
    ground.moveTo(0, GROUND_Y).bezierCurveTo(210, GROUND_Y - 8, 420, GROUND_Y + 7, 650, GROUND_Y - 5)
      .bezierCurveTo(850, GROUND_Y - 12, 1020, GROUND_Y + 5, WORLD_WIDTH, GROUND_Y)
      .stroke({ width: 8, color: 0xc7e094 });
    for (let x = 25; x < WORLD_WIDTH; x += 70) {
      ground.ellipse(x, GROUND_Y + 32 + (x % 3) * 8, 22, 6).fill({ color: 0x679452, alpha: 0.35 });
    }
    ground.zIndex = 0;
    this.gameContainer.addChild(ground);
  }

  private bindGameInput(): void {
    this.inputManager = new InputManager({
      eventTarget: this.app.canvas,
      worldPointFromScreen: (point) => ({ x: point.x + this.cameraX, y: point.y }),
      isPointerBlocked: (point) => this.isOptionsPointer(point),
      maxDragDistance: 200,
      screenSize: { x: GAME_WIDTH, y: GAME_HEIGHT },
    });

    this.inputManager.on(InputManager.Events.AIM, (aim: AimInput) => {
      this.bowman.setAim(aim.direction, aim.power);
    });

    this.inputManager.on(InputManager.Events.AIM_RELEASE, (aim: AimInput) => {
      this.bowman.setAim(aim.direction, aim.power);
      const effectivePower = aim.power * this.bowTension;
      if (effectivePower > 0.05) {
        this.bowman.playAttackAnimation();
        this.lastReleaseRadius = aim.strength.distance * 0.55;
        this.lastReleaseDirection = { ...aim.direction };
        this.fireArrow(aim, effectivePower);
      }
      this.bowman.setAim(aim.direction, 0);
    });

    const keyDown = (event: KeyboardEvent): void => {
      this.keys.add(event.code);

      if (event.code === 'Escape') {
        this.enterMenu();
      }

      if (event.code === 'KeyI') {
        this.toggleOptions();
      }

      if (event.code === 'Digit1') this.selectProjectile('normal');
      if (event.code === 'Digit2') this.selectProjectile('explosive');
      if (event.code === 'Digit3') this.selectProjectile('piercing');

      if (event.code === 'KeyO') {
        this.enemiesVisible = !this.enemiesVisible;
        this.enemies.forEach((enemy) => {
          enemy.visible = this.enemiesVisible;
          enemy.setPaused(!this.enemiesVisible);
        });
        this.hitboxDebugGraphics.clear();
      }

      if (this.gameEnded && event.code === 'Space') {
        this.enterMenu();
      }
    };

    const keyUp = (event: KeyboardEvent): void => {
      this.keys.delete(event.code);
    };

    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    this.cleanupFns.push(() => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    });
  }

  private toggleOptions(): void {
    this.optionsVisible = !this.optionsVisible;
    if (this.optionsDrawer) {
      this.optionsDrawer.hidden = !this.optionsVisible;
    }
    this.inputManager?.cancelAim();
  }

  private isOptionsPointer(point: Vec2): boolean {
    void point;
    return false;
  }

  private startLevel(): void {
    this.currentLevel = this.levelManager.loadLevel(this.levelNumber);
    this.currentLevel.waves.forEach((wave) => this.scheduleWave(wave));
    this.setStatus(`Level ${this.currentLevel.id}: ${this.currentLevel.name} · defend your keep`);
  }

  private scheduleWave(wave: IWave): void {
    this.scheduledWaves += 1;
    const waveTimer = window.setTimeout(() => {
      for (let index = 0; index < wave.count; index += 1) {
        const spawnTimer = window.setTimeout(() => this.spawnEnemy(wave), index * wave.spawn.interval);
        this.pendingTimers.push(spawnTimer);
      }
    }, wave.delay);
    this.pendingTimers.push(waveTimer);
  }

  private spawnEnemy(wave: IWave): void {
    if (this.gameEnded) {
      return;
    }

    const enemyStats = {
      basic: { health: ENEMY_HEALTH, speed: ENEMY_SPEED },
      fast: { health: Math.round(ENEMY_HEALTH * 0.7), speed: ENEMY_SPEED * 1.65 },
      tank: { health: Math.round(ENEMY_HEALTH * 2.6), speed: ENEMY_SPEED * 0.62 },
    }[wave.enemyType];
    const enemy = new Enemy(
      wave.spawn.spawnPoint.x,
      wave.spawn.spawnPoint.y,
      Math.round(enemyStats.health * this.currentLevel.enemyDifficulty),
      enemyStats.speed * this.currentLevel.enemyDifficulty,
      'bowman',
      drawWalkingStickman,
    );

    enemy.visible = this.enemiesVisible;
    this.enemies.push(enemy);
    this.spawnedEnemies += 1;
    this.gameContainer.addChild(enemy);
  }

  private fireArrow(aim: AimInput, power = aim.power): void {
    this.arrows.forEach((arrow) => arrow.ageTrail());

    const trail = new Graphics();
    trail.zIndex = 1;
    this.gameContainer.addChild(trail);

    const releasePoint = this.bowman.getBowReleasePoint();
    const arrow = new Arrow(releasePoint.x, releasePoint.y, this.arrowTexture, trail);

    const angle = Math.atan2(aim.direction.y, aim.direction.x);
    const speed = (ARROW_BASE_SPEED + power * ARROW_FORCE_SPEED) * ARROW_SPEED_FACTOR;
    arrow.fire(angle, speed, this.selectedProjectile);
    this.arrows.push(arrow);
    this.gameContainer.addChild(arrow);
  }

  private selectProjectile(type: ProjectileType): void {
    this.selectedProjectile = type;
    this.projectileButtons?.querySelectorAll<HTMLButtonElement>('[data-projectile]').forEach((button) => {
      button.classList.toggle('active', button.dataset.projectile === type);
    });
    const labels: Record<ProjectileType, string> = {
      normal: 'Normal arrow · reliable damage',
      explosive: 'Explosive bolt · area damage on first impact',
      piercing: 'Piercing arrow · passes through enemies',
    };
    this.setStatus(labels[type]);
  }

  private update(deltaMs: number): void {
    if (this.mode === 'test') {
      if (this.testIdleRemainingMs > 0) {
        this.testIdleRemainingMs = Math.max(0, this.testIdleRemainingMs - deltaMs);
        this.testIdleBlend = Math.min(1, this.testIdleBlend + deltaMs / 350);
        if (this.testIdleRemainingMs === 0) {
          this.testStepsSinceStand = 0;
        }
      } else {
        const previousStep = Math.floor(this.testWalkPhase / Math.PI);
        this.testWalkPhase += deltaMs / 150;
        const completedSteps = Math.floor(this.testWalkPhase / Math.PI) - previousStep;
        this.testStepsSinceStand += Math.max(0, completedSteps);
        this.testIdleBlend = Math.max(0, this.testIdleBlend - deltaMs / 350);
        if (this.testStepsSinceStand >= 5) {
          this.testIdleRemainingMs = 3_000;
        }
      }
      if (this.testWalkSprite) {
        drawWalkingStickman(this.testWalkSprite, this.testWalkPhase, this.testIdleBlend);
      }
      this.testArcherPhase += deltaMs / 900;
      if (this.testArcherSprite) {
        drawTensionArcher(this.testArcherSprite, this.testArcherPhase);
      }
      if (this.testArmedWalkSprite) {
        drawWalkingStickman(this.testArmedWalkSprite, this.testWalkPhase, this.testIdleBlend, true);
      }
      this.testRunPhase += deltaMs / 160;
      if (this.testRunningSprite) {
        drawWalkingStickman(this.testRunningSprite, this.testRunPhase, 0, false, true);
      }
      this.testAttackPhase += deltaMs / 180;
      if (this.testAttackSprite) {
        drawWalkingStickman(this.testAttackSprite, 0, 1, true, false, 0, 430, this.testAttackPhase);
      }
      if (this.testSequenceSprite) {
        if (this.testSequenceState === 'stand') {
          this.testSequenceTimerMs = Math.max(0, this.testSequenceTimerMs - deltaMs);
          this.testSequenceIdleBlend = Math.min(1, this.testSequenceIdleBlend + deltaMs / 350);
          if (this.testSequenceTimerMs === 0) {
            this.testSequenceState = 'walkSecond';
            this.testSequenceSteps = 0;
          }
        } else if (this.testSequenceState === 'run') {
          const previousStep = Math.floor(this.testSequenceRunPhase / Math.PI);
          this.testSequenceRunPhase += deltaMs / 160;
          this.testSequenceRunBlend = Math.min(1, this.testSequenceRunBlend + deltaMs / 400);
          this.testSequenceSteps += Math.max(0, Math.floor(this.testSequenceRunPhase / Math.PI) - previousStep);
          if (this.testSequenceSteps >= 10) {
            this.testSequenceState = 'runToWalk';
            this.testSequencePhase = this.testSequenceRunPhase;
            this.testSequenceSteps = 0;
            this.testSequenceIdleBlend = 0;
          }
        } else if (this.testSequenceState === 'runToWalk') {
          this.testSequencePhase += deltaMs / 150;
          this.testSequenceRunBlend = Math.max(0, this.testSequenceRunBlend - deltaMs / 400);
          if (this.testSequenceRunBlend === 0) {
            this.testSequenceState = 'walkFirst';
            this.testSequenceSteps = 0;
            this.testSequenceRunPhase = 0;
          }
        } else {
          const previousStep = Math.floor(this.testSequencePhase / Math.PI);
          this.testSequencePhase += deltaMs / 150;
          this.testSequenceSteps += Math.max(0, Math.floor(this.testSequencePhase / Math.PI) - previousStep);
          this.testSequenceIdleBlend = Math.max(0, this.testSequenceIdleBlend - deltaMs / 350);
          const targetSteps = this.testSequenceState === 'walkFirst' ? 5 : 2;
          if (this.testSequenceSteps >= targetSteps) {
            if (this.testSequenceState === 'walkFirst') {
              this.testSequenceState = 'stand';
              this.testSequenceTimerMs = 2_000;
            } else {
              this.testSequenceState = 'run';
              this.testSequenceRunPhase = this.testSequencePhase;
              this.testSequenceRunBlend = 0;
              this.testSequenceSteps = 0;
            }
          }
        }

        if (this.testSequenceState === 'run') {
          drawWalkingStickman(
            this.testSequenceSprite,
            this.testSequenceRunPhase,
            0,
            false,
            false,
            this.testSequenceRunBlend,
          );
        } else if (this.testSequenceState === 'runToWalk') {
          drawWalkingStickman(
            this.testSequenceSprite,
            this.testSequencePhase,
            0,
            false,
            false,
            this.testSequenceRunBlend,
          );
        } else {
          drawWalkingStickman(this.testSequenceSprite, this.testSequencePhase, this.testSequenceIdleBlend);
        }
      }
      this.updateTestReadout();
      return;
    }
    if (this.mode !== 'game') {
      return;
    }

    this.updateClouds(deltaMs);

    if (this.gameEnded) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    const movementDirection = this.inputManager?.getMovementDirection() ?? 0;
    if (this.inputManager?.isJumpPressed()) {
      this.bowman.jump();
    }

    const sprinting = this.inputManager?.isSprintDown() ?? false;
    if (this.bowman.isInTower) {
      if (movementDirection > 0) {
        this.exitTower();
        this.bowman.moveHorizontal(movementDirection, deltaSeconds, sprinting);
      } else {
        this.bowman.moveHorizontal(0, deltaSeconds);
      }
    } else {
      this.bowman.moveHorizontal(movementDirection, deltaSeconds, sprinting);
      this.bowman.updateVertical(deltaSeconds);
      if (movementDirection < 0 && this.canEnterTower()) {
        this.enterTower();
      }
    }

    this.bowman.updateAnimation(deltaMs, movementDirection !== 0, sprinting);
    this.playerTower.update();
    this.enemyTower.update();
    this.updateEnemies(deltaMs);
    this.updateAimGraphics();
    this.updateHud();
    this.updateCamera();
    this.checkWinCondition();
  }

  private updateClouds(deltaMs: number): void {
    if (this.mode !== 'game') {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    this.cloudLayers.forEach(({ sprite, speed, width }) => {
      sprite.x += speed * deltaSeconds * 15;
      if (sprite.x - this.cameraX > WORLD_WIDTH + width) {
        sprite.x = -width;
      }
    });
  }

  private updateCamera(): void {
    const target = clamp(this.bowman.x - GAME_WIDTH / 2, 0, WORLD_WIDTH - GAME_WIDTH);
    this.cameraX += (target - this.cameraX) * 0.1;
    this.gameContainer.x = -this.cameraX;
  }

  private updateEnemies(deltaMs: number): void {
    this.hitboxDebugGraphics.clear();
    this.updateBloodEffects(deltaMs);
    this.enemies.forEach((enemy) => {
      enemy.visible = this.enemiesVisible;
    });

    if (!this.enemiesVisible) {
      return;
    }

    const activeEnemies = this.enemies.filter((enemy) => enemy.isAlive());
    const defaultTarget = this.bowman.isInTower ? 'tower' : 'bowman';

    activeEnemies.forEach((enemy) => {
      enemy.target = defaultTarget;
      const bowmanBehindEnemy = enemy.target === 'bowman' && this.bowman.x > enemy.x + 25;
      const targetPosition = enemy.target === 'bowman'
        ? { x: bowmanBehindEnemy ? enemy.x + 100 : this.bowman.x, y: BOWMAN_Y }
        : { x: this.playerTower.x, y: GROUND_Y };

      enemy.update(deltaMs, targetPosition, enemy.target === 'tower' ? 40 : 25);
      enemy.updateAnimation(deltaMs, enemy.isMoving());

      if (SHOW_HITBOX_DEBUG && this.enemiesVisible) {
        const hitbox = enemy.getPhysicsBounds();
        this.hitboxDebugGraphics.rect(hitbox.x, hitbox.y, hitbox.width, hitbox.height).stroke({ width: 1, color: 0xff5555, alpha: 0.9 });
      }

      if (enemy.target === 'tower' && enemy.x <= this.playerTower.x + 40) {
        if (enemy.canAttack(deltaMs)) {
          enemy.playAttackAnimation();
          this.playerTower.takeDamage(this.getRandomEnemyDamage());
        }
        return;
      }

      if (enemy.target !== 'bowman') {
        return;
      }

      const overlapsBowman = enemy.x >= this.bowman.x - 25 && enemy.x <= this.bowman.x + 25;
      if (!this.bowman.isInTower && this.bowman.y < BOWMAN_Y - 20 && overlapsBowman) {
        this.jumpedEnemies.add(enemy);
      }

      if (!this.bowman.isInTower && !this.jumpedEnemies.has(enemy) && overlapsBowman && Math.abs(enemy.y - this.bowman.y) <= 45) {
        if (enemy.canAttack(deltaMs)) {
          enemy.playAttackAnimation();
          this.bowmanHealth = Math.max(0, this.bowmanHealth - this.getRandomEnemyDamage());
          this.createBloodBurst({ x: this.bowman.x, y: this.bowman.y - 20 });
        }
      }

      enemy.clearHitTint();
    });

    this.arrows.filter((arrow) => arrow.isActive).forEach((arrow) => arrow.update(deltaMs));

    this.arrows.filter((arrow) => arrow.isActive && !arrow.isStuck).forEach((arrow) => {
      const { start, end } = arrow.getTravelSegment();
      const travel = { x: end.x - start.x, y: end.y - start.y };
      const hitEnemies = this.arrowHitEnemies.get(arrow) ?? new Set<Enemy>();
      this.arrowHitEnemies.set(arrow, hitEnemies);

      const enemyHit = activeEnemies
        .filter((candidate) => candidate.isAlive() && !hitEnemies.has(candidate))
        .map((candidate) => ({ enemy: candidate, time: this.getArrowHitTime(start, travel, candidate) }))
        .filter((hit): hit is { enemy: Enemy; time: number } => hit.time !== undefined)
        .sort((first, second) => first.time - second.time)[0];

      const towerHit = this.getTowerHitTime(start, travel);
      if (towerHit !== undefined && (enemyHit === undefined || towerHit <= enemyHit.time)) {
        const impactPoint = { x: start.x + travel.x * towerHit, y: start.y + travel.y * towerHit };
        this.enemyTower.takeDamage(ENEMY_TOWER_DAMAGE * (arrow.type === 'explosive' ? 1.25 : 1));
        this.createImpactEffect(impactPoint, arrow.type === 'explosive');
        if (arrow.type === 'explosive') {
          this.createExplosion(impactPoint);
        }
        arrow.deactivate();
        return;
      }

      if (!enemyHit) {
        return;
      }

      const enemy = enemyHit.enemy;
      const impactPoint = {
        x: start.x + travel.x * enemyHit.time,
        y: start.y + travel.y * enemyHit.time,
      };

      this.createBloodBurst(impactPoint);

      if (SHOW_HITBOX_DEBUG && this.enemiesVisible) {
        this.hitboxDebugGraphics.circle(impactPoint.x, impactPoint.y, 3).fill({ color: 0x55ff88, alpha: 1 });
      }

      const damage = arrow.type === 'piercing'
        ? PROJECTILE_DAMAGE * Math.pow(PIERCING_DAMAGE_MULTIPLIER, arrow.impacts)
        : PROJECTILE_DAMAGE;
      enemy.applyHitReaction(arrow.x < enemy.x ? 6 : -4);
      enemy.takeDamage(damage);
      hitEnemies.add(enemy);
      arrow.registerImpact();
      if (arrow.type === 'explosive') {
        this.createExplosion(impactPoint);
        activeEnemies.filter((candidate) => candidate !== enemy && candidate.isAlive()
          && Math.hypot(candidate.x - impactPoint.x, candidate.y - impactPoint.y) <= EXPLOSION_RADIUS)
          .forEach((candidate) => {
            candidate.takeDamage(EXPLOSION_DAMAGE);
            if (!candidate.isAlive()) this.defeatedEnemies += 1;
          });
        arrow.deactivate();
      } else if (arrow.type === 'piercing') {
        this.createImpactEffect(impactPoint, false);
        if (arrow.impacts >= 5) arrow.deactivate();
      } else {
        arrow.stickToEnemy(enemy, impactPoint);
      }

      if (!enemy.isAlive()) {
        this.defeatedEnemies += 1;
      }
    });

    this.arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck && arrow.y >= GROUND_Y - 3)
      .forEach((arrow) => arrow.stickToGround(GROUND_Y - 3));
  }

  private updateAimGraphics(): void {
    this.aimGraphics.clear();
    const releasePoint = this.bowman.getBowReleasePoint();
    const originX = releasePoint.x;
    const originY = releasePoint.y;
    const aim = this.inputManager?.getAim();

    if (!aim || aim.power <= 0) {
      if (this.strengthElement) {
        this.strengthElement.textContent = '0%';
      }
      this.drawPreviousReleaseMarker(originX, originY);
      return;
    }

    if (this.strengthElement) {
      this.strengthElement.textContent = `${Math.round(aim.strength.value * 100)}%`;
    }
    const forceRadius = aim.strength.distance;
    const visualRadius = forceRadius * 0.55;
    const cursorRadius = Math.hypot(aim.start.x - aim.current.x, aim.start.y - aim.current.y);

    this.drawPreviousReleaseMarker(originX, originY);

    this.aimGraphics.circle(originX, originY, 4).fill({ color: 0xf5d76e, alpha: 1 });
    this.aimGraphics.moveTo(originX, originY).lineTo(originX + aim.direction.x * visualRadius, originY + aim.direction.y * visualRadius).stroke({ width: 3, color: 0xf5d76e, alpha: 0.9 });
    this.aimGraphics.circle(aim.start.x, aim.start.y, visualRadius).stroke({ width: 2, color: 0xf5d76e, alpha: 0.8 });
    this.aimGraphics.circle(originX, originY, visualRadius).stroke({ width: 2, color: 0xf5d76e, alpha: 0.8 });
    this.aimGraphics.circle(aim.start.x, aim.start.y, 4).fill({ color: 0xf5d76e, alpha: 0.35 });
    this.aimGraphics.circle(aim.start.x, aim.start.y, visualRadius).fill({ color: 0xf5d76e, alpha: 0.1 });
    this.aimGraphics.circle(originX, originY, visualRadius).fill({ color: 0xf5d76e, alpha: 0.1 });
    this.aimGraphics.circle(aim.start.x, aim.start.y, cursorRadius).stroke({ width: 2, color: 0xf5d76e, alpha: 0.45 });

    const dx = aim.current.x - aim.start.x;
    const dy = aim.current.y - aim.start.y;
    const length = Math.hypot(dx, dy);
    if (length > Number.EPSILON) {
      this.aimGraphics.moveTo(aim.start.x, aim.start.y).lineTo(
        aim.start.x + (dx / length) * cursorRadius,
        aim.start.y + (dy / length) * cursorRadius,
      ).stroke({ width: 2, color: 0xf5d76e, alpha: 0.7 });
    }
  }

  private drawPreviousReleaseMarker(originX: number, originY: number): void {
    if (this.lastReleaseRadius <= 0) {
      return;
    }

    this.aimGraphics.circle(originX, originY, this.lastReleaseRadius).stroke({ width: 2, color: 0x9ec5ff, alpha: 0.55 });
    this.aimGraphics.moveTo(originX, originY).lineTo(
      originX + this.lastReleaseDirection.x * this.lastReleaseRadius,
      originY + this.lastReleaseDirection.y * this.lastReleaseRadius,
    ).stroke({ width: 2, color: 0x9ec5ff, alpha: 0.55 });
    this.aimGraphics.circle(originX, originY, this.lastReleaseRadius).fill({ color: 0x9ec5ff, alpha: 0.12 });
  }

  private updateHud(): void {
    if (this.towerHealthElement) {
      this.towerHealthElement.textContent = `${this.playerTower.getHealth()} HP`;
    }
    if (this.bowmanHealthElement) {
      this.bowmanHealthElement.textContent = `${this.bowmanHealth} HP`;
    }
    if (this.enemyCountElement) {
      const total = this.currentLevel?.spawnings.reduce((sum, spawn) => sum + spawn.count, 0) ?? TOTAL_LEVEL_ENEMIES;
      this.enemyCountElement.textContent = `${this.defeatedEnemies} / ${total}`;
    }
    if (this.levelElement) this.levelElement.textContent = `${this.levelNumber}`;
    if (this.goldElement) this.goldElement.textContent = `${this.gold}`;
  }

  private getRandomEnemyDamage(): number {
    return Math.floor(Math.random() * 6) + 2;
  }

  private createBloodBurst(point: Vec2): void {
    for (let index = 0; index < 8; index += 1) {
      const particle = new Graphics()
        .circle(0, 0, 1.5 + Math.random() * 2)
        .fill({ color: index % 3 === 0 ? 0x8f2035 : 0xc33d48 });
      particle.position.set(point.x, point.y);
      particle.zIndex = 3;
      this.gameContainer.addChild(particle);
      this.bloodParticles.push({
        sprite: particle,
        velocity: {
          x: (Math.random() - 0.5) * 150,
          y: -80 - Math.random() * 170,
        },
        lifeMs: 480 + Math.random() * 420,
      });
    }
    this.createBloodStain(point.x + (Math.random() - 0.5) * 12, GROUND_Y - 1);
  }

  private createImpactEffect(point: Vec2, explosive: boolean): void {
    const sprite = new Graphics();
    sprite.circle(0, 0, explosive ? 18 : 8).fill({
      color: explosive ? 0xffc857 : 0xf4e7b1,
      alpha: 0.8,
    });
    sprite.position.set(point.x, point.y);
    sprite.zIndex = 5;
    this.gameContainer.addChild(sprite);
    this.effects.push({ sprite, lifeMs: 220, maxLifeMs: 220 });
  }

  private createExplosion(point: Vec2): void {
    const ring = new Graphics().circle(0, 0, EXPLOSION_RADIUS)
      .stroke({ width: 5, color: 0xffa63d, alpha: 0.75 })
      .circle(0, 0, EXPLOSION_RADIUS * 0.6)
      .fill({ color: 0xffd166, alpha: 0.18 });
    ring.position.set(point.x, point.y);
    ring.zIndex = 4;
    this.gameContainer.addChild(ring);
    this.effects.push({ sprite: ring, lifeMs: 360, maxLifeMs: 360 });
  }

  private updateBloodEffects(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.bloodParticles = this.bloodParticles.filter((particle) => {
      particle.lifeMs -= deltaMs;
      particle.velocity.y += 520 * deltaSeconds;
      particle.sprite.x += particle.velocity.x * deltaSeconds;
      particle.sprite.y += particle.velocity.y * deltaSeconds;
      particle.sprite.alpha = Math.min(1, particle.lifeMs / 180);

      if (particle.sprite.y >= GROUND_Y - 2 || particle.lifeMs <= 0) {
        if (particle.sprite.y >= GROUND_Y - 2) {
          this.createBloodStain(particle.sprite.x, GROUND_Y - 1);
        }
        this.gameContainer.removeChild(particle.sprite);
        particle.sprite.destroy();
        return false;
      }
      return true;
    });
    this.effects = this.effects.filter((effect) => {
      effect.lifeMs -= deltaMs;
      effect.sprite.alpha = Math.max(0, effect.lifeMs / effect.maxLifeMs);
      effect.sprite.scale.set(1 + (1 - effect.lifeMs / effect.maxLifeMs) * 0.55);
      if (effect.lifeMs <= 0) {
        this.gameContainer.removeChild(effect.sprite);
        effect.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private createBloodStain(x: number, y: number): void {
    const stain = new Graphics()
      .ellipse(0, 0, 3 + Math.random() * 6, 1.5 + Math.random() * 2)
      .fill({ color: 0x7e2637, alpha: 0.72 });
    stain.position.set(x, y);
    stain.rotation = (Math.random() - 0.5) * 0.8;
    stain.zIndex = 0;
    this.gameContainer.addChild(stain);
    this.bloodStains.push(stain);
  }

  private checkWinCondition(): void {
    const activeEnemies = this.enemies.filter((enemy) => enemy.isAlive()).length;

    if (this.bowmanHealth <= 0 || this.playerTower.isDestroyed()) {
      this.endGame(false);
      return;
    }

    const total = this.currentLevel.spawnings.reduce((sum, spawn) => sum + spawn.count, 0);
    if (this.enemyTower.isDestroyed()) {
      this.endGame(true);
      return;
    }
    if (this.spawnedEnemies >= total && activeEnemies === 0 && this.defeatedEnemies >= total) {
      this.endGame(true);
    }
  }

  private endGame(won: boolean): void {
    this.gameEnded = true;
    if (this.endScreen) {
      this.endScreen.hidden = false;
      const title = this.endScreen.querySelector<HTMLElement>('[data-end-title]');
      const copy = this.endScreen.querySelector<HTMLElement>('[data-end-copy]');
      if (title) {
         title.textContent = won ? (this.levelNumber < 3 ? `Level ${this.levelNumber} cleared!` : 'Kingdom saved') : 'Defeat';
        title.style.color = won ? '#82d99a' : '#e66b6b';
      }
      if (copy) {
         copy.textContent = won
           ? `Reward: +${this.currentLevel.goldReward} gold. ${this.levelNumber < 3 ? 'Prepare for the next battle.' : 'The realm is safe.'}`
           : 'The keep has fallen. Return to the main menu and try again.';
      }
      const button = this.endScreen.querySelector<HTMLButtonElement>('[data-end-button]');
      if (button) {
        button.textContent = won && this.levelNumber < 3 ? 'Continue to next level' : 'Return to menu';
        button.onclick = () => {
          if (won && this.levelNumber < 3) {
            this.gold += this.currentLevel.goldReward;
            this.levelNumber += 1;
            this.enterGame();
          } else {
            this.enterMenu();
          }
        };
      }
    }
    this.inputManager?.destroy();
    this.inputManager = undefined;
  }

  private canEnterTower(): boolean {
    const left = this.playerTower.x - TOWER_ENTRY_ZONE_WIDTH * 0.65;
    const top = BOWMAN_Y - TOWER_ENTRY_ZONE_HEIGHT * 0.55;
    return this.bowman.x >= left
      && this.bowman.x <= left + TOWER_ENTRY_ZONE_WIDTH
      && this.bowman.y >= top
      && this.bowman.y <= top + TOWER_ENTRY_ZONE_HEIGHT;
  }

  private enterTower(): void {
    this.bowman.enterTower();
    this.bowman.setTowerPosition(PLAYER_TOWER_X, GROUND_Y - TOWER_HEIGHT + 48);
    this.setStatus('Hidden in tower · move right to exit');
  }

  private exitTower(): void {
    this.bowman.exitTower();
    this.bowman.setHorizontalPosition(this.playerTower.x + TOWER_EXIT_X_OFFSET);
    this.bowman.y = BOWMAN_Y;
    this.setStatus('Drag from the bowman and release to fire');
  }

  private getArrowHitTime(start: Vec2, travel: Vec2, enemy: Enemy): number | undefined {
    const hitbox = enemy.getPhysicsBounds();
    let entry = 0;
    let exit = 1;

    (['x', 'y'] as const).forEach((axis) => {
      if (entry > exit) {
        return;
      }

      const origin = start[axis];
      const delta = travel[axis];
      const minimum = axis === 'x' ? hitbox.left : hitbox.top;
      const maximum = axis === 'x' ? hitbox.right : hitbox.bottom;

      if (Math.abs(delta) < Number.EPSILON) {
        if (origin < minimum || origin > maximum) {
          entry = Number.POSITIVE_INFINITY;
          exit = Number.NEGATIVE_INFINITY;
        }
        return;
      }

      let near = (minimum - origin) / delta;
      let far = (maximum - origin) / delta;
      if (near > far) {
        [near, far] = [far, near];
      }
      entry = Math.max(entry, near);
      exit = Math.min(exit, far);
    });

    if (entry > exit || !Number.isFinite(entry)) {
      return undefined;
    }

    return clamp(entry, 0, 1);
  }

  private getTowerHitTime(start: Vec2, travel: Vec2): number | undefined {
    const left = this.enemyTower.x - 48;
    const right = this.enemyTower.x + 48;
    const top = GROUND_Y - TOWER_HEIGHT;
    let entry = 0;
    let exit = 1;
    for (const [origin, delta, minimum, maximum] of [
      [start.x, travel.x, left, right],
      [start.y, travel.y, top, GROUND_Y],
    ] as Array<[number, number, number, number]>) {
      if (Math.abs(delta) < Number.EPSILON) {
        if (origin < minimum || origin > maximum) return undefined;
        continue;
      }
      let near = (minimum - origin) / delta;
      let far = (maximum - origin) / delta;
      if (near > far) [near, far] = [far, near];
      entry = Math.max(entry, near);
      exit = Math.min(exit, far);
    }
    return entry <= exit && Number.isFinite(entry) ? clamp(entry, 0, 1) : undefined;
  }

  private screenPoint(event: PointerEvent): Vec2 {
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * GAME_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT,
    };
  }
}

const bootstrap = async (): Promise<void> => {
  const app = new Application();
  await app.init({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: 0x000000,
    antialias: true,
    autoDensity: true,
    resolution: Math.max(1, window.devicePixelRatio || 1),
  });

  const host = document.getElementById('game') ?? document.body;
  host.innerHTML = '';
  host.appendChild(app.canvas);

  const towerGuard = new TowerGuardApp(app);
  await towerGuard.bootstrap();
};

void bootstrap();
