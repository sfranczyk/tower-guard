import { Graphics, type Container } from 'pixi.js';
import { BACKDROP_WIDTH, GAME_HEIGHT, GROUND_Y, SCENERY_MARGIN, WORLD_WIDTH } from '../config';
import type { Battleground } from '../data/battlegrounds';
import { layoutClouds, mixColor, type CloudLayer, type CloudShape } from './clouds';
import { drawHills, drawVegetation } from './landscape';
import { groundAt, useTerrain } from '../systems/terrain';


type Cloud = {
  sprite: Graphics;
  speed: number;
  width: number;
};

/** Spacing of the points the ground surface is drawn through. */
const TERRAIN_STEP = 8;

/** Each battleground gets its own (but always the same) sky from a hash of its name. */
const skySeed = (name: string): number =>
  Array.from(name).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** Where a cloud is right now (its base), e.g. for lightning to come out of. */
export interface CloudSpot {
  x: number;
  y: number;
  width: number;
}

/**
 * Sky, sun, hills (or dunes), trees, drifting clouds (by weather) and the ground strip of a battleground, across
 * `width` (the battlefield, WORLD_WIDTH, or BACKDROP_WIDTH behind menus) plus SCENERY_MARGIN on both sides.
 */
export class Background {
  private readonly clouds: Cloud[];
  private readonly left: number;
  private readonly right: number;

  public constructor(container: Container, battleground: Battleground, width = WORLD_WIDTH) {
    this.left = -SCENERY_MARGIN;
    this.right = width + SCENERY_MARGIN;
    const sceneryWidth = this.right - this.left;
    // Everything that touches the ground (drawing, walking, arrows) uses this map's wave height.
    useTerrain(battleground.terrainAmplitude);
    container.addChild(new Graphics().rect(this.left, 0, sceneryWidth, GAME_HEIGHT).fill({ color: 0x10233a }));
    container.addChild(this.createSky(battleground));

    const { sun } = battleground;
    if (sun) {
      const glow = new Graphics().circle(sun.x, sun.y, sun.radius).fill({ color: sun.color, alpha: 0.88 });
      glow.circle(sun.x, sun.y, sun.radius * 1.3).fill({ color: sun.color, alpha: 0.12 });
      container.addChild(glow);
    }

    // Clouds float behind the hills (but in front of the sun).
    const clouds = layoutClouds(sceneryWidth, skySeed(battleground.name), battleground.weather, sceneryWidth / BACKDROP_WIDTH);
    this.clouds = clouds.map(({ shape, x, y, speed, alpha }) => {
      const cloud = Background.createCloud(shape, battleground);
      cloud.position.set(this.left + x, y);
      // Rendered once to a texture so the alpha applies to the whole cloud; otherwise every
      // overlapping blob would show through the others.
      cloud.cacheAsTexture({ resolution: Math.max(1, window.devicePixelRatio || 1), antialias: true });
      cloud.alpha = battleground.cloudAlpha * alpha;
      cloud.zIndex = 0;
      container.addChild(cloud);
      return { sprite: cloud, speed, width: shape.width };
    });
    container.addChild(...this.tiledHills(drawHills(battleground)), drawVegetation(battleground, this.left, this.right));
    container.addChild(this.createTerrain(battleground));
  }

  /**
   * The hills drawing is one BACKDROP_WIDTH stretch; copies sharing it repeat across the whole scenery,
   * every other one mirrored, so the skyline stays continuous at every seam.
   */
  private tiledHills(hills: Graphics): Graphics[] {
    const first = Math.floor(this.left / BACKDROP_WIDTH);
    const last = Math.ceil(this.right / BACKDROP_WIDTH);
    return Array.from({ length: last - first }, (_, offset) => {
      const tile = first + offset;
      const copy = tile === 0 ? hills : new Graphics(hills.context);
      const mirrored = Math.abs(tile) % 2 === 1;
      copy.scale.x = mirrored ? -1 : 1;
      copy.x = mirrored ? (tile + 1) * BACKDROP_WIDTH : tile * BACKDROP_WIDTH;
      copy.zIndex = hills.zIndex;
      return copy;
    });
  }

  /** Drifts the clouds right; one that leaves the scenery on the right comes back in on the left. */
  public update(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.clouds.forEach(({ sprite, speed, width }) => {
      sprite.x += speed * deltaSeconds;
      if (sprite.x - width / 2 > this.right) {
        sprite.x = this.left - width / 2;
      }
    });
  }

  public cloudSpots(): CloudSpot[] {
    return this.clouds.map(({ sprite, width }) => ({ x: sprite.x, y: sprite.y, width }));
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
  private createSky({ sky }: Battleground): Graphics {
    const graphics = new Graphics();
    const bandHeight = GROUND_Y / sky.length;
    sky.forEach((color, index) => {
      graphics.rect(this.left, index * bandHeight, this.right - this.left, bandHeight + 1).fill({ color });
    });
    return graphics;
  }

  private createTerrain({ ground: colors }: Battleground): Graphics {
    const { left, right } = this;
    const ground = new Graphics();
    // Fill and grass edge follow the same surface line, so there's never a gap between them.
    const surface: number[] = [];
    for (let x = left; x <= right + TERRAIN_STEP; x += TERRAIN_STEP) {
      surface.push(x, groundAt(x));
    }
    ground.poly([...surface, right + TERRAIN_STEP, GAME_HEIGHT, left, GAME_HEIGHT]).fill({ color: colors.fill });
    ground.moveTo(surface[0], surface[1]);
    for (let index = 2; index < surface.length; index += 2) {
      ground.lineTo(surface[index], surface[index + 1]);
    }
    ground.stroke({ width: 8, color: colors.edge, join: 'round' });
    for (let x = 25 - Math.ceil(SCENERY_MARGIN / 70) * 70; x < right; x += 70) {
      ground.ellipse(x, groundAt(x) + 32 + (((x % 3) + 3) % 3) * 8, 22, 6).fill({ color: colors.tufts, alpha: 0.35 });
    }
    ground.zIndex = 0;
    return ground;
  }
}
