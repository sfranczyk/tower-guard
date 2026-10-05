import { Graphics } from 'pixi.js';
import type { AimInput } from '../managers/InputManager';
import type { Vec2 } from '../types';

const AIM_COLOR = 0xf5d76e;
const PREVIOUS_RELEASE_COLOR = 0x9ec5ff;
/** Fraction of the drag distance used for the drawn aim radius. */
export const AIM_VISUAL_RADIUS_FACTOR = 0.55;

/** Draws the drag-to-aim circles and a ghost of the previous shot. */
export class AimOverlay extends Graphics {
  private lastReleaseRadius = 0;
  private lastReleaseDirection: Vec2 = { x: 1, y: 0 };

  public constructor() {
    super();
    this.zIndex = 3;
  }

  public recordRelease(aim: AimInput): void {
    this.lastReleaseRadius = aim.strength.distance * AIM_VISUAL_RADIUS_FACTOR;
    this.lastReleaseDirection = { ...aim.direction };
  }

  public draw(origin: Vec2, aim: AimInput | undefined): void {
    this.clear();
    this.drawPreviousRelease(origin);
    if (!aim || aim.power <= 0) {
      return;
    }

    const visualRadius = aim.strength.distance * AIM_VISUAL_RADIUS_FACTOR;
    const cursorRadius = Math.hypot(aim.start.x - aim.current.x, aim.start.y - aim.current.y);

    this.circle(origin.x, origin.y, 4).fill({ color: AIM_COLOR, alpha: 1 });
    this.moveTo(origin.x, origin.y)
      .lineTo(origin.x + aim.direction.x * visualRadius, origin.y + aim.direction.y * visualRadius)
      .stroke({ width: 3, color: AIM_COLOR, alpha: 0.9 });
    this.circle(aim.start.x, aim.start.y, visualRadius).stroke({ width: 2, color: AIM_COLOR, alpha: 0.8 });
    this.circle(origin.x, origin.y, visualRadius).stroke({ width: 2, color: AIM_COLOR, alpha: 0.8 });
    this.circle(aim.start.x, aim.start.y, 4).fill({ color: AIM_COLOR, alpha: 0.35 });
    this.circle(aim.start.x, aim.start.y, visualRadius).fill({ color: AIM_COLOR, alpha: 0.1 });
    this.circle(origin.x, origin.y, visualRadius).fill({ color: AIM_COLOR, alpha: 0.1 });
    this.circle(aim.start.x, aim.start.y, cursorRadius).stroke({ width: 2, color: AIM_COLOR, alpha: 0.45 });

    const dx = aim.current.x - aim.start.x;
    const dy = aim.current.y - aim.start.y;
    const length = Math.hypot(dx, dy);
    if (length > Number.EPSILON) {
      this.moveTo(aim.start.x, aim.start.y).lineTo(
        aim.start.x + (dx / length) * cursorRadius,
        aim.start.y + (dy / length) * cursorRadius,
      ).stroke({ width: 2, color: AIM_COLOR, alpha: 0.7 });
    }
  }

  private drawPreviousRelease(origin: Vec2): void {
    if (this.lastReleaseRadius <= 0) {
      return;
    }
    const radius = this.lastReleaseRadius;
    this.circle(origin.x, origin.y, radius).stroke({ width: 2, color: PREVIOUS_RELEASE_COLOR, alpha: 0.55 });
    this.moveTo(origin.x, origin.y).lineTo(
      origin.x + this.lastReleaseDirection.x * radius,
      origin.y + this.lastReleaseDirection.y * radius,
    ).stroke({ width: 2, color: PREVIOUS_RELEASE_COLOR, alpha: 0.55 });
    this.circle(origin.x, origin.y, radius).fill({ color: PREVIOUS_RELEASE_COLOR, alpha: 0.12 });
  }
}
