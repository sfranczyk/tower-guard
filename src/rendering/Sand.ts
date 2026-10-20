import { Graphics, type Container } from 'pixi.js';
import { GAME_WIDTH, MAX_VIEW_WIDTH, SANDSTORM, SCENERY_MARGIN, VIEW_BOTTOM, VIEW_TOP } from '../config';
import { groundAt } from '../systems/terrain';
import { enemyKeepX, worldWidth } from '../systems/battlefield';

type Grain = { x: number; y: number; length: number; speed: number; phase: number };

const random = (min: number, max: number): number => min + Math.random() * (max - min);
/** Width of the haze strips (world px). */
const HAZE_STEP = 24;
const SAND_COLOR = 0xe2c48a;
const HAZE_COLOR = 0xc9a46a;

/**
 * A sandstorm in screen space: streaks of sand blowing along the field (`direction` is the wind's side, ±1) and a
 * haze of dust over it, thicker towards the enemy's side, drawn in world x and shifted with the camera. `intensity`
 * (1 raging .. 0 over) thins both as the storm calms (Background.night.calm).
 */
export class Sand {
  private readonly grains = new Graphics();
  private readonly haze = new Graphics();
  private readonly flecks: Grain[];
  private lastCameraX?: number;
  public intensity = 1;

  public constructor(container: Container, public direction: number) {
    this.haze.zIndex = 88;
    this.grains.zIndex = 89;
    // Grain and haze y are world y, so the layers sit as far down as the scenery (see VIEW_TOP).
    this.haze.y = -VIEW_TOP;
    this.grains.y = -VIEW_TOP;
    container.addChild(this.haze, this.grains);
    this.flecks = Array.from({ length: Math.round(SANDSTORM.grains * MAX_VIEW_WIDTH / GAME_WIDTH) }, () => Sand.newGrain());
    for (let x = -SCENERY_MARGIN; x < worldWidth() + SCENERY_MARGIN; x += HAZE_STEP) {
      const far = Math.max(0, Math.min(1, (x - SANDSTORM.hazeFrom) / (enemyKeepX() - SANDSTORM.hazeFrom)));
      const alpha = SANDSTORM.haze + SANDSTORM.farHaze * far * far * (3 - 2 * far);
      this.haze.rect(x, VIEW_TOP, HAZE_STEP + 1, VIEW_BOTTOM - VIEW_TOP).fill({ color: HAZE_COLOR, alpha });
    }
  }

  public update(deltaMs: number, cameraX: number): void {
    const deltaSeconds = deltaMs / 1000;
    const pan = this.lastCameraX === undefined ? 0 : cameraX - this.lastCameraX;
    this.lastCameraX = cameraX;
    this.haze.x = -cameraX;
    this.haze.alpha = this.intensity;
    const blowing = Math.round(this.flecks.length * this.intensity);
    this.grains.clear();
    this.flecks.forEach((grain, index) => {
      grain.phase += deltaSeconds * 3;
      grain.x += this.direction * grain.speed * deltaSeconds - pan;
      grain.y += Math.sin(grain.phase) * 18 * deltaSeconds;
      if (grain.x > MAX_VIEW_WIDTH + 20) {
        grain.x -= MAX_VIEW_WIDTH + 40;
      } else if (grain.x < -20) {
        grain.x += MAX_VIEW_WIDTH + 40;
      }
      if (index < blowing && grain.y < groundAt(grain.x + cameraX)) {
        this.grains.moveTo(grain.x, grain.y).lineTo(grain.x - this.direction * grain.length, grain.y + 1);
      }
    });
    this.grains.stroke({ width: 1.4, color: SAND_COLOR, alpha: 0.55 });
  }

  /** Most of the sand blows low, over the ground; some higher up in the dust. */
  private static newGrain(): Grain {
    const low = Math.random() < 0.7;
    return {
      x: random(-20, MAX_VIEW_WIDTH + 20),
      y: low ? random(380, 520) : random(VIEW_TOP + 40, 380),
      length: random(6, 16),
      speed: SANDSTORM.speed * random(0.7, 1.3),
      phase: random(0, Math.PI * 2),
    };
  }
}
