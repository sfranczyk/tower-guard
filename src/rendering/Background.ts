import { Graphics, type Container } from 'pixi.js';
import { GAME_HEIGHT, GROUND_Y, WORLD_WIDTH } from '../config';

type Cloud = {
  sprite: Graphics;
  speed: number;
  width: number;
};

const CLOUDS = [
  { x: 160, y: 105, width: 170, height: 42, speed: 3 },
  { x: 610, y: 155, width: 125, height: 30, speed: 2 },
  { x: 1040, y: 90, width: 210, height: 48, speed: 4 },
  { x: 1430, y: 140, width: 145, height: 34, speed: 2 },
];

/** Sky, sun, hills, forest, drifting clouds and the ground strip. */
export class Background {
  private readonly clouds: Cloud[];

  public constructor(container: Container) {
    const bg = new Graphics().rect(0, 0, WORLD_WIDTH, GAME_HEIGHT).fill({ color: 0x10233a });
    const sky = new Graphics().rect(0, 0, WORLD_WIDTH, GROUND_Y).fill({ color: 0x80b8d1, alpha: 1 });
    const glow = new Graphics().circle(790, 105, 68).fill({ color: 0xf8dc9b, alpha: 0.88 });
    glow.circle(790, 105, 88).fill({ color: 0xf8dc9b, alpha: 0.12 });
    container.addChild(bg, sky, glow);

    container.addChild(...Background.createDistantLandscape());
    this.clouds = CLOUDS.map(({ x, y, width, height, speed }) => {
      const cloud = new Graphics();
      cloud.ellipse(x, y, width * 0.5, height * 0.5).fill({ color: 0xf7fbf5, alpha: 0.68 });
      cloud.ellipse(x - width * 0.25, y + 4, width * 0.225, height * 0.4).fill({ color: 0xf7fbf5, alpha: 0.68 });
      cloud.ellipse(x + width * 0.2, y - 5, width * 0.25, height * 0.5).fill({ color: 0xf7fbf5, alpha: 0.68 });
      cloud.zIndex = 0;
      container.addChild(cloud);
      return { sprite: cloud, speed, width };
    });
    container.addChild(Background.createTerrain());
  }

  public update(deltaMs: number, cameraX: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.clouds.forEach(({ sprite, speed, width }) => {
      sprite.x += speed * deltaSeconds * 15;
      if (sprite.x - cameraX > WORLD_WIDTH + width) {
        sprite.x = -width;
      }
    });
  }

  private static createDistantLandscape(): Graphics[] {
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
    return [hills, forest];
  }

  private static createTerrain(): Graphics {
    const ground = new Graphics();
    ground.rect(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y).fill({ color: 0x79a866 });
    ground.moveTo(0, GROUND_Y).bezierCurveTo(210, GROUND_Y - 8, 420, GROUND_Y + 7, 650, GROUND_Y - 5)
      .bezierCurveTo(850, GROUND_Y - 12, 1020, GROUND_Y + 5, WORLD_WIDTH, GROUND_Y)
      .stroke({ width: 8, color: 0xc7e094 });
    for (let x = 25; x < WORLD_WIDTH; x += 70) {
      ground.ellipse(x, GROUND_Y + 32 + (x % 3) * 8, 22, 6).fill({ color: 0x679452, alpha: 0.35 });
    }
    ground.zIndex = 0;
    return ground;
  }
}
