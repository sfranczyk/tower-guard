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

/** The row of trees (round, pine) or sparse cacti standing on the horizon. */
export const drawVegetation = ({ trees }: Battleground): Graphics => {
  const forest = new Graphics();
  const [main, light, dark] = trees.colors;
  if (trees.style === 'cactus') {
    for (let index = 0, x = 60; x < WORLD_WIDTH; index += 1) {
      drawCactus(forest, x, 34 + (index % 3) * 11, trees.colors, index % 3 === 1 ? 1 : 2);
      x += 150 + ((index * 53) % 70);
    }
    forest.zIndex = 0;
    return forest;
  }
  for (let x = 20; x < WORLD_WIDTH; x += 92) {
    const height = 38 + ((x / 92) % 3) * 14;
    if (trees.style === 'pine') {
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
