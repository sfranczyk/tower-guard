import type { Graphics } from 'pixi.js';
import { DESIGN_GAITS, DESIGN_GROUND_Y, along, armPose, walkPose } from './designSkeleton';
import { add, boot, ellipsePoints, glow, hash, limb, mix, rockAlong, shape } from './designShapes';

/**
 * Enemy designs with a body on a walking skeleton (enemy design lab), each less of a stickman than the
 * last. `p` is the walk progress in cycles, `timeMs` drives anything that moves on its own.
 */

const xy = (point: { x: number; y: number }): [number, number] => [point.x, point.y];

/** Step 1: still the stickman's proportions, now with flesh, clothes and a face. */
export const drawRaider = (g: Graphics, p: number, timeMs: number): void => {
  const SKIN = 0xd9a074, SKIN_DARK = 0xa8754f, TUNIC = 0x7b5233, LEATHER = 0x3b2a20, WOOD = 0x8a5a32;
  const TROUSERS = 0x4f5d6e, TROUSERS_DARK = 0x3a4553, BANDANA = 0xb8383b;
  const w = walkPose(p, DESIGN_GAITS.raider);
  const { hip } = w;
  const shoulder = add(hip, 3, -35);
  const head = add(shoulder, 2, -16);
  g.clear();

  const rear = armPose(shoulder, w.swing * 0.45, 0.35, 17, 16);
  limb(g, shoulder, rear.elbow, 7, 6, SKIN_DARK);
  limb(g, rear.elbow, rear.hand, 6, 5, SKIN_DARK);
  g.circle(rear.hand.x, rear.hand.y, 3.6).fill({ color: SKIN_DARK });
  limb(g, hip, w.rearKnee, 10, 8, TROUSERS_DARK);
  limb(g, w.rearKnee, w.rearFoot, 8, 6, TROUSERS_DARK);
  boot(g, w.rearFoot, 15, 7, 0x2a1e17);

  shape(g, [add(shoulder, -8, -3), add(shoulder, 9, -3), add(hip, 12, 11), add(hip, -11, 11)], TUNIC);
  limb(g, add(hip, -10, 0), add(hip, 11, 0), 4, 4, LEATHER);
  limb(g, hip, w.frontKnee, 10, 8, TROUSERS);
  limb(g, w.frontKnee, w.frontFoot, 8, 6, TROUSERS);
  boot(g, w.frontFoot, 15, 7, LEATHER);

  limb(g, add(shoulder, 1, -2), add(head, 0, 7), 6, 6, SKIN);
  // Bandana tails flap behind the head.
  const flap = Math.sin(timeMs / 120) * 2;
  limb(g, add(head, -8, -3), add(head, -17, 1 + flap), 3, 2, BANDANA);
  limb(g, add(head, -8, -2), add(head, -15, 5 - flap), 3, 2, BANDANA);
  g.circle(head.x, head.y, 10).fill({ color: SKIN });
  shape(g, [...ellipsePoints(head, 10.6, 10.6, 16).filter((point) => point.y <= head.y - 1.5)
    .sort((a, b) => a.x - b.x)], BANDANA);
  g.circle(head.x + 5, head.y, 1.6).fill({ color: 0x2c2420 });
  shape(g, [add(head, 9, -1), add(head, 13, 3), add(head, 9, 4)], SKIN);
  limb(g, add(head, 4, 6), add(head, 8, 6), 1.5, 1.5, 0x7a4a33);

  const front = armPose(shoulder, -w.swing * 0.45 + 0.1, 0.5, 17, 16);
  const forearm = -w.swing * 0.45 + 0.6;
  limb(g, along(front.hand, forearm + 2.5, -4), along(front.hand, forearm + 2.5, 26), 4, 8, WOOD);
  limb(g, shoulder, front.elbow, 7, 6, SKIN);
  limb(g, front.elbow, front.hand, 6, 5, SKIN);
  g.circle(front.hand.x, front.hand.y, 3.8).fill({ color: SKIN });
};

/** Step 2: hunched and short-legged, with a big head, long ears and a nose: proportions no stickman has. */
export const drawGoblin = (g: Graphics, p: number, _timeMs: number): void => {
  const SKIN = 0x86b04b, DARK = 0x5f8a36, BELLY = 0x9cc463, CLOTH = 0x7a5a3a, EAR = 0xc98a7a;
  const w = walkPose(p, DESIGN_GAITS.goblin);
  const { hip } = w;
  const shoulder = add(hip, 9, -22);
  const head = add(shoulder, 10, -9);
  const flap = Math.sin(p * Math.PI * 4) * 1.5;
  g.clear();

  shape(g, [add(head, -4, -6), add(head, -24, -14 + flap), add(head, -6, 2)], DARK);
  const rear = armPose(shoulder, w.swing * 0.5 + 0.2, 0.6, 14, 13);
  limb(g, shoulder, rear.elbow, 5, 4, DARK);
  limb(g, rear.elbow, rear.hand, 4, 3.5, DARK);
  g.circle(rear.hand.x, rear.hand.y, 3).fill({ color: DARK });
  limb(g, hip, w.rearKnee, 7, 6, DARK);
  limb(g, w.rearKnee, w.rearFoot, 6, 5, DARK);
  boot(g, w.rearFoot, 14, 6, DARK);

  shape(g, [
    add(hip, -8, 4), add(hip, -9, -10), add(shoulder, -7, -3), add(shoulder, 4, -4),
    add(shoulder, 8, 4), add(hip, 11, -6), add(hip, 9, 5),
  ], SKIN);
  g.ellipse(...xy(add(mix(hip, shoulder, 0.4), 5, 0)), 5, 8).fill({ color: BELLY });
  shape(g, [add(hip, -9, 0), add(hip, 10, 0), add(hip, 8, 13), add(hip, 3, 10), add(hip, -1, 14), add(hip, -5, 10), add(hip, -9, 13)], CLOTH);
  limb(g, add(hip, -9, 0), add(hip, 10, 0), 2.5, 2.5, 0x4e3824);
  limb(g, hip, w.frontKnee, 7, 6, SKIN);
  limb(g, w.frontKnee, w.frontFoot, 6, 5, SKIN);
  boot(g, w.frontFoot, 14, 6, SKIN);

  g.circle(head.x, head.y, 12).fill({ color: SKIN });
  shape(g, [add(head, -2, -7), add(head, -22, -17 + flap), add(head, -3, 3)], SKIN);
  shape(g, [add(head, -4, -5), add(head, -17, -13 + flap), add(head, -5, 0)], EAR);
  shape(g, [add(head, 9, -4), add(head, 20, 3), add(head, 9, 3)], SKIN);
  g.circle(head.x + 5, head.y - 4, 3.2).fill({ color: 0xf2d54a });
  g.ellipse(head.x + 6, head.y - 4, 0.9, 2.2).fill({ color: 0x1b1a12 });
  limb(g, add(head, 1, -9), add(head, 9, -7), 2, 2, DARK);
  limb(g, add(head, 3, 6), add(head, 11, 5), 2.2, 2.2, 0x3a2a1e);
  shape(g, [add(head, 5, 5), add(head, 6.5, 8), add(head, 8, 5)], 0xf1ead0);

  const front = armPose(shoulder, -w.swing * 0.5 + 0.3, 0.7, 14, 13);
  const forearm = -w.swing * 0.5 + 1;
  limb(g, front.hand, along(front.hand, forearm + 0.9, 15), 3.5, 1, 0xc9ced4);
  limb(g, along(front.hand, forearm + 0.9 + Math.PI / 2, 3), along(front.hand, forearm + 0.9 - Math.PI / 2, 3), 2, 2, 0x5b4632);
  limb(g, shoulder, front.elbow, 5, 4, SKIN);
  limb(g, front.elbow, front.hand, 4, 3.5, SKIN);
  g.circle(front.hand.x, front.hand.y, 3.2).fill({ color: SKIN });
};

/** Step 3: a soldier in plate: helmet, breastplate and shield hide the body almost entirely. */
export const drawFootman = (g: Graphics, p: number, timeMs: number): void => {
  const STEEL = 0xb9c3cc, STEEL_DARK = 0x7e8995, MAIL = 0x8d96a0, MAIL_DARK = 0x666e78, TABARD = 0xa8343a, BOOT = 0x3a3433;
  const w = walkPose(p, DESIGN_GAITS.footman);
  const { hip } = w;
  const shoulder = add(hip, 2, -35);
  const head = add(shoulder, 1, -16);
  g.clear();

  // Sword arm (far side): the blade rests on the shoulder, pointing up and back.
  const sword = armPose(add(shoulder, -3, 1), 0.5 + w.swing * 0.05, 2.1, 15, 14);
  const blade = along(sword.hand, Math.PI + 0.55, 46);
  limb(g, sword.hand, blade, 5, 3, STEEL_DARK);
  limb(g, sword.hand, blade, 3, 1.5, 0xdfe5ea);
  limb(g, along(sword.hand, Math.PI + 0.55 + Math.PI / 2, 5), along(sword.hand, Math.PI + 0.55 - Math.PI / 2, 5), 2.5, 2.5, 0xc9a227);
  limb(g, add(shoulder, -3, 1), sword.elbow, 8, 7, MAIL_DARK);
  limb(g, sword.elbow, sword.hand, 7, 6, MAIL_DARK);
  g.circle(sword.hand.x, sword.hand.y, 4).fill({ color: STEEL_DARK });
  limb(g, hip, w.rearKnee, 10, 8, MAIL_DARK);
  limb(g, w.rearKnee, w.rearFoot, 8, 7, MAIL_DARK);
  boot(g, w.rearFoot, 16, 8, 0x262120);

  shape(g, [add(shoulder, -11, -3), add(shoulder, 11, -3), add(hip, 12, 14), add(hip, -12, 14)], TABARD);
  g.ellipse(...xy(mix(shoulder, hip, 0.32)), 12, 13).fill({ color: STEEL });
  g.ellipse(...xy(add(mix(shoulder, hip, 0.25), 4, -2)), 4, 6).fill({ color: 0xdfe5ea });
  limb(g, add(hip, -11, -1), add(hip, 12, -1), 4, 4, 0x3b2a20);
  limb(g, hip, w.frontKnee, 10, 8, MAIL);
  limb(g, w.frontKnee, w.frontFoot, 8, 7, MAIL);
  g.circle(w.frontKnee.x, w.frontKnee.y, 5).fill({ color: STEEL });
  boot(g, w.frontFoot, 16, 8, BOOT);

  // Plume streaming back from the crest.
  for (let i = 0; i < 4; i++) {
    const wave = Math.sin(timeMs / 140 - i * 0.9) * (1 + i * 0.6);
    g.ellipse(head.x - 2 - i * 5, head.y - 11 + i * 1.5 + wave, 5 - i * 0.6, 3.4 - i * 0.4).fill({ color: TABARD });
  }
  limb(g, add(shoulder, 0, -1), add(head, 0, 8), 9, 9, STEEL_DARK);
  g.circle(head.x, head.y, 11).fill({ color: STEEL });
  shape(g, [add(head, 3, -4), add(head, 12, -3), add(head, 12, 8), add(head, 4, 10)], STEEL_DARK);
  limb(g, add(head, 4, -1), add(head, 11, -1), 2.5, 2.5, 0x1d2329);
  g.circle(head.x - 5, head.y + 2, 1.2).fill({ color: STEEL_DARK });
  g.ellipse(shoulder.x + 1, shoulder.y + 1, 9, 7).fill({ color: STEEL });

  const shield = armPose(shoulder, 0.35 - w.swing * 0.08, 1, 16, 15);
  limb(g, shoulder, shield.elbow, 8, 7, MAIL);
  limb(g, shield.elbow, shield.hand, 7, 6, MAIL);
  const c = add(shield.hand, 5, 2);
  const kite = (grow: number) => [add(c, -12 - grow, -16 - grow), add(c, 12 + grow, -16 - grow), add(c, 12 + grow, 2), add(c, 0, 22 + grow * 1.5), add(c, -12 - grow, 2)];
  shape(g, kite(2), STEEL_DARK);
  shape(g, kite(0), TABARD);
  limb(g, add(c, 0, -12), add(c, 0, 14), 3, 3, 0xf1ead0);
  limb(g, add(c, -8, -5), add(c, 8, -5), 3, 3, 0xf1ead0);
};

/** Step 4: a hulk. Huge hunched torso, small head on the front, arms hanging to the knees. */
export const drawOrc = (g: Graphics, p: number, timeMs: number): void => {
  const SKIN = 0x6f8a5e, DARK = 0x4f6643, BELLY = 0x86a073, FUR = 0x6b4a2f, FUR_DARK = 0x4e3420, CLOTH = 0x5a3d2a;
  const w = walkPose(p, DESIGN_GAITS.orc);
  const sway = Math.sin(p * Math.PI * 2) * 1.5;
  const hip = add(w.hip, 0, 0);
  const shoulder = add(hip, 7 + sway, -38);
  const head = add(shoulder, 19, -4);
  g.clear();

  const farShoulder = add(shoulder, -4, 2);
  const rear = armPose(farShoulder, w.swing * 0.35 + 0.15, 0.3, 24, 22);
  limb(g, farShoulder, rear.elbow, 15, 12, DARK);
  limb(g, rear.elbow, rear.hand, 12, 11, DARK);
  g.circle(rear.hand.x, rear.hand.y, 8).fill({ color: DARK });
  limb(g, hip, w.rearKnee, 16, 12, DARK);
  limb(g, w.rearKnee, w.rearFoot, 12, 10, DARK);
  boot(g, w.rearFoot, 21, 9, 0x3c4d33);

  shape(g, [
    add(hip, -15, 8), add(hip, -21, -12), add(shoulder, -24, 0), add(shoulder, -15, -13), add(shoulder, 4, -13),
    add(shoulder, 21, -4), add(shoulder, 22, 8), add(hip, 17, -12), add(hip, 15, 8),
  ], SKIN);
  g.ellipse(...xy(add(mix(hip, shoulder, 0.4), 9, 0)), 12, 15).fill({ color: BELLY });
  shape(g, [add(hip, -15, 2), add(hip, 15, 2), add(hip, 13, 18), add(hip, 4, 14), add(hip, -4, 18), add(hip, -13, 14)], CLOTH);
  limb(g, add(hip, -15, 2), add(hip, 15, 2), 6, 6, 0x3b281b);
  g.circle(hip.x + 3, hip.y + 2, 4).fill({ color: 0xd9d2bc });
  limb(g, hip, w.frontKnee, 16, 12, SKIN);
  limb(g, w.frontKnee, w.frontFoot, 12, 10, SKIN);
  boot(g, w.frontFoot, 21, 9, DARK);

  limb(g, add(head, -2, -9), add(head, -14, -14 + Math.sin(timeMs / 160) * 2), 4, 2.5, 0x22261e);
  g.roundRect(head.x - 6, head.y + 1, 20, 12, 5).fill({ color: SKIN });
  g.circle(head.x, head.y, 10).fill({ color: SKIN });
  shape(g, [add(head, -6, -2), add(head, -14, -7), add(head, -7, 3)], DARK);
  limb(g, add(head, -1, -5), add(head, 10, -4), 5, 4, DARK);
  g.circle(head.x + 7, head.y - 1, 2).fill({ color: 0xd8452e });
  shape(g, [add(head, 3, 3), add(head, 5.5, -3), add(head, 7, 3)], 0xd8d0b8);
  shape(g, [add(head, 10, 3), add(head, 12.5, -4), add(head, 14, 3)], 0xf3eedf);

  const nearShoulder = add(shoulder, 8, 3);
  const front = armPose(nearShoulder, -w.swing * 0.35 + 0.15, 0.3, 24, 22);
  for (const [dx, dy, r, color] of [[-4, -5, 8, FUR_DARK], [6, -7, 8, FUR], [-2, 2, 7, FUR], [10, 1, 6, FUR_DARK]] as const) {
    g.circle(nearShoulder.x + dx, nearShoulder.y + dy, r).fill({ color });
  }
  limb(g, nearShoulder, front.elbow, 15, 12, SKIN);
  limb(g, front.elbow, front.hand, 12, 11, SKIN);
  limb(g, mix(front.elbow, front.hand, 0.5), mix(front.elbow, front.hand, 0.8), 13, 12, CLOTH);
  g.circle(front.hand.x, front.hand.y, 8.5).fill({ color: SKIN });
};

/** Step 5: a robe with no legs to see, a hood with no face, only two glowing eyes and a staff. */
export const drawCultist = (g: Graphics, p: number, timeMs: number): void => {
  const ROBE = 0x3d2b52, ROBE_DARK = 0x2a1d3a, TRIM = 0xc9a227, HAND = 0xb7b4c9, GLOW = 0xc77dff, WOOD = 0x4a3524;
  const G = DESIGN_GROUND_Y;
  const w = walkPose(p, DESIGN_GAITS.cultist);
  const { hip } = w;
  const shoulder = add(hip, 3, -34);
  const head = add(shoulder, 2, -14);
  g.clear();

  boot(g, w.rearFoot, 13, 6, 0x120b18);
  boot(g, w.frontFoot, 13, 6, 0x1c1424);
  const back = Math.min(w.frontFoot.x, w.rearFoot.x) - 12;
  const front = Math.max(w.frontFoot.x, w.rearFoot.x) + 7;
  const hem = Array.from({ length: 7 }, (_, i) => ({
    x: back + ((front - back) * i) / 6,
    y: G - 3 + Math.sin(i * 1.7 + p * Math.PI * 4) * 1.5,
  }));
  shape(g, [add(shoulder, -9, -2), add(hip, -11, 0), ...hem, add(hip, 12, -2), add(shoulder, 9, -2)], ROBE);
  for (const x of [-6, 2, 9]) {
    limb(g, add(hip, x * 0.6, 4), { x: hip.x + x * 1.3, y: G - 5 }, 1.5, 2, ROBE_DARK);
  }
  hem.slice(1).forEach((point, i) => limb(g, hem[i], point, 2.5, 2.5, TRIM));
  limb(g, add(hip, -10, -3), add(hip, 12, -4), 4, 4, TRIM);
  limb(g, add(hip, 10, -3), add(hip, 13, 12 + w.swing), 2.5, 2, TRIM);

  shape(g, [add(head, -4, -13), add(head, -17, -5), add(head, -14, 9), add(head, -2, 13), add(head, 10, 10), add(head, 13, -2), add(head, 7, -12)], ROBE);
  g.ellipse(head.x + 5, head.y + 1, 6, 8).fill({ color: 0x120b18 });
  const flicker = 0.8 + 0.2 * Math.sin(timeMs / 90) * Math.sin(timeMs / 37);
  glow(g, add(head, 4.5, -1), 1.4, GLOW, flicker);
  glow(g, add(head, 8.5, -1), 1.3, GLOW, flicker);

  const arm = armPose(shoulder, 0.5 + w.swing * 0.05, 0.9, 15, 14);
  const staffTop = add(arm.hand, 7, -46);
  const staffFoot = add(arm.hand, -3, 40);
  limb(g, staffTop, staffFoot, 3.5, 3, WOOD);
  limb(g, add(staffTop, -4, 4), add(staffTop, 0, -2), 2, 2, WOOD);
  limb(g, add(staffTop, 4, 4), add(staffTop, 1, -2), 2, 2, WOOD);
  glow(g, add(staffTop, 0, -4), 4.5, GLOW, 0.75 + 0.25 * Math.sin(timeMs / 300));
  limb(g, shoulder, arm.elbow, 9, 10, ROBE);
  limb(g, arm.elbow, arm.hand, 10, 13, ROBE);
  limb(g, along(arm.hand, 0.5 + 0.9, -2), along(arm.hand, 0.5 + 0.9, -0.5), 13, 13, TRIM);
  g.circle(arm.hand.x + 1, arm.hand.y + 1, 3.5).fill({ color: HAND });
};

/** Step 6: loose rocks held together by a glowing core; the joints are gaps with light in them. */
export const drawGolem = (g: Graphics, p: number, timeMs: number): void => {
  const STONE_LIGHT = 0xa39c8e, STONE = 0x857f73, STONE_DARK = 0x625d55, CRACK = 0x463f38, GLOW = 0xffa53a, MOSS = 0x6f8f45;
  const w = walkPose(p, DESIGN_GAITS.golem);
  const { hip } = w;
  const hover = Math.sin(timeMs / 260) * 1.5;
  const shoulder = add(hip, 4, -40);
  const headCenter = add(shoulder, 5, -19 + hover);
  const pulse = 0.75 + 0.25 * Math.sin(timeMs / 220);
  g.clear();

  const farShoulder = add(shoulder, -7, 3);
  const rear = armPose(farShoulder, w.swing * 0.35, 0.35, 22, 20);
  for (const joint of [rear.elbow, w.rearKnee]) {
    glow(g, joint, 3, GLOW, 0.5 * pulse);
  }
  rockAlong(g, farShoulder, rear.elbow, 14, STONE_DARK, 1, 4);
  rockAlong(g, rear.elbow, rear.hand, 13, STONE_DARK, 2, 4);
  shape(g, ellipsePoints(rear.hand, 9, 8, 7, 0.4, (i) => 0.85 + hash(30 + i) * 0.3), STONE_DARK);
  rockAlong(g, hip, w.rearKnee, 16, STONE_DARK, 3, 4);
  rockAlong(g, w.rearKnee, w.rearFoot, 14, STONE_DARK, 4, 4);
  shape(g, ellipsePoints(add(w.rearFoot, 4, -2), 11, 6, 7, 0, (i) => 0.9 + hash(40 + i) * 0.2), CRACK);

  for (const joint of [hip, w.frontKnee]) {
    glow(g, joint, 3, GLOW, 0.6 * pulse);
  }
  shape(g, ellipsePoints(hip, 14, 9, 7, 0, (i) => 0.85 + hash(50 + i) * 0.3), STONE_DARK);
  const chest = add(mix(hip, shoulder, 0.58), 1, 0);
  shape(g, ellipsePoints(chest, 22, 25, 9, 0.12, (i) => 0.86 + hash(10 + i) * 0.26), STONE);
  for (const [dx, dy] of [[-12, -10], [10, -14], [-9, 12], [12, 9]] as const) {
    limb(g, chest, add(chest, dx, dy), 1.6, 0.8, GLOW, pulse);
  }
  glow(g, chest, 5, GLOW, pulse);
  g.ellipse(chest.x - 6, chest.y - 21, 9, 4).fill({ color: MOSS });
  rockAlong(g, hip, w.frontKnee, 16, STONE_LIGHT, 5, 4);
  rockAlong(g, w.frontKnee, w.frontFoot, 14, STONE_LIGHT, 6, 4);
  shape(g, ellipsePoints(add(w.frontFoot, 4, -2), 11, 6, 7, 0, (i) => 0.9 + hash(60 + i) * 0.2), STONE_DARK);

  glow(g, add(shoulder, 5, -6), 2.5, GLOW, 0.4 * pulse);
  shape(g, ellipsePoints(headCenter, 10, 9, 7, -0.2, (i) => 0.85 + hash(20 + i) * 0.3), STONE_LIGHT);
  limb(g, add(headCenter, 2, -1), add(headCenter, 9, -1), 2.5, 2, GLOW, pulse);

  const nearShoulder = add(shoulder, 7, 3);
  const front = armPose(nearShoulder, -w.swing * 0.35, 0.35, 22, 20);
  glow(g, front.elbow, 3, GLOW, 0.6 * pulse);
  rockAlong(g, nearShoulder, front.elbow, 15, STONE_LIGHT, 7, 4);
  rockAlong(g, front.elbow, front.hand, 13, STONE_LIGHT, 8, 4);
  shape(g, ellipsePoints(front.hand, 10, 9, 7, 0.4, (i) => 0.85 + hash(70 + i) * 0.3), STONE_LIGHT);
  g.ellipse(nearShoulder.x - 1, nearShoulder.y - 7, 7, 3).fill({ color: MOSS });
};
