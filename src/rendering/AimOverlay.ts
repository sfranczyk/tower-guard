import { Graphics } from 'pixi.js';
import { DEFAULT_AIM_COLORS, type AimColors } from '../data/battlegrounds';
import type { AimInput } from '../managers/InputManager';
import type { Vec2 } from '../types';

/** One dot per this many simulated frames. */
const TRAJECTORY_DOT_EVERY = 3;
/** Fraction of the drag distance used for the drawn aim radius. */
export const AIM_VISUAL_RADIUS_FACTOR = 0.55;

/** Draws the drag-to-aim circles and a ghost of the previous shot. */
export class AimOverlay extends Graphics {
  private lastReleaseRadius = 0;
  private lastReleaseDirection: Vec2 = { x: 1, y: 0 };
  private colors: AimColors = DEFAULT_AIM_COLORS;

  public constructor() {
    super();
    this.zIndex = 3;
  }

  /** Per-battleground colours, so the circles and path stand out against its sky and ground. */
  public setColors(colors: AimColors): void {
    this.colors = colors;
  }

  public recordRelease(aim: AimInput): void {
    this.lastReleaseRadius = aim.strength.distance * AIM_VISUAL_RADIUS_FACTOR;
    this.lastReleaseDirection = { ...aim.direction };
  }

  public draw(origin: Vec2, aim: AimInput | undefined, trajectory: readonly Vec2[] = []): void {
    this.clear();
    this.drawPreviousRelease(origin);
    this.drawTrajectory(trajectory);
    if (!aim || aim.power <= 0) {
      return;
    }

    const aimColor = this.colors.aim;
    const visualRadius = aim.strength.distance * AIM_VISUAL_RADIUS_FACTOR;
    const cursorRadius = Math.hypot(aim.start.x - aim.current.x, aim.start.y - aim.current.y);

    this.circle(origin.x, origin.y, 4).fill({ color: aimColor, alpha: 1 });
    this.moveTo(origin.x, origin.y)
      .lineTo(origin.x + aim.direction.x * visualRadius, origin.y + aim.direction.y * visualRadius)
      .stroke({ width: 1.5, color: aimColor, alpha: 0.9 });
    this.circle(aim.start.x, aim.start.y, visualRadius).stroke({ width: 1, color: aimColor, alpha: 0.8 });
    this.circle(origin.x, origin.y, visualRadius).stroke({ width: 1, color: aimColor, alpha: 0.8 });
    this.circle(aim.start.x, aim.start.y, 4).fill({ color: aimColor, alpha: 0.35 });
    this.circle(aim.start.x, aim.start.y, visualRadius).fill({ color: aimColor, alpha: 0.1 });
    this.circle(origin.x, origin.y, visualRadius).fill({ color: aimColor, alpha: 0.1 });
    this.circle(aim.start.x, aim.start.y, cursorRadius).stroke({ width: 1, color: aimColor, alpha: 0.45 });

    const dx = aim.current.x - aim.start.x;
    const dy = aim.current.y - aim.start.y;
    const length = Math.hypot(dx, dy);
    if (length > Number.EPSILON) {
      this.moveTo(aim.start.x, aim.start.y).lineTo(
        aim.start.x + (dx / length) * cursorRadius,
        aim.start.y + (dy / length) * cursorRadius,
      ).stroke({ width: 1, color: aimColor, alpha: 0.7 });
    }
  }

  /** Dotted predicted path, fading towards the landing point. */
  private drawTrajectory(points: readonly Vec2[]): void {
    for (let index = TRAJECTORY_DOT_EVERY - 1; index < points.length; index += TRAJECTORY_DOT_EVERY) {
      const { x, y } = points[index];
      const alpha = 0.85 - 0.55 * (index / points.length);
      this.circle(x, y, 2).fill({ color: this.colors.trajectory, alpha });
    }
  }

  private drawPreviousRelease(origin: Vec2): void {
    if (this.lastReleaseRadius <= 0) {
      return;
    }
    const radius = this.lastReleaseRadius;
    const previousColor = this.colors.previousShot;
    this.circle(origin.x, origin.y, radius).stroke({ width: 1, color: previousColor, alpha: 0.55 });
    this.moveTo(origin.x, origin.y).lineTo(
      origin.x + this.lastReleaseDirection.x * radius,
      origin.y + this.lastReleaseDirection.y * radius,
    ).stroke({ width: 1, color: previousColor, alpha: 0.55 });
    this.circle(origin.x, origin.y, radius).fill({ color: previousColor, alpha: 0.12 });
  }
}
