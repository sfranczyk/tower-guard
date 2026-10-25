import { Container, Graphics } from 'pixi.js';

/** How long the burst of a struck comet lasts, and its sparks. */
const BURST_MS = 900;
const SPARKS = 12;
const HEAD_COLOR = 0xfff6dc;
const TAIL_COLOR = 0x9fd8ff;

/**
 * The comet of a MOBA eclipse (scenes/MobaSky.ts flies it, systems/dayCycle.ts `cometAt` says where): a bright head with
 * a long pale tail behind it, in the world (an arrow can reach it), flickering a little; struck, it bursts into sparks.
 */
export class Comet extends Container {
  private readonly body = new Graphics();
  private readonly burstArt = new Graphics();
  private burstMs?: number;
  private flickerMs = 0;

  public constructor() {
    super();
    this.zIndex = 1;
    // Head at (0, 0) flying along +x: the tail streams out behind (−x), widening and fading.
    const tail = 260;
    for (let index = 0; index < 6; index += 1) {
      const t = index / 5;
      this.body.poly([0, -4 - 10 * t, -tail * (1 - 0.35 * t), 0, 0, 4 + 10 * t]).fill({ color: TAIL_COLOR, alpha: 0.18 - 0.025 * index });
    }
    this.body.circle(0, 0, 22).fill({ color: HEAD_COLOR, alpha: 0.18 });
    this.body.circle(0, 0, 12).fill({ color: HEAD_COLOR, alpha: 0.45 });
    this.body.circle(0, 0, 6).fill({ color: 0xffffff });
    this.addChild(this.body, this.burstArt);
    this.visible = false;
  }

  /** Flying at (x, y), heading `heading` (radians). */
  public fly(x: number, y: number, heading: number): void {
    if (this.burstMs !== undefined) {
      return;
    }
    this.visible = true;
    this.body.visible = true;
    this.position.set(x, y);
    this.body.rotation = heading;
  }

  /** Not in the sky (or burst and gone). */
  public hide(): void {
    if (this.burstMs === undefined) {
      this.visible = false;
    }
  }

  /** Struck: it bursts where it is. */
  public burst(): void {
    this.visible = true;
    this.body.visible = false;
    this.burstMs = 0;
  }

  public update(deltaMs: number): void {
    this.flickerMs += deltaMs;
    this.body.alpha = 0.85 + 0.15 * Math.sin(this.flickerMs / 70);
    if (this.burstMs === undefined) {
      return;
    }
    this.burstMs += deltaMs;
    const t = Math.min(1, this.burstMs / BURST_MS);
    this.burstArt.clear();
    if (t >= 1) {
      this.burstMs = undefined;
      this.visible = false;
      return;
    }
    const fade = 1 - t;
    this.burstArt.circle(0, 0, 14 + 60 * t).stroke({ width: 3, color: HEAD_COLOR, alpha: 0.7 * fade });
    this.burstArt.circle(0, 0, 18 * fade).fill({ color: HEAD_COLOR, alpha: 0.8 * fade });
    for (let index = 0; index < SPARKS; index += 1) {
      const angle = (index / SPARKS) * Math.PI * 2 + index * 0.4;
      const reach = (40 + 30 * (index % 3)) * Math.sqrt(t);
      this.burstArt.circle(Math.cos(angle) * reach, Math.sin(angle) * reach + 30 * t * t, 2.5 * fade + 0.5).fill({ color: index % 2 ? TAIL_COLOR : HEAD_COLOR, alpha: fade });
    }
  }
}
