import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { DESIGN_GAITS, DESIGN_GROUND_Y, along, armPose, walkPose } from './designSkeleton';
import { add, boot, ellipsePoints, glow, hash, limb, mix, shape } from './designShapes';

/** Walking enemy designs that aren't human (enemy design lab): dwarf, lizardman, treant, mushroom. */

const xy = (point: Vec2): [number, number] => [point.x, point.y];

/** A dwarf: half a man tall and as wide, a braided beard to the belt, a nasal helm and a big axe on the shoulder. */
export const drawDwarf = (g: Graphics, p: number, _timeMs: number): void => {
  const SKIN = 0xd99b78, MAIL = 0x7f8790, MAIL_DARK = 0x5d646c, STEEL = 0xb9c3cc, BEARD = 0xc8642d, BEARD_DARK = 0x9a4a20;
  const LEATHER = 0x4a3324, BOOT = 0x2f2219, WOOD = 0x7a4f2c, SHIELD = 0x2f5d8a, GOLD = 0xd4a62a;
  const w = walkPose(p, DESIGN_GAITS.dwarf);
  const { hip } = w;
  const roll = Math.sin(p * Math.PI * 4) * 1;
  const shoulder = add(hip, 2 + roll, -24);
  const head = add(shoulder, 5, -11);
  g.clear();

  // Round shield slung on the back.
  const back = add(mix(hip, shoulder, 0.55), -12, 0);
  g.circle(back.x, back.y, 13).fill({ color: 0x3b2a1e });
  g.circle(back.x, back.y, 11).fill({ color: SHIELD });
  g.circle(back.x, back.y, 3.5).fill({ color: GOLD });

  const rear = armPose(shoulder, w.swing * 0.4 + 0.1, 0.5, 11, 11);
  limb(g, shoulder, rear.elbow, 8, 7, MAIL_DARK);
  limb(g, rear.elbow, rear.hand, 7, 6, SKIN);
  g.circle(rear.hand.x, rear.hand.y, 4).fill({ color: LEATHER });
  limb(g, hip, w.rearKnee, 10, 9, MAIL_DARK);
  limb(g, w.rearKnee, w.rearFoot, 9, 8, LEATHER);
  boot(g, w.rearFoot, 15, 8, 0x241a13);

  shape(g, [add(shoulder, -13, -3), add(shoulder, 13, -3), add(hip, 15, 9), add(hip, -14, 9)], MAIL);
  for (let k = 1; k < 4; k++) {
    const left = mix(add(shoulder, -12, 0), add(hip, -13, 6), k / 4);
    limb(g, left, add(left, 26, 0), 0.8, 0.8, MAIL_DARK);
  }
  limb(g, add(hip, -14, 0), add(hip, 15, 0), 5, 5, LEATHER);
  g.roundRect(hip.x + 2, hip.y - 3.5, 7, 7, 1.5).fill({ color: GOLD });
  limb(g, hip, w.frontKnee, 10, 9, MAIL);
  limb(g, w.frontKnee, w.frontFoot, 9, 8, LEATHER);
  boot(g, w.frontFoot, 15, 8, BOOT);

  // The axe rests on the near shoulder, its head behind (drawn under the beard).
  const front = armPose(shoulder, 0.5 - w.swing * 0.05, 1.6, 11, 11);
  const haftFoot = add(front.hand, 5, 7);
  const haftTop = add(shoulder, -18, -14);
  limb(g, haftFoot, haftTop, 3.2, 3.2, WOOD);
  const axe = mix(haftFoot, haftTop, 0.92);
  shape(g, [add(axe, 1, -2), add(axe, -10, -12), add(axe, -16, 1), add(axe, -5, 6)], STEEL);
  limb(g, add(axe, -10, -12), add(axe, -16, 1), 1.6, 1.6, 0xe4eaee);

  // Head: nose, eyes under bushy brows, the beard over the chest with two swinging braids.
  g.circle(head.x, head.y, 9).fill({ color: SKIN });
  const sway = Math.sin(p * Math.PI * 4 + 0.6) * 1.5;
  shape(g, [add(head, -4, 1), add(head, 10, 0), add(head, 12, 10), add(head, 8, 22), add(head, 2, 24), add(head, -3, 14)], BEARD);
  for (const dx of [2, 8]) {
    const end = add(head, dx + sway, 31);
    limb(g, add(head, dx, 18), end, 4, 3, BEARD_DARK);
    g.circle(end.x, end.y, 1.8).fill({ color: GOLD });
  }
  g.ellipse(head.x + 9, head.y + 1, 3.5, 3).fill({ color: 0xc9826a });
  limb(g, add(head, 2, -3), add(head, 9, -4), 2.4, 2.4, BEARD_DARK);
  g.circle(head.x + 6, head.y - 1.5, 1.4).fill({ color: 0x1f1a16 });
  shape(g, [...ellipsePoints(head, 10, 10, 18).filter((point) => point.y <= head.y - 2).sort((a, b) => a.x - b.x)], STEEL);
  limb(g, add(head, -10, -2), add(head, 10, -2), 2.4, 2.4, MAIL_DARK);
  limb(g, add(head, 8, -3), add(head, 9, 3), 2.4, 2, STEEL);

  limb(g, shoulder, front.elbow, 8, 7, MAIL);
  limb(g, front.elbow, front.hand, 7, 6, SKIN);
  g.circle(front.hand.x, front.hand.y, 4.2).fill({ color: LEATHER });
};

/** A lizardman: leaning forward on a long swaying tail, a snout with a slit eye, a frill and a bone-tipped spear. */
export const drawLizardman = (g: Graphics, p: number, timeMs: number): void => {
  const SCALE = 0x5c8f6a, DARK = 0x3f6b4e, BELLY = 0xc9c58a, FRILL = 0xd0643a, EYE = 0xf2d54a, WOOD = 0x7a5a36, BONE = 0xe8e0c8;
  const w = walkPose(p, DESIGN_GAITS.lizardman);
  const { hip } = w;
  const shoulder = add(hip, 10, -29);
  const head = add(shoulder, 9, -11);
  g.clear();

  // Tail: tapering segments swaying behind the hip.
  let last = add(hip, -4, 2);
  for (let i = 1; i <= 7; i++) {
    const next = add(hip, -4 - i * 7, 2 + i * 2.6 + Math.sin(timeMs / 220 - i * 0.6 + p * Math.PI * 2) * i * 0.5);
    limb(g, last, next, 12 - i * 1.3, 11 - i * 1.4, i % 2 ? SCALE : DARK);
    last = next;
  }

  const rear = armPose(shoulder, 0.9 + w.swing * 0.1, 0.9, 14, 13);
  limb(g, shoulder, rear.elbow, 6, 5, DARK);
  limb(g, rear.elbow, rear.hand, 5, 4, DARK);
  limb(g, hip, w.rearKnee, 11, 7, DARK);
  limb(g, w.rearKnee, w.rearFoot, 7, 5, DARK);
  const claws = (foot: Vec2, color: number): void => {
    for (const [dx, dy] of [[10, 0], [8, -2], [-4, 0]] as const) {
      limb(g, add(foot, 0, -2), add(foot, dx, dy), 3.5, 1, color);
    }
  };
  claws(w.rearFoot, DARK);

  shape(g, [add(hip, -9, 4), add(hip, -8, -8), add(shoulder, -8, -2), add(shoulder, 4, -6), add(shoulder, 9, 3), add(hip, 10, -4), add(hip, 9, 5)], SCALE);
  shape(g, [add(shoulder, 5, 0), add(hip, 10, -4), add(hip, 6, 3), add(shoulder, 0, 4)], BELLY);
  for (let k = 0; k < 4; k++) {
    const spine = mix(add(shoulder, -6, -3), add(hip, -8, -6), k / 4);
    shape(g, [spine, add(spine, -5, -4), add(spine, 1, 2)], FRILL);
  }
  shape(g, [add(hip, -9, 0), add(hip, 10, 0), add(hip, 6, 12), add(hip, -6, 12)], 0x6b4a2f);
  limb(g, hip, w.frontKnee, 11, 7, SCALE);
  limb(g, w.frontKnee, w.frontFoot, 7, 5, SCALE);
  claws(w.frontFoot, SCALE);

  // Neck frill that flares now and then, the long snout and a slit eye.
  const flare = Math.max(0, Math.sin(timeMs / 600)) ** 4;
  for (let k = 0; k < 5; k++) {
    const angle = Math.PI * (0.75 + k * 0.18);
    const r = 9 + flare * 6;
    shape(g, [add(head, -3, 3), add(head, -3 + Math.cos(angle) * r, 3 + Math.sin(angle) * r), add(head, -3 + Math.cos(angle + 0.25) * r * 0.8, 3 + Math.sin(angle + 0.25) * r * 0.8)], FRILL);
  }
  limb(g, shoulder, add(head, -2, 4), 8, 7, SCALE);
  g.ellipse(head.x, head.y, 8, 7).fill({ color: SCALE });
  shape(g, [add(head, 2, -5), add(head, 19, -1), add(head, 20, 3), add(head, 4, 6)], SCALE);
  limb(g, add(head, 6, 3), add(head, 19, 2), 1.2, 1.2, DARK);
  g.circle(head.x + 2, head.y - 2, 2.6).fill({ color: EYE });
  g.ellipse(head.x + 2.3, head.y - 2, 0.7, 2.1).fill({ color: 0x14140c });
  g.circle(head.x + 17, head.y - 1, 0.8).fill({ color: DARK });

  // The spear is held in both hands, point forward.
  const front = armPose(shoulder, 1.15 - w.swing * 0.06, 0.5, 14, 13);
  const dir = { x: Math.cos(-0.12), y: Math.sin(-0.12) };
  const butt = add(front.hand, -dir.x * 38, -dir.y * 38);
  const point = add(front.hand, dir.x * 34, dir.y * 34);
  limb(g, butt, point, 2.6, 2.6, WOOD);
  shape(g, [add(point, 0, -3.5), add(point, 11, 0), add(point, 0, 3.5)], BONE);
  limb(g, add(point, -1, -2), add(point, 1, 2), 2, 2, FRILL);
  limb(g, shoulder, front.elbow, 6, 5, SCALE);
  limb(g, front.elbow, front.hand, 5, 4, SCALE);
  g.circle(front.hand.x, front.hand.y, 3.4).fill({ color: SCALE });
};

/** A treant: a walking tree with root feet, a face of knots and hollows, branch arms and a swaying crown. */
export const drawTreant = (g: Graphics, p: number, timeMs: number): void => {
  const BARK = 0x6b4a2e, BARK_DARK = 0x4a3220, GROOVE = 0x3a2717, LEAF = 0x4f8a3a, LEAF_DARK = 0x3a6b2c, LEAF_LIGHT = 0x6fae4f, EYE = 0xd8f27a;
  const G = DESIGN_GROUND_Y;
  const w = walkPose(p, DESIGN_GAITS.treant);
  const { hip } = w;
  const sway = Math.sin(timeMs / 700) * 2 + Math.sin(p * Math.PI * 2) * 1.5;
  const shoulder = add(hip, 3, -40);
  const crown = add(shoulder, -2 + sway, -24);
  g.clear();

  const roots = (foot: Vec2, color: number): void => {
    for (const [dx, dy] of [[12, 1], [6, 2], [-8, 1]] as const) {
      limb(g, add(foot, 0, -3), { x: foot.x + dx, y: Math.min(G, foot.y + dy) }, 5, 1.5, color);
    }
  };
  const farCanopy = [[-18, 6, 13], [-8, -6, 14], [14, 4, 12]] as const;
  for (const [dx, dy, r] of farCanopy) {
    g.circle(crown.x + dx, crown.y + dy, r).fill({ color: LEAF_DARK });
  }
  const branch = (from: Vec2, angle: number, bend: number, color: number): void => {
    const arm = armPose(from, angle, bend, 20, 18);
    limb(g, from, arm.elbow, 10, 7, color);
    limb(g, arm.elbow, arm.hand, 7, 4, color);
    for (const fork of [-0.6, 0, 0.5]) {
      limb(g, arm.hand, along(arm.hand, angle + bend + fork, 8), 3, 1, color);
    }
    limb(g, mix(from, arm.elbow, 0.6), along(mix(from, arm.elbow, 0.6), angle - 1.3, 9), 3, 1, color);
    g.circle(...xy(along(mix(from, arm.elbow, 0.6), angle - 1.3, 9)), 4).fill({ color: LEAF_DARK });
  };
  branch(add(shoulder, -5, 12), w.swing * 0.3 + 0.2, 0.4, BARK_DARK);
  limb(g, hip, w.rearKnee, 14, 11, BARK_DARK);
  limb(g, w.rearKnee, w.rearFoot, 11, 9, BARK_DARK);
  roots(w.rearFoot, BARK_DARK);

  shape(g, [add(hip, -13, 6), add(hip, -12, -14), add(shoulder, -15, 4), add(crown, -10, 12), add(crown, 10, 10), add(shoulder, 14, 2), add(hip, 13, -10), add(hip, 12, 6)], BARK);
  for (const [dx, seed] of [[-7, 1], [0, 2], [7, 3]] as const) {
    limb(g, add(hip, dx, 2), add(shoulder, dx * 1.1 + (hash(seed) - 0.5) * 4, 0), 1.6, 1.2, GROOVE);
  }
  // Face: two hollows with a dim glow and a knot of a mouth.
  const face = add(shoulder, 2, -1);
  g.ellipse(face.x, face.y, 3.5, 4.5).fill({ color: GROOVE });
  g.ellipse(face.x + 7, face.y, 3, 4).fill({ color: GROOVE });
  const blink = timeMs % 4000 < 160 ? 0.15 : 0.8;
  glow(g, add(face, 0, 0.5), 1.1, EYE, blink);
  glow(g, add(face, 7, 0.5), 1, EYE, blink);
  g.ellipse(face.x + 4, face.y + 9, 4, 2.5 + Math.max(0, Math.sin(timeMs / 900)) * 1.5).fill({ color: GROOVE });
  limb(g, hip, w.frontKnee, 14, 11, BARK);
  limb(g, w.frontKnee, w.frontFoot, 11, 9, BARK);
  roots(w.frontFoot, BARK);

  for (const [dx, dy, r, color] of [[-12, -4, 12, LEAF], [2, -12, 14, LEAF], [8, 2, 10, LEAF], [-4, 2, 9, LEAF_LIGHT], [6, -12, 7, LEAF_LIGHT]] as const) {
    g.circle(crown.x + dx, crown.y + dy, r).fill({ color });
  }
  // A leaf drifting down now and then.
  const fall = (timeMs % 2600) / 2600;
  const leaf = { x: crown.x - 6 - fall * 20 + Math.sin(fall * 12) * 4, y: crown.y + 10 + fall * (G - crown.y - 10) };
  g.ellipse(leaf.x, leaf.y, 2.5, 1.5).fill({ color: LEAF_LIGHT, alpha: 1 - fall * 0.5 });

  branch(add(shoulder, 6, 12), -w.swing * 0.3 + 0.35, 0.5, BARK);
};

/** A mushroom man: knee-high, a stalk body with stubby limbs, a big spotted cap that bobs and puffs of spores. */
export const drawMyconid = (g: Graphics, p: number, timeMs: number): void => {
  const STALK = 0xeee3c8, STALK_DARK = 0xc2b493, CAP = 0xc23b32, CAP_DARK = 0x8e2a24, SPOT = 0xf6efe0, GILL = 0xb59f86, SPORE = 0xd9e89a;
  const w = walkPose(p, DESIGN_GAITS.myconid);
  const { hip } = w;
  // The cap lags the body a little, so it bobs on every step.
  const bob = Math.cos(4 * Math.PI * p - 0.8) * 1.5;
  const neck = add(hip, 2, -16);
  const cap = add(neck, 1, -8 + bob);
  g.clear();

  const rear = armPose(add(neck, -2, 3), w.swing * 0.6 + 0.3, 0.4, 7, 7);
  limb(g, add(neck, -2, 3), rear.elbow, 4, 3.5, STALK_DARK);
  limb(g, rear.elbow, rear.hand, 3.5, 3, STALK_DARK);
  limb(g, hip, w.rearKnee, 6, 5, STALK_DARK);
  limb(g, w.rearKnee, w.rearFoot, 5, 4.5, STALK_DARK);
  boot(g, w.rearFoot, 8, 5, STALK_DARK);

  shape(g, [add(hip, -8, 4), add(hip, -7, -6), add(neck, -6, 0), add(neck, 6, 0), add(hip, 8, -6), add(hip, 9, 4)], STALK);
  g.ellipse(hip.x, hip.y + 1, 9, 5).fill({ color: STALK });
  limb(g, add(neck, -6, 4), add(neck, 6, 5), 2, 2, STALK_DARK);
  limb(g, hip, w.frontKnee, 6, 5, STALK);
  limb(g, w.frontKnee, w.frontFoot, 5, 4.5, STALK);
  boot(g, w.frontFoot, 8, 5, STALK);

  // Face on the stalk, just under the cap.
  g.circle(neck.x + 4, neck.y + 1, 1.5).fill({ color: 0x2a2018 });
  g.circle(neck.x + 7.5, neck.y + 1, 1.3).fill({ color: 0x2a2018 });
  g.ellipse(neck.x + 6, neck.y + 5, 1.6, 1).fill({ color: 0x7a4a33 });

  const dome = Array.from({ length: 17 }, (_, k) => {
    const a = Math.PI + (Math.PI * k) / 16;
    return { x: cap.x + Math.cos(a) * 22, y: cap.y + Math.sin(a) * 16 };
  });
  g.ellipse(cap.x, cap.y, 21, 4).fill({ color: GILL });
  for (let k = -3; k <= 3; k++) {
    limb(g, add(cap, k * 5, 0), add(cap, k * 3.5, 3), 0.8, 0.8, CAP_DARK);
  }
  shape(g, dome, CAP);
  shape(g, dome.slice(9).map((point) => mix(point, add(cap, 0, -2), 0.25)).concat([add(cap, 6, -1)]), CAP_DARK, 0.4);
  for (const [dx, dy, r] of [[-12, -5, 3.5], [-2, -12, 3], [9, -7, 4], [16, -2, 2]] as const) {
    g.circle(cap.x + dx, cap.y + dy, r).fill({ color: SPOT });
  }

  // Spores puff up off the cap and fade.
  for (let i = 0; i < 4; i++) {
    const t = ((timeMs / 1400) + i / 4) % 1;
    const spore = add(cap, -16 + i * 9 - t * 10, -14 - t * 18);
    g.circle(spore.x, spore.y, 1.4 + t * 1.6).fill({ color: SPORE, alpha: 0.7 * (1 - t) });
  }

  const front = armPose(add(neck, 3, 3), -w.swing * 0.6 + 0.3, 0.4, 7, 7);
  limb(g, add(neck, 3, 3), front.elbow, 4, 3.5, STALK);
  limb(g, front.elbow, front.hand, 3.5, 3, STALK);
  g.circle(front.hand.x, front.hand.y, 2.2).fill({ color: STALK });
};
