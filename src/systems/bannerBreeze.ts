import { BANNERS } from '../config';

/**
 * The breeze both banners fly in (pure, tested): one abstract wind for the whole field, so every banner (at a keep, in
 * a carrier's hands, planted) points the same way. `lean` runs −1..1: its sign is where the cloth flies (+1 towards +x),
 * its size how stiffly (0 = hanging limp down the pole). Every `BANNERS.breezeChangeMinMs`..`MaxMs` it picks a new
 * aim: now and then (`breezeFlipChance`) the other way, now and then (`breezeLullChance`) a lull; `lean` eases towards
 * it (`breezeEasePerS`), so a turn of the wind drops the cloth first, then lifts it on the other side. On a map with a
 * real wind the banners fly with it.
 */
export class BannerBreeze {
  public lean: number;
  private aim: number;
  private untilChangeMs: number;

  public constructor(private readonly random: () => number = Math.random) {
    const side = random() < 0.5 ? -1 : 1;
    this.lean = side * 0.8;
    this.aim = this.lean;
    this.untilChangeMs = this.nextChangeMs();
  }

  /** Which way the cloth flies (±1). */
  public get direction(): number {
    return this.lean < 0 ? -1 : 1;
  }

  /** How stiffly it flies, 0 (limp) … 1. */
  public get strength(): number {
    return Math.min(1, Math.abs(this.lean));
  }

  /** `windSign`: the level's wind direction (0 when calm: the breeze picks its own). */
  public update(deltaMs: number, windSign = 0): void {
    this.untilChangeMs -= deltaMs;
    if (this.untilChangeMs <= 0) {
      this.untilChangeMs = this.nextChangeMs();
      const side = Math.sign(this.aim) || 1;
      const flipped = this.random() < BANNERS.breezeFlipChance ? -side : side;
      const lull = this.random() < BANNERS.breezeLullChance;
      const force = lull ? 0.05 + this.random() * 0.15 : 0.55 + this.random() * 0.45;
      this.aim = flipped * force;
    }
    if (windSign !== 0 && Math.sign(this.aim) !== windSign) {
      this.aim = windSign * Math.abs(this.aim);
    }
    const step = (BANNERS.breezeEasePerS * deltaMs) / 1000;
    this.lean += Math.max(-step, Math.min(step, this.aim - this.lean));
  }

  private nextChangeMs(): number {
    return BANNERS.breezeChangeMinMs + this.random() * (BANNERS.breezeChangeMaxMs - BANNERS.breezeChangeMinMs);
  }
}
