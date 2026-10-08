import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { DESIGN_GROUND_Y, footAt, solveJoint } from './designSkeleton';
import { add, limb, shape } from './designShapes';

/** Enemy designs with no human skeleton at all (enemy design lab). */

/** Half step of the beetle's legs (its walking speed in the lab is measured against it). */
export const BEETLE_STRIDE = 8;

/** Step 7: a beetle the size of a man, six legs in a tripod gait (three on the ground at a time). */
export const drawBeetle = (g: Graphics, p: number, timeMs: number): void => {
  const SHELL = 0x2e6b5e, SHELL_LIGHT = 0x5fb39c, SHELL_DARK = 0x1f4a41, LEG = 0x1d2b28, LEG_FAR = 0x34463f;
  const HEAD = 0x1f3b35, EYE = 0xffb347;
  const G = DESIGN_GROUND_Y;
  const body = { x: -4, y: G - 27 + Math.sin(p * Math.PI * 6) * 0.8 };
  const attach = [16, 0, -16];
  const spread = [15, 0, -14];
  g.clear();

  const leg = (i: number, offset: number, shift: Vec2, color: number): void => {
    const root = { x: body.x + attach[i] + shift.x, y: body.y + 8 + shift.y };
    const step = footAt(p + offset, BEETLE_STRIDE, 7, G + shift.y);
    const foot = { x: root.x + spread[i] + step.x, y: step.y };
    const knee = solveJoint(root, foot, 17, 21, spread[i] >= 0 ? 1 : -1);
    limb(g, root, knee, 4.5, 3.5, color);
    limb(g, knee, foot, 3.5, 2, color);
    limb(g, foot, add(foot, 4, 0), 2, 1, color);
  };
  // Tripod gait: near front and rear with the far middle, then the other three.
  [0.5, 0, 0.5].forEach((offset, i) => leg(i, offset, { x: 4, y: -2 }, LEG_FAR));

  g.ellipse(body.x, body.y + 6, 30, 9).fill({ color: SHELL_DARK });
  const head = add(body, 35, 4);
  const open = 2 + 2 * Math.sin(timeMs / 170);
  limb(g, add(head, 3, -8), add(head, 15, -25 + Math.sin(timeMs / 230) * 2), 1.6, 1.2, LEG);
  limb(g, add(head, 0, -8), add(head, 7, -27 + Math.sin(timeMs / 260 + 1) * 2), 1.6, 1.2, LEG_FAR);
  limb(g, add(head, 7, 3), add(head, 17, 1 - open), 3.5, 1.5, LEG);
  limb(g, add(head, 7, 6), add(head, 17, 8 + open), 3.5, 1.5, LEG);
  g.circle(head.x, head.y, 11).fill({ color: HEAD });
  g.circle(head.x + 5, head.y - 3, 2.6).fill({ color: EYE });
  g.ellipse(body.x + 24, body.y + 1, 11, 12).fill({ color: SHELL_DARK });

  const dome = (rx: number, ry: number, center: Vec2): Vec2[] => Array.from({ length: 17 }, (_, k) => {
    const a = Math.PI + (Math.PI * k) / 16;
    return { x: center.x + Math.cos(a) * rx, y: center.y + Math.sin(a) * ry };
  });
  shape(g, dome(33, 25, add(body, -4, 5)), SHELL);
  shape(g, dome(22, 13, add(body, -8, -5)), SHELL_LIGHT, 0.45);
  for (const [dx, dy, r] of [[-20, -4, 3.5], [-6, -12, 4], [8, -6, 3]] as const) {
    g.circle(body.x + dx, body.y + dy, r).fill({ color: SHELL_DARK });
  }

  [0, 0.5, 0].forEach((offset, i) => leg(i, offset, { x: 0, y: 0 }, LEG));
};

/** One hop of the slime, in ms. */
export const SLIME_HOP_MS = 1100;

/** Step 8: no skeleton at all, a hopping blob of slime with what it has swallowed showing inside. */
export const drawSlime = (g: Graphics, timeMs: number): void => {
  const G = DESIGN_GROUND_Y;
  const t = (timeMs % SLIME_HOP_MS) / SLIME_HOP_MS;
  let height = 0;
  let squash = 0;
  let airborne = 0;
  if (t < 0.25) {
    squash = 0.28 * Math.sin(Math.PI * (t / 0.25));
  } else if (t < 0.8) {
    airborne = (t - 0.25) / 0.55;
    height = 40 * Math.sin(Math.PI * airborne);
    squash = -0.18 * Math.cos(Math.PI * airborne);
  } else {
    squash = 0.25 * Math.sin(Math.PI * ((t - 0.8) / 0.2));
  }
  const sy = 1 - squash;
  const sx = 1 + squash * 0.7;
  const base = { x: 0, y: G - height };
  const wobble = timeMs / 140;
  g.clear();

  g.ellipse(0, G, 27 * (1 - height / 90), 4).fill({ color: 0x000000, alpha: 0.22 });
  const outline = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const s = Math.sin(a);
    const x = Math.cos(a) * 27 * sx * (1 + 0.035 * Math.sin(3 * a + wobble));
    const y = s < 0 ? s * 34 * sy * (1 + 0.04 * Math.sin(2 * a - wobble)) : s * 5 * sy;
    return { x: base.x + x, y: base.y + y - 5 * sy };
  });

  // What it swallowed: a skull and an arrow, tinted by the slime drawn over them.
  const skull = add(base, -7, -17 * sy);
  g.circle(skull.x, skull.y, 6.5).fill({ color: 0xe9e4d4 });
  g.roundRect(skull.x - 3, skull.y + 3, 7, 5, 2).fill({ color: 0xe9e4d4 });
  g.circle(skull.x + 2.5, skull.y - 1, 1.8).fill({ color: 0x3b3b3b });
  limb(g, add(base, -24, -30 * sy), add(base, 6, -5 * sy), 1.6, 1.6, 0x8a5a32);
  shape(g, [add(base, -24, -30 * sy), add(base, -28, -29 * sy), add(base, -25, -34 * sy)], 0xd8d0b8);

  shape(g, outline, 0x4cc79a, 0.72);
  shape(g, outline.map((point) => ({ x: base.x + (point.x - base.x) * 0.8, y: base.y - 3 + (point.y - base.y) * 0.8 })), 0x3aa883, 0.3);
  g.ellipse(base.x - 10, base.y - 27 * sy, 7, 4).fill({ color: 0xffffff, alpha: 0.55 });
  g.circle(base.x - 3, base.y - 30 * sy, 1.8).fill({ color: 0xffffff, alpha: 0.6 });

  const blink = timeMs % 3200 < 130;
  for (const eye of [add(base, 9, -22 * sy), add(base, 18, -21 * sy)]) {
    if (blink) {
      limb(g, add(eye, -3.5, 0), add(eye, 3.5, 0), 1.6, 1.6, 0x17402f);
    } else {
      g.ellipse(eye.x, eye.y, 4, 5).fill({ color: 0xffffff });
      g.circle(eye.x + 1.4, eye.y + 0.5, 2).fill({ color: 0x17402f });
    }
  }
  limb(g, add(base, 12, -12 * sy), add(base, 20, -13 * sy), 2, 2, 0x1e5c45);

  if (airborne > 0) {
    for (const [dx, delay] of [[-14, 0], [6, 0.15]] as const) {
      const drop = Math.max(0, airborne - delay);
      g.circle(base.x + dx, base.y + 3 + drop * 10, 2 * (1 - drop)).fill({ color: 0x4cc79a, alpha: 0.7 });
    }
  }
};
