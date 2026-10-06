import { Graphics } from 'pixi.js';
import { GAME_HEIGHT, GROUND_Y, WORLD_WIDTH } from '../config';
import type { Battleground } from '../data/battlegrounds';

/** Far and near hills (or lower, smoother dunes) between the sky and the ground. */
export const drawHills = ({ hills: [far, near], hillShape }: Battleground): Graphics => {
  const hills = new Graphics();
  if (hillShape === 'dunes') {
    hills.moveTo(0, 405).bezierCurveTo(160, 360, 300, 372, 430, 392)
      .bezierCurveTo(600, 418, 760, 340, 940, 362)
      .bezierCurveTo(1060, 376, 1130, 388, WORLD_WIDTH, 380)
      .lineTo(WORLD_WIDTH, GAME_HEIGHT).lineTo(0, GAME_HEIGHT).closePath().fill({ color: far });
    hills.moveTo(0, 448).bezierCurveTo(140, 418, 290, 422, 420, 440)
      .bezierCurveTo(560, 460, 700, 408, 860, 424)
      .bezierCurveTo(1000, 438, 1110, 452, WORLD_WIDTH, 436)
      .lineTo(WORLD_WIDTH, GAME_HEIGHT).lineTo(0, GAME_HEIGHT).closePath().fill({ color: near });
  } else if (hillShape === 'mountains') {
    drawMountains(hills, far, near);
  } else {
    hills.moveTo(0, 360).bezierCurveTo(180, 250, 310, 340, 480, 275)
      .bezierCurveTo(650, 215, 820, 330, WORLD_WIDTH, 245)
      .lineTo(WORLD_WIDTH, GAME_HEIGHT).lineTo(0, GAME_HEIGHT).closePath().fill({ color: far });
    hills.moveTo(0, 412).bezierCurveTo(190, 320, 390, 390, 570, 330)
      .bezierCurveTo(760, 270, 900, 390, WORLD_WIDTH, 312)
      .lineTo(WORLD_WIDTH, GAME_HEIGHT).lineTo(0, GAME_HEIGHT).closePath().fill({ color: near });
  }
  hills.zIndex = 0;
  return hills;
};

/** Peaks of the far range: x, summit y. Valleys sit between them at VALLEY_Y. */
const PEAKS: ReadonlyArray<[number, number]> = [[60, 210], [230, 150], [400, 225], [560, 135], [730, 205], [900, 160], [1060, 215], [1190, 175]];
const VALLEY_Y = 300;
const SNOW = 0xf2f5f8;
const MIST = 0xeef3f7;

/** A soft mist band: thin strips whose opacity rises to `alpha` in the middle and fades out at the edges. */
const drawMist = (g: Graphics, top: number, height: number, alpha: number): void => {
  const strips = 8;
  for (let index = 0; index < strips; index += 1) {
    const t = (index + 0.5) / strips;
    g.rect(0, top + (index * height) / strips, WORLD_WIDTH, height / strips + 0.5).fill({ color: MIST, alpha: alpha * Math.sin(Math.PI * t) });
  }
};

/** Snow-capped far peaks, mist, then lower rocky slopes in front with a second mist band. */
const drawMountains = (g: Graphics, far: number, near: number): void => {
  const range: number[] = [0, VALLEY_Y];
  PEAKS.forEach(([x, top], index) => {
    const next = PEAKS[index + 1];
    range.push(x, top);
    if (next) {
      range.push((x + next[0]) / 2, VALLEY_Y - 20 + (index % 2) * 25);
    }
  });
  range.push(WORLD_WIDTH, PEAKS[PEAKS.length - 1][1] + 30, WORLD_WIDTH, GAME_HEIGHT, 0, GAME_HEIGHT);
  g.poly(range).fill({ color: far });
  // Snow caps: the top third of each peak, with a ragged lower edge.
  PEAKS.forEach(([x, top]) => {
    const depth = (VALLEY_Y - top) * 0.34;
    const half = depth * 0.95;
    g.poly([x, top, x + half, top + depth, x + half * 0.45, top + depth * 0.78, x + half * 0.1, top + depth, x - half * 0.3, top + depth * 0.8, x - half, top + depth])
      .fill({ color: SNOW });
  });
  drawMist(g, 280, 44, 0.22);
  g.moveTo(0, 392).bezierCurveTo(150, 350, 280, 372, 420, 356)
    .bezierCurveTo(600, 334, 720, 384, 880, 362)
    .bezierCurveTo(1010, 346, 1120, 370, WORLD_WIDTH, 358)
    .lineTo(WORLD_WIDTH, GAME_HEIGHT).lineTo(0, GAME_HEIGHT).closePath().fill({ color: near });
  drawMist(g, 404, 50, 0.16);
};

/** Saguaro: a rounded trunk with one or two arms bending upwards. */
const drawCactus = (graphics: Graphics, x: number, height: number, colors: readonly [number, number, number], arms: number): void => {
  const [main, light, dark] = colors;
  const top = GROUND_Y - height;
  const armDefs = [
    { side: -1, at: 0.45, reach: 13, rise: 0.3 },
    { side: 1, at: 0.6, reach: 11, rise: 0.22 },
  ].slice(0, arms);
  armDefs.forEach(({ side, at, reach, rise }) => {
    const y = top + height * at;
    const armTop = y - height * rise;
    const outer = x + side * (reach + 4);
    graphics.roundRect(Math.min(x, outer) - 3, y - 3, reach + 6, 7, 3.5).fill({ color: dark });
    graphics.roundRect(outer - 3.5, armTop, 7, y - armTop + 4, 3.5).fill({ color: dark });
  });
  graphics.roundRect(x - 5.5, top, 11, height + 2, 5.5).fill({ color: main });
  // Sunlit rib down the trunk.
  graphics.roundRect(x - 2.5, top + 4, 2, height - 6, 1).fill({ color: light });
};

/** The row of trees (round, pine) or sparse cacti standing on the horizon, from x `left` to `right`. */
export const drawVegetation = ({ trees }: Battleground, left = 0, right = WORLD_WIDTH): Graphics => {
  const forest = new Graphics();
  const [main, light, dark] = trees.colors;
  if (trees.style === 'cactus') {
    for (let index = 0, x = 60; x < right; index += 1) {
      drawCactus(forest, x, 34 + (index % 3) * 11, trees.colors, index % 3 === 1 ? 1 : 2);
      x += 150 + ((index * 53) % 70);
    }
    // Past the left end, spaced the same way going left.
    for (let index = 1, x = 60 - 160; x > left; index += 1) {
      drawCactus(forest, x, 34 + (index % 3) * 11, trees.colors, index % 3 === 1 ? 1 : 2);
      x -= 150 + ((index * 53) % 70);
    }
    forest.zIndex = 0;
    return forest;
  }
  for (let x = 20 - Math.ceil(-Math.min(0, left) / 92) * 92; x < right; x += 92) {
    const height = 38 + ((((x / 92) % 3) + 3) % 3) * 14;
    if (trees.style === 'snowPine') {
      // Pines with snow on every layer's top.
      forest.rect(x - 2, GROUND_Y - 12, 4, 12).fill({ color: trees.trunk });
      [[0, 30, light], [14, 24, main], [26, 17, dark]].forEach(([lift, halfWidth, color]) => {
        const base = GROUND_Y - 10 - lift;
        const tip = base - height * 0.8;
        forest.poly([x - halfWidth, base, x, tip, x + halfWidth, base]).fill({ color });
        forest.poly([x - halfWidth * 0.42, tip + height * 0.34, x, tip, x + halfWidth * 0.42, tip + height * 0.34, x, tip + height * 0.27])
          .fill({ color: SNOW });
      });
    } else if (trees.style === 'pine') {
      // Layered triangular pines.
      forest.rect(x - 2, GROUND_Y - 12, 4, 12).fill({ color: trees.trunk });
      [[0, 30, light], [14, 24, main], [26, 17, dark]].forEach(([lift, halfWidth, color]) => {
        const base = GROUND_Y - 10 - lift;
        forest.poly([x - halfWidth, base, x, base - height * 0.8, x + halfWidth, base]).fill({ color });
      });
    } else {
      forest.circle(x, GROUND_Y - height, 18).fill({ color: main });
      forest.circle(x - 14, GROUND_Y - height + 12, 15).fill({ color: light });
      forest.circle(x + 15, GROUND_Y - height + 12, 15).fill({ color: dark });
      forest.rect(x - 3, GROUND_Y - height + 16, 6, height).fill({ color: trees.trunk });
    }
  }
  forest.zIndex = 0;
  return forest;
};
