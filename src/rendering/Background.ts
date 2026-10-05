import { Graphics, type Container } from 'pixi.js';
import { GAME_HEIGHT, GROUND_Y, WORLD_WIDTH } from '../config';
import type { Battleground } from '../data/battlegrounds';
import { layoutClouds, mixColor, type CloudLayer, type CloudShape } from './clouds';

type Cloud = {
  sprite: Graphics;
  speed: number;
  width: number;
};

/** Each battleground gets its own (but always the same) sky from a hash of its name. */
const skySeed = (name: string): number =>
  Array.from(name).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** Sky, sun, hills, trees, drifting clouds and the ground strip of a battleground. */
export class Background {
  private readonly clouds: Cloud[];

  public constructor(container: Container, battleground: Battleground) {
    container.addChild(new Graphics().rect(0, 0, WORLD_WIDTH, GAME_HEIGHT).fill({ color: 0x10233a }));
    container.addChild(Background.createSky(battleground));

    const { sun } = battleground;
    const glow = new Graphics().circle(sun.x, sun.y, sun.radius).fill({ color: sun.color, alpha: 0.88 });
    glow.circle(sun.x, sun.y, sun.radius * 1.3).fill({ color: sun.color, alpha: 0.12 });
    container.addChild(glow);

    // Clouds float behind the hills (but in front of the sun).
    this.clouds = layoutClouds(WORLD_WIDTH, skySeed(battleground.name)).map(({ shape, x, y, speed, alpha }) => {
      const cloud = Background.createCloud(shape, battleground);
      cloud.position.set(x, y);
      // Rendered once to a texture so the alpha applies to the whole cloud; otherwise every
      // overlapping blob would show through the others.
      cloud.cacheAsTexture({ resolution: Math.max(1, window.devicePixelRatio || 1), antialias: true });
      cloud.alpha = battleground.cloudAlpha * alpha;
      cloud.zIndex = 0;
      container.addChild(cloud);
      return { sprite: cloud, speed, width: shape.width };
    });
    container.addChild(...Background.createDistantLandscape(battleground));
    container.addChild(Background.createTerrain(battleground));
  }

  /** Drifts the clouds right; one that leaves the world on the right comes back in on the left. */
  public update(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.clouds.forEach(({ sprite, speed, width }) => {
      sprite.x += speed * deltaSeconds;
      if (sprite.x - width / 2 > WORLD_WIDTH) {
        sprite.x = -width / 2;
      }
    });
  }

  /** Shadow underneath tinted towards the far hills, body in the cloud colour, highlight towards white. */
  private static createCloud(shape: CloudShape, { cloudColor, hills }: Battleground): Graphics {
    const colors: Record<CloudLayer, number> = {
      shadow: mixColor(cloudColor, hills[0], 0.35),
      body: cloudColor,
      highlight: mixColor(cloudColor, 0xffffff, 0.3),
    };
    const graphics = new Graphics();
    (['shadow', 'body', 'highlight'] as const).forEach((layer) => {
      shape.blobs
        .filter((blob) => blob.layer === layer)
        .forEach(({ x, y, rx, ry }) => graphics.ellipse(x, y, rx, ry).fill({ color: colors[layer] }));
    });
    return graphics;
  }

  /** Horizontal bands from the top colour down to the horizon. */
  private static createSky({ sky }: Battleground): Graphics {
    const graphics = new Graphics();
    const bandHeight = GROUND_Y / sky.length;
    sky.forEach((color, index) => {
      graphics.rect(0, index * bandHeight, WORLD_WIDTH, bandHeight + 1).fill({ color });
    });
    return graphics;
  }

  private static createDistantLandscape({ hills: [far, near], trees }: Battleground): Graphics[] {
    const hills = new Graphics();
    hills.moveTo(0, 360).bezierCurveTo(180, 250, 310, 340, 480, 275)
      .bezierCurveTo(650, 215, 820, 330, WORLD_WIDTH, 245)
      .lineTo(WORLD_WIDTH, GROUND_Y).lineTo(0, GROUND_Y).closePath().fill({ color: far });
    hills.moveTo(0, 412).bezierCurveTo(190, 320, 390, 390, 570, 330)
      .bezierCurveTo(760, 270, 900, 390, WORLD_WIDTH, 312)
      .lineTo(WORLD_WIDTH, GROUND_Y).lineTo(0, GROUND_Y).closePath().fill({ color: near });

    const forest = new Graphics();
    const [main, light, dark] = trees.colors;
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
    hills.zIndex = 0;
    forest.zIndex = 0;
    return [hills, forest];
  }

  private static createTerrain({ ground: colors }: Battleground): Graphics {
    const ground = new Graphics();
    ground.rect(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y).fill({ color: colors.fill });
    ground.moveTo(0, GROUND_Y).bezierCurveTo(210, GROUND_Y - 8, 420, GROUND_Y + 7, 650, GROUND_Y - 5)
      .bezierCurveTo(850, GROUND_Y - 12, 1020, GROUND_Y + 5, WORLD_WIDTH, GROUND_Y)
      .stroke({ width: 8, color: colors.edge });
    for (let x = 25; x < WORLD_WIDTH; x += 70) {
      ground.ellipse(x, GROUND_Y + 32 + (x % 3) * 8, 22, 6).fill({ color: colors.tufts, alpha: 0.35 });
    }
    ground.zIndex = 0;
    return ground;
  }
}
