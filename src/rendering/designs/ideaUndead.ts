import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { DESIGN_GAITS, DESIGN_GROUND_Y, along, armPose, walkPose } from './designSkeleton';
import { add, boot, ellipsePoints, glow, limb, mix, shape } from './designShapes';

/** Undead enemy designs (enemy design lab): bones, bandages and a ghost. */

const xy = (point: Vec2): [number, number] => [point.x, point.y];

/** A skeleton in a rusty half-helm: bare bones, a ribcage, a chattering jaw and a notched sword. */
export const drawSkeleton = (g: Graphics, p: number, timeMs: number): void => {
  const BONE = 0xe6dfcc, BONE_DARK = 0xaea58f, IRON = 0x6e6a66, RUST = 0x8a5b3a, RAG = 0x55504a, EYE = 0x7dd8ff;
  const w = walkPose(p, DESIGN_GAITS.skeleton);
  const { hip } = w;
  const shoulder = add(hip, 3, -34);
  const head = add(shoulder, 3, -15);
  g.clear();

  const rear = armPose(shoulder, w.swing * 0.5, 0.4, 16, 15);
  limb(g, shoulder, rear.elbow, 3.2, 2.6, BONE_DARK);
  limb(g, rear.elbow, rear.hand, 2.6, 2.2, BONE_DARK);
  g.circle(rear.hand.x, rear.hand.y, 2.6).fill({ color: BONE_DARK });
  limb(g, hip, w.rearKnee, 3.6, 3, BONE_DARK);
  g.circle(w.rearKnee.x, w.rearKnee.y, 3).fill({ color: BONE_DARK });
  limb(g, w.rearKnee, w.rearFoot, 3, 2.6, BONE_DARK);
  boot(g, w.rearFoot, 11, 4, BONE_DARK);

  // Spine, ribs (curving forward and down) and a pelvis.
  for (let i = 0; i <= 6; i++) {
    const v = mix(hip, shoulder, i / 6);
    g.circle(v.x, v.y, 2.4).fill({ color: BONE });
  }
  for (let k = 0; k < 4; k++) {
    const root = mix(shoulder, hip, 0.12 + k * 0.13);
    const tip = add(root, 10 - k * 1.5, 1);
    limb(g, root, tip, 2.4, 2, BONE);
    limb(g, tip, add(tip, -1, 5 - k * 0.5), 2, 1.6, BONE);
  }
  shape(g, [add(hip, -9, 1), add(hip, 10, 0), add(hip, 8, 14 + w.swing), add(hip, 2, 10), add(hip, -3, 15), add(hip, -8, 10)], RAG);
  g.ellipse(hip.x, hip.y - 1, 8, 4.5).fill({ color: BONE });
  limb(g, hip, w.frontKnee, 3.8, 3.2, BONE);
  g.circle(w.frontKnee.x, w.frontKnee.y, 3.2).fill({ color: BONE });
  limb(g, w.frontKnee, w.frontFoot, 3.2, 2.8, BONE);
  boot(g, w.frontFoot, 11, 4, BONE);

  // Skull with a chattering jaw, glowing pinpoints in the sockets and a dented half-helm.
  const chatter = Math.max(0, Math.sin(timeMs / 70)) * 1.6;
  limb(g, shoulder, add(head, 0, 7), 2.6, 2.6, BONE);
  g.roundRect(head.x - 1, head.y + 4 + chatter, 10, 5, 2).fill({ color: BONE_DARK });
  g.circle(head.x, head.y, 9).fill({ color: BONE });
  g.roundRect(head.x + 1, head.y + 2, 9, 5, 2).fill({ color: BONE });
  g.circle(head.x + 4.5, head.y - 1, 3).fill({ color: 0x1f1d1a });
  glow(g, add(head, 4.8, -1), 0.9, EYE, 0.8 + 0.2 * Math.sin(timeMs / 110));
  shape(g, [add(head, 6.5, 3), add(head, 8, 1), add(head, 9, 3)], 0x1f1d1a);
  shape(g, [...ellipsePoints(head, 10, 10, 18).filter((point) => point.y <= head.y - 3).sort((a, b) => a.x - b.x)], IRON);
  g.circle(head.x - 3, head.y - 7, 1.6).fill({ color: RUST });

  const front = armPose(shoulder, -w.swing * 0.5 + 0.2, 0.6, 16, 15);
  const forearm = -w.swing * 0.5 + 0.8;
  const tip = along(front.hand, forearm + 0.5, 30);
  limb(g, front.hand, tip, 4, 2, RUST);
  limb(g, mix(front.hand, tip, 0.2), mix(front.hand, tip, 0.9), 2, 1, 0xb59a7f);
  limb(g, along(front.hand, forearm + 0.5 + Math.PI / 2, 4), along(front.hand, forearm + 0.5 - Math.PI / 2, 4), 2, 2, IRON);
  limb(g, shoulder, front.elbow, 3.4, 2.8, BONE);
  limb(g, front.elbow, front.hand, 2.8, 2.4, BONE);
  g.circle(front.hand.x, front.hand.y, 2.8).fill({ color: BONE });
};

/** Bandage stripes wound around the bone a → b. */
const wrapped = (g: Graphics, a: Vec2, b: Vec2, wa: number, wb: number, color: number, stripe: number): void => {
  limb(g, a, b, wa, wb, color);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  for (let t = 0.15; t < 0.95; t += 0.22) {
    const c = mix(a, b, t);
    const half = (wa + (wb - wa) * t) / 2;
    const skew = angle + Math.PI / 2 + 0.35;
    limb(g, add(c, Math.cos(skew) * half, Math.sin(skew) * half), add(c, -Math.cos(skew) * half, -Math.sin(skew) * half), 1.2, 1.2, stripe);
  }
};

/** A loose bandage end trailing from `from`, waving behind. */
const trailing = (g: Graphics, from: Vec2, length: number, timeMs: number, seed: number, color: number): void => {
  let last = from;
  for (let i = 1; i <= 5; i++) {
    const next = add(from, -(length * i) / 5, (i * i) * 0.4 + Math.sin(timeMs / 150 - i * 0.8 + seed) * i * 0.7);
    limb(g, last, next, 3, 2.6, color);
    last = next;
  }
};

/** A mummy in old linen: one arm reaching ahead, loose bandage ends trailing, a green glint in the wraps. */
export const drawMummy = (g: Graphics, p: number, timeMs: number): void => {
  const LINEN = 0xd8ccaa, LINEN_DARK = 0xa99c7c, STRIPE = 0x8c7f62, GAP = 0x2e281f, EYE = 0x9dff6a, GOLD = 0xc9a227;
  const w = walkPose(p, DESIGN_GAITS.mummy);
  const { hip } = w;
  const shoulder = add(hip, 5, -33);
  const head = add(shoulder, 4, -15);
  g.clear();

  trailing(g, add(hip, -6, 2), 18, timeMs, 0, LINEN_DARK);
  const rear = armPose(shoulder, 0.25 + w.swing * 0.08, 0.15, 16, 15);
  wrapped(g, shoulder, rear.elbow, 7, 6, LINEN_DARK, STRIPE);
  wrapped(g, rear.elbow, rear.hand, 6, 5, LINEN_DARK, STRIPE);
  wrapped(g, hip, w.rearKnee, 9, 8, LINEN_DARK, STRIPE);
  wrapped(g, w.rearKnee, w.rearFoot, 8, 6, LINEN_DARK, STRIPE);
  boot(g, w.rearFoot, 13, 6, LINEN_DARK);

  shape(g, [add(shoulder, -9, -3), add(shoulder, 10, -2), add(hip, 10, 4), add(hip, -10, 4)], LINEN);
  for (let k = 0; k < 6; k++) {
    const left = mix(add(shoulder, -9, -1), add(hip, -10, 2), k / 6 + 0.06);
    limb(g, left, add(left, 19, 4 - (k % 2) * 6), 1.4, 1.4, STRIPE);
  }
  // A torn spot shows the dark inside; a gold amulet still hangs on the chest.
  g.ellipse(...xy(add(mix(shoulder, hip, 0.6), -3, 0)), 3, 4).fill({ color: GAP });
  limb(g, add(shoulder, -2, 0), add(shoulder, 6, 8), 1, 1, GOLD);
  g.circle(shoulder.x + 6, shoulder.y + 9, 2.4).fill({ color: GOLD });
  wrapped(g, hip, w.frontKnee, 9, 8, LINEN, STRIPE);
  wrapped(g, w.frontKnee, w.frontFoot, 8, 6, LINEN, STRIPE);
  boot(g, w.frontFoot, 13, 6, LINEN);

  limb(g, shoulder, add(head, 0, 7), 7, 7, LINEN_DARK);
  g.circle(head.x, head.y, 10).fill({ color: LINEN });
  for (const dy of [-6, 4]) {
    limb(g, add(head, -9, dy + 2), add(head, 9, dy - 1), 1.4, 1.4, STRIPE);
  }
  limb(g, add(head, 0, -1), add(head, 10, -2), 3.4, 3, GAP);
  glow(g, add(head, 6, -1.5), 1.1, EYE, 0.75 + 0.25 * Math.sin(timeMs / 180));
  trailing(g, add(head, -8, -2), 14, timeMs, 2, LINEN);

  // The near arm reaches ahead, stiff and searching.
  const front = armPose(shoulder, 1.35 + Math.sin(timeMs / 400) * 0.08, 0.1, 16, 15);
  wrapped(g, shoulder, front.elbow, 7, 6, LINEN, STRIPE);
  wrapped(g, front.elbow, front.hand, 6, 5, LINEN, STRIPE);
  g.circle(front.hand.x, front.hand.y, 3.4).fill({ color: LINEN });
  trailing(g, front.elbow, 12, timeMs, 4, LINEN_DARK);
};

/** A wraith: a floating, tattered cloak with nothing inside but two cold eyes and bony hands, carrying a lantern. */
export const drawWraith = (g: Graphics, timeMs: number): void => {
  const CLOAK = 0x37404d, CLOAK_DARK = 0x262c35, HAND = 0xcfd6dc, EYE = 0x9ff3ff, FLAME = 0x7dffb0, IRON = 0x3d3a36;
  const G = DESIGN_GROUND_Y;
  const hover = Math.sin(timeMs / 420) * 3;
  const top = { x: 2, y: G - 74 + hover };
  g.clear();

  g.ellipse(0, G, 18, 3).fill({ color: 0x000000, alpha: 0.15 });
  // The hem frays into tails that stream back and fade.
  const tails = Array.from({ length: 7 }, (_, i) => {
    const x = top.x - 18 + i * 6;
    const wave = Math.sin(timeMs / 200 - i * 0.9) * 3;
    return { x: x - 6 - i * 0.5 + wave, y: G - 22 + hover + (i % 2) * 6 + wave * 0.5 };
  });
  shape(g, [add(top, -6, 0), add(top, -16, 18), ...tails, add(top, 22, 20), add(top, 12, 2)], CLOAK, 0.9);
  tails.forEach((tail, i) => {
    limb(g, tail, add(tail, -8, 6 + (i % 3) * 2), 4, 1, CLOAK, 0.5);
  });
  shape(g, [add(top, -2, 14), add(top, -10, 28), add(top, 4, 44), add(top, 14, 22)], CLOAK_DARK, 0.6);

  // Hood with darkness inside and two eyes.
  shape(g, [add(top, -10, 4), add(top, -6, -12), add(top, 6, -16), add(top, 16, -6), add(top, 18, 8), add(top, 4, 12)], CLOAK);
  g.ellipse(top.x + 9, top.y - 1, 6, 8).fill({ color: 0x0b0e12 });
  const flicker = 0.75 + 0.25 * Math.sin(timeMs / 80) * Math.sin(timeMs / 33);
  glow(g, add(top, 8, -3), 1.2, EYE, flicker);
  glow(g, add(top, 12, -3), 1.1, EYE, flicker);

  // A bony hand out of the far sleeve reaching ahead.
  const reach = add(top, 30, 14 + Math.sin(timeMs / 300) * 2);
  limb(g, add(top, 12, 10), reach, 8, 6, CLOAK_DARK);
  for (const [dx, dy] of [[6, -2], [7, 1], [6, 4]] as const) {
    limb(g, reach, add(reach, dx, dy), 1.3, 1, HAND);
  }

  // The near hand holds a swinging lantern with a ghostly flame.
  const hand = add(top, 16, 26);
  const swing = Math.sin(timeMs / 500) * 0.25;
  const lantern = along(hand, swing, 12);
  limb(g, add(top, 6, 12), hand, 9, 7, CLOAK);
  limb(g, hand, lantern, 0.8, 0.8, IRON);
  glow(g, add(lantern, 0, 6), 3.5, FLAME, 0.55 + 0.2 * Math.sin(timeMs / 70));
  g.roundRect(lantern.x - 4, lantern.y, 8, 11, 2).stroke({ width: 1.4, color: IRON });
  limb(g, add(lantern, -5, 0), add(lantern, 5, 0), 2, 2, IRON);
  for (const [dx, dy] of [[-1, 2], [1, 4.5], [0, 7]] as const) {
    limb(g, hand, add(hand, dx + 1, dy), 1.3, 1, HAND);
  }
};
