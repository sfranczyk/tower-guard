import { Graphics, type Container } from 'pixi.js';
import { GAME_WIDTH, GROUND_Y, MAX_VIEW_WIDTH, RAIN_ALPHA, RAIN_DROPS, RAIN_SLANT, RAIN_SPEED, VIEW_TOP } from '../config';
import { groundAt } from '../systems/terrain';

type Drop = { x: number; y: number; length: number; speed: number };
type Splash = { x: number; y: number; ageMs: number };

const SPLASH_MS = 140;
const random = (min: number, max: number): number => min + Math.random() * (max - min);

/**
 * Light rain in screen space: thin slanted streaks falling to the ground line, where they leave a
 * tiny splash. Drops shift with the camera so the rain seems to fall in the world, not on the lens.
 */
export class Rain {
  private readonly graphics = new Graphics();
  private readonly drops: Drop[];
  private splashes: Splash[] = [];
  private lastCameraX?: number;
  /** Share of the drops that fall (1 = full rain, 0 = it has stopped). */
  public intensity = 1;

  public constructor(container: Container) {
    this.graphics.zIndex = 90;
    // Drop y is world y (like the ground), so the layer sits as far down as the scenery (see VIEW_TOP).
    this.graphics.y = -VIEW_TOP;
    container.addChild(this.graphics);
    this.drops = Array.from({ length: Math.round(RAIN_DROPS * MAX_VIEW_WIDTH / GAME_WIDTH) }, () => Rain.newDrop(random(VIEW_TOP - 40, GROUND_Y)));
  }

  public update(deltaMs: number, cameraX: number): void {
    const deltaSeconds = deltaMs / 1000;
    const pan = this.lastCameraX === undefined ? 0 : cameraX - this.lastCameraX;
    this.lastCameraX = cameraX;
    const falling = this.falling();
    this.drops.forEach((drop, index) => {
      drop.y += drop.speed * deltaSeconds;
      drop.x += drop.speed * deltaSeconds * RAIN_SLANT - pan;
      const ground = groundAt(drop.x + cameraX);
      if (drop.y >= ground) {
        if (index < falling && Math.random() < 0.5) {
          this.splashes.push({ x: drop.x, y: ground, ageMs: 0 });
        }
        this.drops[index] = Rain.newDrop(random(VIEW_TOP - 60, VIEW_TOP - 10));
      } else if (drop.x > MAX_VIEW_WIDTH + 20) {
        drop.x -= MAX_VIEW_WIDTH + 40;
      } else if (drop.x < -20) {
        drop.x += MAX_VIEW_WIDTH + 40;
      }
    });
    this.splashes = this.splashes.filter((splash) => (splash.ageMs += deltaMs) < SPLASH_MS);
    this.splashes.forEach((splash) => {
      splash.x -= pan;
    });
    this.draw();
  }

  private draw(): void {
    const graphics = this.graphics;
    graphics.clear();
    this.drops.slice(0, this.falling()).forEach(({ x, y, length }) => {
      graphics.moveTo(x, y).lineTo(x - length * RAIN_SLANT, y - length);
    });
    graphics.stroke({ width: 1, color: 0xb4c4d8, alpha: RAIN_ALPHA });
    this.splashes.forEach(({ x, y, ageMs }) => {
      const spread = 2 + (ageMs / SPLASH_MS) * 4;
      graphics.moveTo(x - spread, y - 1).lineTo(x - spread - 2, y - 4);
      graphics.moveTo(x + spread, y - 1).lineTo(x + spread + 2, y - 4);
    });
    if (this.splashes.length > 0) {
      graphics.stroke({ width: 1, color: 0xc8d4e4, alpha: RAIN_ALPHA * 1.2 });
    }
  }

  /** How many of the drops fall (the rest are kept, unseen, for when the rain picks up). */
  private falling(): number {
    return Math.round(this.drops.length * this.intensity);
  }

  private static newDrop(y: number): Drop {
    return { x: random(-20, MAX_VIEW_WIDTH + 20), y, length: random(9, 16), speed: random(RAIN_SPEED[0], RAIN_SPEED[1]) };
  }
}
