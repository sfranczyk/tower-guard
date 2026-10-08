import { Graphics } from 'pixi.js';
import { DEFAULT_AIM_COLORS, type AimColors } from '../data/battlegrounds';
import type { AimInput } from '../managers/InputManager';
import type { Vec2 } from '../types';

/** One dot per this many simulated frames. */
const TRAJECTORY_DOT_EVERY = 3;
/** Fraction of the drag distance used for the drawn aim radius. */
export const AIM_VISUAL_RADIUS_FACTOR = 0.55;

/** Draws the drag-to-aim circles and a ghost of the previous shot (left where that shot was loosed). */
export class AimOverlay extends Graphics {
  private lastReleaseRadius = 0;
  private lastReleaseDirection: Vec2 = { x: 1, y: 0 };
  /** World point the previous shot left the bow; its ghost stays there when the bowman moves on. */
  private lastReleaseOrigin: Vec2 = { x: 0, y: 0 };
  private colors: AimColors = DEFAULT_AIM_COLORS;

  public constructor() {
    super();
    this.zIndex = 3;
  }

  /** Per-battleground colours, so the circles and path stand out against its sky and ground. */
  public setColors(colors: AimColors): void {
    this.colors = colors;
  }

  public recordRelease(aim: AimInput, origin: Vec2): void {
    this.lastReleaseRadius = aim.strength.distance * AIM_VISUAL_RADIUS_FACTOR;
    this.lastReleaseDirection = { ...aim.direction };
    this.lastReleaseOrigin = { ...origin };
  }

  public draw(origin: Vec2, aim: AimInput | undefined, trajectory: readonly Vec2[] = []): void {
    this.clear();
    this.drawPreviousRelease();
    this.drawTrajectory(trajectory);
    if (!aim || aim.power <= 0) {
      return;
    }

    const aimColor = this.colors.aim;
    const visualRadius = aim.strength.distance * AIM_VISUAL_RADIUS_FACTOR;
    const cursorRadius = Math.hypot(aim.start.x - aim.current.x, aim.start.y - aim.current.y);

    // Nearly clear at the cursor, so the battlefield under the drag stays visible.
    this.circle(aim.start.x, aim.start.y, visualRadius).fill({ color: aimColor, alpha: 0.03 });
    this.circle(origin.x, origin.y, visualRadius).fill({ color: aimColor, alpha: 0.1 });
    this.ring(aim.start, visualRadius, aimColor, 0.8);
    this.ring(origin, visualRadius, aimColor, 0.8);
    this.ring(aim.start, cursorRadius, aimColor, 0.45);
    this.segment(origin, { x: origin.x + aim.direction.x * visualRadius, y: origin.y + aim.direction.y * visualRadius }, aimColor, 0.9, 1.5);
    // Both centre dots are see-through, so the bowman and the drag start show through them.
    this.dot(origin, 4, aimColor, 0.35);
    this.dot(aim.start, 4, aimColor, 0.35);

    const dx = aim.current.x - aim.start.x;
    const dy = aim.current.y - aim.start.y;
    const length = Math.hypot(dx, dy);
    if (length > Number.EPSILON) {
      this.segment(aim.start, { x: aim.start.x + (dx / length) * cursorRadius, y: aim.start.y + (dy / length) * cursorRadius }, aimColor, 0.7);
    }
  }

  /** Dotted predicted path, fading towards the landing point. */
  private drawTrajectory(points: readonly Vec2[]): void {
    for (let index = TRAJECTORY_DOT_EVERY - 1; index < points.length; index += TRAJECTORY_DOT_EVERY) {
      const alpha = 0.85 - 0.55 * (index / points.length);
      this.dot(points[index], 2, this.colors.trajectory, alpha);
    }
  }

  private drawPreviousRelease(): void {
    if (this.lastReleaseRadius <= 0) {
      return;
    }
    const origin = this.lastReleaseOrigin;
    const radius = this.lastReleaseRadius;
    const previousColor = this.colors.previousShot;
    this.circle(origin.x, origin.y, radius).fill({ color: previousColor, alpha: 0.12 });
    this.ring(origin, radius, previousColor, 0.55);
    this.segment(origin, { x: origin.x + this.lastReleaseDirection.x * radius, y: origin.y + this.lastReleaseDirection.y * radius }, previousColor, 0.55);
  }

  /** Circle outline, over a dark halo when the battleground asks for one. */
  private ring(center: Vec2, radius: number, color: number, alpha: number, width = 1): void {
    if (this.colors.halo !== undefined) {
      this.circle(center.x, center.y, radius).stroke({ width: width + 2.5, color: this.colors.halo, alpha: alpha * 0.6 });
    }
    this.circle(center.x, center.y, radius).stroke({ width: width + (this.colors.halo !== undefined ? 0.5 : 0), color, alpha });
  }

  private segment(from: Vec2, to: Vec2, color: number, alpha: number, width = 1): void {
    if (this.colors.halo !== undefined) {
      this.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: width + 2.5, color: this.colors.halo, alpha: alpha * 0.6, cap: 'round' });
    }
    this.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: width + (this.colors.halo !== undefined ? 0.5 : 0), color, alpha, cap: 'round' });
  }

  private dot(center: Vec2, radius: number, color: number, alpha: number): void {
    if (this.colors.halo !== undefined) {
      this.circle(center.x, center.y, radius + 1.2).fill({ color: this.colors.halo, alpha: alpha * 0.7 });
    }
    this.circle(center.x, center.y, radius).fill({ color, alpha });
  }
}
