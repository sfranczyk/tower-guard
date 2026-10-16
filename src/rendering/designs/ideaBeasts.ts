import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { DESIGN_GROUND_Y, footAt, solveJoint } from './designSkeleton';
import { add, ellipsePoints, glow, limb, mix, shape } from './designShapes';

/** Beast enemy designs (enemy design lab): a spider, a warg and a flying imp. */

/** Half step of the spider's legs (its walking speed in the lab is measured against it). */
export const SPIDER_STRIDE = 7;

/** A giant spider: eight high-kneed legs in alternating sets of four, a striped abdomen, a cluster of red eyes. */
export const drawSpider = (g: Graphics, p: number, timeMs: number): void => {
  const BODY = 0x2b2530, LIGHT = 0x4a3f52, LEG = 0x221d27, LEG_FAR = 0x3b3344, MARK = 0xc0392b, EYE = 0xff4040, FANG = 0xe8e0c8;
  const G = DESIGN_GROUND_Y;
  const body = { x: 4, y: G - 26 + Math.sin(p * Math.PI * 8) * 0.8 };
  const spread = [26, 10, -6, -22];
  g.clear();

  const leg = (i: number, offset: number, shift: Vec2, color: number, width: number): void => {
    const root = { x: body.x + 6 - i * 4 + shift.x, y: body.y + 2 + shift.y };
    const step = footAt(p + offset, SPIDER_STRIDE, 8, G + shift.y);
    const foot = { x: body.x + spread[i] + step.x + shift.x, y: step.y };
    const knee = solveJoint(root, foot, 24, 30, spread[i] >= 0 ? 1 : -1);
    limb(g, root, knee, width, width * 0.8, color);
    limb(g, knee, foot, width * 0.8, 1.2, color);
  };
  // Alternating tetrapod gait: near 1 and 3 with far 2 and 4, then the others.
  [0.5, 0, 0.5, 0].forEach((offset, i) => leg(i, offset, { x: 5, y: -3 }, LEG_FAR, 3.5));

  const abdomen = add(body, -22, -6 + Math.sin(timeMs / 300) * 1);
  g.ellipse(abdomen.x, abdomen.y, 20, 16).fill({ color: BODY });
  g.ellipse(abdomen.x - 3, abdomen.y - 6, 12, 7).fill({ color: LIGHT, alpha: 0.6 });
  for (const [dx, w] of [[-8, 3], [0, 3.5], [8, 3]] as const) {
    shape(g, [add(abdomen, dx - w, -13), add(abdomen, dx + w, -13), add(abdomen, dx, -4)], MARK);
  }
  limb(g, add(abdomen, -19, 2), add(abdomen, -24, 4), 2.5, 1, LIGHT);

  g.ellipse(body.x + 2, body.y, 13, 10).fill({ color: BODY });
  g.ellipse(body.x, body.y - 4, 8, 4).fill({ color: LIGHT, alpha: 0.6 });
  const head = add(body, 14, 1);
  const chew = Math.sin(timeMs / 120) * 1.5;
  limb(g, add(head, 2, 4), add(head, 7, 11 + chew), 3, 1.2, FANG);
  limb(g, add(head, -1, 5), add(head, 3, 12 - chew), 3, 1.2, 0xbdb39b);
  g.circle(head.x, head.y, 7).fill({ color: BODY });
  for (const [dx, dy, r] of [[3, -3, 1.8], [5.5, 0, 1.6], [1, -5.5, 1.2], [5, -5, 1.1], [6.5, 2.8, 1]] as const) {
    glow(g, add(head, dx, dy), r, EYE, 0.85);
  }
  // Pedipalps feeling ahead.
  limb(g, add(head, 4, 2), add(head, 12, 2 + Math.sin(timeMs / 200) * 2), 2, 1.4, LEG);

  [0, 0.5, 0, 0.5].forEach((offset, i) => leg(i, offset, { x: 0, y: 0 }, LEG, 4));
};

/** Half step of the warg's legs. */
export const WARG_STRIDE = 11;

/** A warg: a wolf the size of a pony, trotting on diagonal pairs, hackles up, amber eyes and bared teeth. */
export const drawWarg = (g: Graphics, p: number, timeMs: number): void => {
  const FUR = 0x5e5a57, DARK = 0x403c3a, LIGHT = 0x8a847e, NOSE = 0x1c1a19, EYE = 0xffb02e, TOOTH = 0xf3eedf, MOUTH = 0x7a2a2a;
  const G = DESIGN_GROUND_Y;
  const bob = Math.cos(4 * Math.PI * p) * 1.2;
  const withers = { x: 14, y: G - 38 + bob };
  const rump = { x: -18, y: G - 35 + bob };
  g.clear();

  const frontLeg = (offset: number, shift: number, color: number): void => {
    const root = add(withers, shift, 8);
    const foot = footAt(p + offset, WARG_STRIDE, 7);
    const paw = { x: withers.x + 2 + foot.x + shift, y: foot.y };
    const lifted = (G - foot.y) / 7;
    const wrist = add(paw, -1 - lifted * 4, -7 + lifted * 2);
    const elbow = solveJoint(root, wrist, 14, 13, -1);
    limb(g, root, elbow, 9, 6, color);
    limb(g, elbow, wrist, 5, 4, color);
    limb(g, wrist, paw, 4, 4, color);
    g.ellipse(paw.x + 2, paw.y - 1.5, 4, 2).fill({ color });
  };
  const hindLeg = (offset: number, shift: number, color: number): void => {
    const root = add(rump, shift + 2, 6);
    const foot = footAt(p + offset, WARG_STRIDE, 7);
    const paw = { x: rump.x + foot.x + shift, y: foot.y };
    const hock = add(paw, -5, -12);
    const knee = solveJoint(root, hock, 14, 12, 1);
    limb(g, root, knee, 13, 7, color);
    limb(g, knee, hock, 6, 4, color);
    limb(g, hock, paw, 4, 4, color);
    g.ellipse(paw.x + 2, paw.y - 1.5, 4, 2).fill({ color });
  };
  // Trot: near front with far hind, far front with near hind.
  frontLeg(0.5, 3, DARK);
  hindLeg(0, 3, DARK);

  // Bushy tail, swaying.
  const wag = Math.sin(timeMs / 260) * 3;
  limb(g, add(rump, -4, -2), add(rump, -20, 4 + wag), 9, 7, FUR);
  limb(g, add(rump, -18, 3 + wag), add(rump, -30, 12 + wag * 1.5), 7, 3, DARK);

  shape(g, [
    add(rump, -8, -4), add(rump, 2, -7), add(withers, -6, -6), add(withers, 6, -8), add(withers, 14, -2),
    add(withers, 14, 14), add(withers, 2, 18), add(rump, 16, 10), add(rump, 2, 12), add(rump, -8, 8),
  ], FUR);
  shape(g, [add(withers, 6, 4), add(withers, 14, 2), add(withers, 13, 14), add(withers, 2, 17), add(rump, 18, 9)], LIGHT, 0.7);
  // Hackles along the back.
  for (let k = 0; k < 6; k++) {
    const base = mix(add(rump, 2, -7), add(withers, 6, -8), k / 5);
    shape(g, [add(base, -4, 1), add(base, -1, -6 - (k % 2) * 2), add(base, 2, 1)], DARK);
  }

  // Head: long muzzle, open jaw, upright ears.
  const head = add(withers, 18, -6 + Math.sin(p * Math.PI * 4 + 1) * 1);
  const jaw = 2 + Math.max(0, Math.sin(timeMs / 380)) * 3;
  limb(g, add(withers, 8, 0), add(head, -4, 4), 15, 11, FUR);
  shape(g, [add(head, -6, -4), add(head, -6, -16), add(head, 0, -6)], DARK);
  shape(g, ellipsePoints(head, 9, 8, 12), FUR);
  shape(g, [add(head, 4, -4), add(head, 20, -1), add(head, 21, 3), add(head, 4, 4)], FUR);
  shape(g, [add(head, 4, 4), add(head, 19, 3 + jaw * 0.3), add(head, 17, 6 + jaw), add(head, 3, 8)], LIGHT);
  shape(g, [add(head, 6, 4), add(head, 18, 3), add(head, 16, 4 + jaw)], MOUTH);
  for (const dx of [9, 14]) {
    shape(g, [add(head, dx, 3), add(head, dx + 1.2, 5.5), add(head, dx + 2.4, 3)], TOOTH);
  }
  g.circle(head.x + 21, head.y, 2.4).fill({ color: NOSE });
  shape(g, [add(head, -2, -6), add(head, 1, -18), add(head, 5, -5)], FUR);
  g.circle(head.x + 4, head.y - 3, 2).fill({ color: EYE });
  g.circle(head.x + 4.5, head.y - 3, 0.9).fill({ color: NOSE });
  limb(g, add(head, 1, -6), add(head, 8, -4), 2, 1.5, DARK);

  frontLeg(0, 0, FUR);
  hindLeg(0.5, 0, FUR);
};

/** A fire imp: a small horned devil on leathery wings, hovering, with a spade tail and a fireball in hand. */
export const drawImp = (g: Graphics, timeMs: number): void => {
  const SKIN = 0xc0392b, DARK = 0x8e2a20, WING = 0x5a1f1f, HORN = 0x2a2420, EYE = 0xffe14d, FIRE = 0xff8a1f;
  const G = DESIGN_GROUND_Y;
  const beat = Math.sin(timeMs / 70);
  const body = { x: 0, y: G - 46 + Math.sin(timeMs / 350) * 4 - beat * 1.5 };
  g.clear();

  g.ellipse(0, G, 11, 2.5).fill({ color: 0x000000, alpha: 0.15 });
  const wing = (root: Vec2, lift: number, color: number, alpha: number): void => {
    const tip = add(root, -14, -22 * lift);
    const mid = add(root, -24, -6 * lift);
    shape(g, [root, tip, add(mid, 2, 2), add(root, -16, 6), add(root, -6, 8)], color, alpha);
    limb(g, root, tip, 2, 1, DARK);
    limb(g, tip, mid, 1.2, 1, DARK, alpha);
  };
  wing(add(body, -1, -9), 0.6 + beat * 0.5, WING, 0.7);

  // Tail curling down behind, ending in a spade.
  const curl = Math.sin(timeMs / 240) * 3;
  let last = add(body, -4, 6);
  for (let i = 1; i <= 5; i++) {
    const next = add(body, -4 - i * 3, 6 + i * 3.5 + Math.sin(i * 0.8 + timeMs / 240) * 2 + (i === 5 ? curl : 0));
    limb(g, last, next, 2.4, 2, DARK);
    last = next;
  }
  shape(g, [add(last, -1, -2), add(last, -6, 3), add(last, 0, 7), add(last, 3, 2)], DARK);

  // Legs tucked under, toes pointed.
  limb(g, add(body, -2, 6), add(body, 2, 13), 4, 3, DARK);
  limb(g, add(body, 2, 13), add(body, -3, 19), 3, 2, DARK);
  g.ellipse(body.x, body.y, 7, 10).fill({ color: SKIN });
  g.ellipse(body.x + 2, body.y + 2, 4, 6).fill({ color: 0xd9614a });
  limb(g, add(body, 2, 6), add(body, 8, 12), 4, 3, SKIN);
  limb(g, add(body, 8, 12), add(body, 4, 19), 3, 2, SKIN);

  const head = add(body, 3, -15);
  g.circle(head.x, head.y, 8).fill({ color: SKIN });
  for (const [dx, lean] of [[-3, -3], [3, 1]] as const) {
    shape(g, [add(head, dx - 2, -5), add(head, dx + lean, -14), add(head, dx + 2.5, -5)], HORN);
  }
  shape(g, [add(head, -5, -2), add(head, -12, -6), add(head, -6, 3)], DARK);
  g.ellipse(head.x + 4, head.y - 1.5, 2.3, 1.6).fill({ color: EYE });
  g.circle(head.x + 4.6, head.y - 1.5, 0.7).fill({ color: 0x1a0d0a });
  shape(g, [add(head, 1, 3), add(head, 7, 2.5), add(head, 4, 5.5)], 0x3a0f0c);
  shape(g, [add(head, 2, 3), add(head, 3, 4.5), add(head, 4, 3)], 0xf3eedf);

  // The near arm holds up a flickering fireball.
  const hand = add(body, 13, -6);
  limb(g, add(body, 3, -6), add(body, 9, 0), 3.5, 3, SKIN);
  limb(g, add(body, 9, 0), hand, 3, 2.5, SKIN);
  const flicker = 0.85 + 0.15 * Math.sin(timeMs / 45) * Math.sin(timeMs / 23);
  glow(g, add(hand, 2, -6), 4.5 * flicker, FIRE, 0.9);
  g.circle(hand.x + 2, hand.y - 6, 2.2).fill({ color: 0xfff1b0 });
  for (let i = 0; i < 3; i++) {
    const t = ((timeMs / 500) + i / 3) % 1;
    g.circle(hand.x + 1 - t * 4, hand.y - 10 - t * 10, 1.4 * (1 - t)).fill({ color: FIRE, alpha: 1 - t });
  }

  wing(add(body, 1, -8), 0.5 + beat * 0.6, WING, 0.95);
};
