import type { Graphics } from 'pixi.js';
import type { KeepDamage, KeepTones } from './keepStyle';

/**
 * The keep in the flat landscape style, drawn in the 200×406 space of the old pixel-art tower.svg
 * (same silhouette: tall tower on a gatehouse between two walls, on a plinth; bottom centre at
 * (100, 404)). No outlines or brick pattern: base tone, lit left edges, shaded right side and a few
 * soft blocks. Damage stages add cracks, knock off merlons, tear banners, drop rubble and finally
 * burn a flag (smoke and fire flicker are animated by Tower).
 */

export const KEEP_WIDTH = 200;
export const KEEP_HEIGHT = 406;
/** Where the bottom centre sits in drawing space. */
export const KEEP_BASE = { x: 100, y: 404 } as const;
/** Arrow slit that catches fire at the last stage (drawing space). */
export const KEEP_FIRE_SPOT = { x: 98, y: 127 } as const;
/** Above the top merlons, where smoke rises from. */
export const KEEP_SMOKE_SPOT = { x: 102, y: 18 } as const;
/** Co-op keep: the lower second tower in place of the right wall: its sides, shaft top and cornice top (drawing space). */
export const KEEP_TURRET = { left: 146, right: 194, top: 196, cornice: 184 } as const;

const PENNANT = [0x8a2a3c, 0xb04a5e] as const;
const PLAYER_BANNER = [0x34489f, 0x24357a] as const;
const ENEMY_BANNER = [0x9a2c37, 0x6e1f28] as const;
const BANNER_EMBLEM = 0xe2b44c;
const WOOD = [0x8a6238, 0x6b4a2e, 0x5a3c23] as const;
const IRON = 0x4c4c55;

export interface KeepLook {
  tones: KeepTones;
  enemy: boolean;
  damage: KeepDamage;
  /** Co-op: a second, lower tower rises where the right wall is (one for each bowman to hide in). */
  twin?: boolean;
}

export const drawKeep = (g: Graphics, { tones: t, enemy, damage, twin = false }: KeepLook): void => {
  g.clear();
  const rect = (x: number, y: number, w: number, h: number, color: number, radius = 2, alpha = 1): void => {
    g.roundRect(x, y, w, h, radius).fill({ color, alpha });
  };
  const banner = enemy ? ENEMY_BANNER : PLAYER_BANNER;

  // Pennants on poles (the right one burns away at the last stage).
  const pennant = (x: number): void => {
    rect(x, 4, 3, 24, t.deep, 1.5);
    g.poly([x + 3, 6, x + 18, 6, x + 13, 11, x + 19, 16, x + 3, 16]).fill({ color: PENNANT[0] });
    rect(x + 3, 7, 9, 3, PENNANT[1], 1);
  };
  pennant(63);
  if (damage < 3) {
    pennant(135);
  }

  // Side walls with merlons; some merlons are knocked off as damage grows.
  const sideWall = (x: number, merlons: number[]): void => {
    merlons.forEach((mx) => rect(mx, 290, 9, 11, t.cap));
    rect(x, 300, 46, 72, t.base, 3);
    rect(x + 32, 300, 14, 72, t.shade, 3);
    rect(x, 300, 46, 7, t.cap);
    rect(x + 2, 307, 4, 63, t.light);
  };
  sideWall(12, [12, 25, 38, 50].filter((_, index) => !(damage >= 2 && index === 2)));
  if (twin) {
    // Second, lower tower: shaft, a slit, a cornice and merlons (two knocked off as damage grows).
    const { left, right, top } = KEEP_TURRET;
    const width = right - left;
    [left - 3, left + 10, left + 23, left + 36].forEach((x, index) => {
      if (!((damage >= 2 && index === 1) || (damage >= 3 && index === 3))) {
        rect(x, top - 24, 10, 12, t.cap);
      }
    });
    rect(left - 4, KEEP_TURRET.cornice, width + 8, top - KEEP_TURRET.cornice, t.cap, 3);
    for (let x = left; x <= right - 6; x += 10) {
      rect(x, top - 7, 4, 5, t.deep, 1.5, 0.75);
    }
    rect(left, top, width, 372 - top, t.base, 3);
    rect(left + 2, top + 2, 5, 372 - top - 4, t.light, 3);
    rect(right - 16, top + 2, 14, 372 - top - 4, t.shade, 3);
    [[left + 10, top + 30, 14], [left + 18, top + 74, 10]].forEach(([x, y, w]) => rect(x, y, w, 6, t.light, 2, 0.45));
    rect(left + 20, top + 42, 7, 18, t.deep, 3.5);
    if (damage >= 2) {
      g.poly([right - 10, top + 12, right - 16, top + 24, right - 11, top + 34, right - 17, top + 46], false)
        .stroke({ width: 2.4, color: t.deep, cap: 'round', join: 'round' });
    }
  } else {
    sideWall(142, [142, 155, 168, 180].filter((_, index) => !(damage >= 3 && (index === 0 || index === 3))));
  }

  // Tower shaft with soft blocks instead of bricks, and arrow slits.
  rect(62, 70, 76, 208, t.base, 3);
  rect(64, 72, 7, 204, t.light, 3);
  rect(112, 72, 24, 204, t.shade, 3);
  [[78, 96, 16], [96, 130, 12], [74, 168, 14], [92, 204, 18], [80, 240, 12], [100, 252, 10]]
    .forEach(([x, y, w]) => rect(x, y, w, 7, t.light, 2, 0.45));
  [[118, 110, 10], [120, 190, 12]].forEach(([x, y, w]) => rect(x, y, w, 7, t.deep, 2, 0.25));
  rect(94, 120, 8, 22, t.deep, 4);
  rect(94, 196, 8, 22, t.deep, 4);

  // Cornice with slots.
  rect(56, 56, 88, 14, t.cap, 3);
  for (let x = 60; x <= 130; x += 10) {
    rect(x, 62, 4, 6, t.deep, 1.5, 0.75);
  }
  // Top block outline, clockwise; corners are knocked out at stages 2 (right) and 3 (left).
  const top: number[] = damage >= 3 ? [64, 36] : [52, 36];
  top.push(...(damage >= 2 ? [138, 36, 138, 44, 142, 51, 148, 48] : [148, 36]), 148, 56, 52, 56);
  top.push(...(damage >= 3 ? [52, 48, 58, 50, 66, 46] : []));
  g.poly(top).fill({ color: t.base });
  rect(54, 38, damage >= 2 ? 82 : 92, 4, t.light);
  rect(118, 38, damage >= 2 ? 18 : 28, 16, t.shade);
  // Top merlons: the first is chipped at stage 1; two go at stage 2, the last at stage 3.
  [52, 68, 84, 100, 116, 132].forEach((x, index) => {
    if ((damage >= 2 && (index === 1 || index === 4)) || (damage >= 3 && (index === 5 || index === 0))) {
      return;
    }
    const chipped = damage >= 1 && index === 0;
    rect(x, chipped ? 29 : 24, 10, chipped ? 7 : 12, t.cap);
  });

  // Lower ring of merlons and band.
  [56, 72, 88, 104, 120, 134].forEach((x, index) => {
    if (!(damage >= 3 && index === 2)) {
      rect(x, 276, 10, 10, t.cap);
    }
  });
  rect(56, 286, 88, 12, t.cap, 3);
  rect(118, 288, 24, 8, t.shade);

  // Gatehouse, arched gate.
  rect(58, 298, 84, 74, t.base, 3);
  rect(116, 300, 24, 70, t.shade, 3);
  rect(60, 302, 4, 68, t.light);
  g.moveTo(80, 372).lineTo(80, 332).arc(100, 332, 20, Math.PI, 0).lineTo(120, 372).closePath().fill({ color: t.light });
  g.moveTo(83, 372).lineTo(83, 333).arc(100, 333, 17, Math.PI, 0).lineTo(117, 372).closePath().fill({ color: WOOD[1] });
  rect(91, 320, 2.5, 52, WOOD[2], 1);
  rect(100, 318, 2.5, 54, WOOD[2], 1);
  rect(109, 320, 2.5, 52, WOOD[2], 1);
  rect(84, 341, 32, 3, IRON, 1.5);
  rect(84, 359, 32, 3, IRON, 1.5);

  // Banners on the side walls (torn from stage 2).
  const drawBanner = (x: number): void => {
    rect(x - 3, 312, 24, 3, t.deep, 1.5);
    if (damage >= 2) {
      g.poly([x, 315, x + 18, 315, x + 18, 339, x + 14, 344, x + 11, 340, x + 8, 346, x + 5, 341, x, 345]).fill({ color: banner[0] });
      return;
    }
    g.poly([x, 315, x + 18, 315, x + 18, 352, x + 9, 360, x, 352]).fill({ color: banner[0] });
    rect(x + 2, 317, 4, 34, banner[1], 1.5, 0.55);
    g.circle(x + 9, 331, 4).fill({ color: BANNER_EMBLEM });
  };
  drawBanner(30);
  drawBanner(twin ? 161 : 152);

  // Torch (its flame is animated by Tower), crates and a barrel.
  rect(129, 333, 3, 11, WOOD[2], 1);
  rect(127, 330, 7, 4, t.deep, 1.5);
  rect(62, 358, 14, 14, WOOD[0]);
  rect(66, 346, 12, 12, WOOD[0]);
  g.moveTo(64, 360).lineTo(74, 370).moveTo(74, 360).lineTo(64, 370)
    .moveTo(68, 348).lineTo(76, 356).moveTo(76, 348).lineTo(68, 356)
    .stroke({ width: 2, color: WOOD[2], cap: 'round' });
  rect(124, 362, 16, 10, WOOD[0], 3);
  rect(124, 365.5, 16, 2, IRON, 1);

  // Plinth.
  rect(4, 372, 192, 32, t.cap, 4);
  rect(6, 374, 188, 4, t.light);
  rect(100, 378, 94, 24, t.shade, 3, 0.55);

  // Damage: cracks and rubble.
  const crack = (points: number[]): void => {
    g.poly(points, false).stroke({ width: 2.4, color: t.deep, cap: 'round', join: 'round' });
  };
  if (damage >= 1) {
    crack([88, 70, 92, 84, 87, 94, 93, 106]);
    crack([126, 300, 121, 312, 125, 321]);
  }
  if (damage >= 2) {
    crack([70, 150, 78, 160, 75, 172, 84, 186, 80, 196]);
    crack([118, 228, 112, 238, 117, 246, 110, 258]);
    crack([24, 300, 29, 314, 25, 326]);
    [[44, 398, 7], [54, 401, 5], [152, 399, 6], [162, 402, 4], [36, 402, 4]]
      .forEach(([x, y, size]) => rect(x, y - size, size, size, t.cap, 1.5));
  }
  if (damage >= 3) {
    crack([100, 300, 97, 314, 103, 324, 99, 340]);
    crack([60, 90, 70, 108, 68, 124, 76, 136]);
  }
};
