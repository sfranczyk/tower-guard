import { Graphics, type Container } from 'pixi.js';
import { GAME_WIDTH, MAX_VIEW_WIDTH, SNOW_FLAKES, SNOW_SPEED } from '../config';
import { groundAt } from '../systems/terrain';

type Flake = { x: number; y: number; radius: number; speed: number; sway: number; phase: number };

const random = (min: number, max: number): number => min + Math.random() * (max - min);

/**
 * Gentle snowfall in screen space: round flakes falling slowly, swaying, drifting with the wind and
 * melting into the ground line. Like Rain, flakes shift with the camera so they fall in the world.
 */
export class Snow {
  private readonly graphics = new Graphics();
  private readonly flakes: Flake[];
  private lastCameraX?: number;

  /** `drift` is the sideways speed (px/s) the wind gives the flakes. */
  public constructor(container: Container, private readonly drift: number) {
    this.graphics.zIndex = 90;
    container.addChild(this.graphics);
    this.flakes = Array.from({ length: Math.round(SNOW_FLAKES * MAX_VIEW_WIDTH / GAME_WIDTH) }, () => Snow.newFlake(random(-20, 480)));
  }

  public update(deltaMs: number, cameraX: number): void {
    const deltaSeconds = deltaMs / 1000;
    const pan = this.lastCameraX === undefined ? 0 : cameraX - this.lastCameraX;
    this.lastCameraX = cameraX;
    this.flakes.forEach((flake, index) => {
      flake.phase += deltaSeconds * 2;
      flake.y += flake.speed * deltaSeconds;
      flake.x += (this.drift + Math.sin(flake.phase) * flake.sway) * deltaSeconds - pan;
      if (flake.y >= groundAt(flake.x + cameraX)) {
        this.flakes[index] = Snow.newFlake(random(-30, -5));
      } else if (flake.x > MAX_VIEW_WIDTH + 10) {
        flake.x -= MAX_VIEW_WIDTH + 20;
      } else if (flake.x < -10) {
        flake.x += MAX_VIEW_WIDTH + 20;
      }
    });
    this.graphics.clear();
    this.flakes.forEach(({ x, y, radius }) => this.graphics.circle(x, y, radius));
    this.graphics.fill({ color: 0xffffff, alpha: 0.85 });
  }

  private static newFlake(y: number): Flake {
    return {
      x: random(-10, MAX_VIEW_WIDTH + 10),
      y,
      radius: random(1, 2.4),
      speed: random(SNOW_SPEED[0], SNOW_SPEED[1]),
      sway: random(8, 22),
      phase: random(0, Math.PI * 2),
    };
  }
}
