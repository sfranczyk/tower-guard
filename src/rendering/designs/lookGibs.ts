import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import type { BodyColors } from '../bodyColors';
import { GIB_GROUND_Y, type GibPiece, type GibSimulation } from '../stickmanGibs';
import type { BodyPose } from './bodyPoses';
import { limb } from './designShapes';
import { footShape, headFrame, torsoFrame, type HumanoidLook, type LimbLook } from './skinKit';

/**
 * A blown-apart enemy in its look: the same GibSimulation (pieces in the order it builds them: torso,
 * near upper arm and forearm, far upper arm and forearm, near thigh and shin, far thigh and shin, head),
 * each piece drawn as that part of the look: the torso with its clothes and gear, the head with its face,
 * the limbs in their sleeves and trousers with hands, feet and whatever the hands held.
 */

const TORSO = 0;
const HEAD = 9;

const ends = (piece: GibPiece): [Vec2, Vec2] => {
  const half = piece.length / 2;
  const d = { x: Math.cos(piece.angle), y: Math.sin(piece.angle) };
  return [{ x: piece.x - d.x * half, y: piece.y - d.y * half }, { x: piece.x + d.x * half, y: piece.y + d.y * half }];
};

/** A pose whose torso lies along `up` from `hip` (limbs gathered at the hip, so nothing hangs off it). */
const torsoPose = (hip: Vec2, up: Vec2): BodyPose => {
  const along = (distance: number): Vec2 => ({ x: hip.x + up.x * distance, y: hip.y + up.y * distance });
  const shoulder = along(35);
  return {
    hip, shoulder, neckTop: along(43), head: along(52),
    frontKnee: hip, frontFoot: hip, rearKnee: hip, rearFoot: hip,
    frontElbow: shoulder, frontHand: shoulder, rearElbow: shoulder, rearHand: shoulder,
    frontShinAngle: 0, rearShinAngle: 0,
  };
};

const drawTorso = (g: Graphics, piece: GibPiece, look: HumanoidLook): void => {
  const [hip, neck] = ends(piece);
  // The piece runs hip → neck top.
  const length = piece.length || 1;
  const up = { x: (neck.x - hip.x) / length, y: (neck.y - hip.y) / length };
  const pose = torsoPose(hip, up);
  look.back?.(g, pose);
  look.torso(g, pose, torsoFrame(pose));
  look.overLegs?.(g, pose, torsoFrame(pose));
};

const drawHead = (g: Graphics, piece: GibPiece, look: HumanoidLook): void => {
  // The head spins with the piece: its up axis starts pointing up.
  const up = { x: Math.sin(piece.angle), y: -Math.cos(piece.angle) };
  const head = { x: piece.x, y: piece.y };
  const hip = { x: head.x - up.x * 52, y: head.y - up.y * 52 };
  const pose = torsoPose(hip, up);
  look.head(g, pose, headFrame(pose));
};

/** An upper arm or thigh (`upper`), or a forearm with its hand or a shin with its foot. */
const drawLimbPiece = (
  g: Graphics, piece: GibPiece, limbLook: LimbLook, upper: boolean, end?: (g: Graphics, from: Vec2, to: Vec2) => void,
): void => {
  const [a, b] = ends(piece);
  if (upper) {
    limb(g, a, b, limbLook.upperWidth[0], limbLook.upperWidth[1], limbLook.upper);
  } else {
    limb(g, a, b, limbLook.lowerWidth[0], limbLook.lowerWidth[1], limbLook.lower);
    end?.(g, a, b);
  }
};

/** Draws a gib simulation in a look (rear pieces first), with blood stumps, drops and stains. */
export const drawLookGibs = (
  sprite: Graphics, simulation: GibSimulation, look: HumanoidLook, colors: BodyColors, originY = 0, append = false,
): void => {
  if (!append) {
    sprite.clear();
    sprite.rotation = 0;
    sprite.y = originY;
  }
  simulation.stains.forEach((stain) => {
    sprite.ellipse(stain.x, GIB_GROUND_Y, stain.width, 1.6).fill({ color: colors.stain, alpha: 0.75 });
  });

  const pieces = simulation.pieces;
  const hand = (color: number, held?: HumanoidLook['heldNear']) => (g: Graphics, elbow: Vec2, wrist: Vec2): void => {
    held?.(g, elbow, wrist);
    g.circle(wrist.x, wrist.y, look.handRadius).fill({ color });
  };
  const foot = (color: number) => (g: Graphics, knee: Vec2, ankle: Vec2): void =>
    footShape(g, ankle, Math.atan2(ankle.x - knee.x, ankle.y - knee.y), look.foot.length, look.foot.height, color);
  const stumps = (piece: GibPiece): void => {
    if (piece.radius > 0) {
      return;
    }
    ends(piece).forEach((point) => sprite.circle(point.x, point.y, 2.4).fill({ color: colors.blood }));
  };

  // Far limbs, the torso, near limbs, the head.
  const order: Array<[number, () => void]> = [
    [3, () => drawLimbPiece(sprite, pieces[3], look.armFar, true)],
    [4, () => drawLimbPiece(sprite, pieces[4], look.armFar, false, hand(look.handFar, look.heldFar))],
    [7, () => drawLimbPiece(sprite, pieces[7], look.legFar, true)],
    [8, () => drawLimbPiece(sprite, pieces[8], look.legFar, false, foot(look.foot.colorFar))],
    [TORSO, () => drawTorso(sprite, pieces[TORSO], look)],
    [5, () => drawLimbPiece(sprite, pieces[5], look.leg, true)],
    [6, () => drawLimbPiece(sprite, pieces[6], look.leg, false, foot(look.foot.color))],
    [1, () => drawLimbPiece(sprite, pieces[1], look.arm, true)],
    [2, () => drawLimbPiece(sprite, pieces[2], look.arm, false, hand(look.hand, look.heldNear))],
    [HEAD, () => drawHead(sprite, pieces[HEAD], look)],
  ];
  order.forEach(([index, draw]) => {
    if (pieces[index]) {
      draw();
      stumps(pieces[index]);
    }
  });

  simulation.blood.forEach((drop) => {
    sprite.circle(drop.x, drop.y, drop.size).fill({ color: colors.blood });
  });
};
