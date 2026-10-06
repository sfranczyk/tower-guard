import { Graphics, type Container } from 'pixi.js';
import { GAME_WIDTH, GROUND_Y, MAX_VIEW_WIDTH, RAIN_ALPHA, RAIN_DROPS, RAIN_SLANT, RAIN_SPEED } from '../config';
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

  public constructor(container: Container) {
    this.graphics.zIndex = 90;
    container.addChild(this.graphics);
    this.drops = Array.from({ length: Math.round(RAIN_DROPS * MAX_VIEW_WIDTH / GAME_WIDTH) }, () => Rain.newDrop(random(-40, GROUND_Y)));
  }

  public update(deltaMs: number, cameraX: number): void {
    const deltaSeconds = deltaMs / 1000;
    const pan = this.lastCameraX === undefined ? 0 : cameraX - this.lastCameraX;
    this.lastCameraX = cameraX;
    this.drops.forEach((drop, index) => {
      drop.y += drop.speed * deltaSeconds;
      drop.x += drop.speed * deltaSeconds * RAIN_SLANT - pan;
      const ground = groundAt(drop.x + cameraX);
      if (drop.y >= ground) {
        if (Math.random() < 0.5) {
          this.splashes.push({ x: drop.x, y: ground, ageMs: 0 });
        }
        this.drops[index] = Rain.newDrop(random(-60, -10));
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
    this.drops.forEach(({ x, y, length }) => {
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

  private static newDrop(y: number): Drop {
    return { x: random(-20, MAX_VIEW_WIDTH + 20), y, length: random(9, 16), speed: random(RAIN_SPEED[0], RAIN_SPEED[1]) };
  }
}
