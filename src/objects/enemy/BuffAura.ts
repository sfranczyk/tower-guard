import { Graphics } from 'pixi.js';
import type { LastingBuff } from '../../systems/shamanBuffs';

/** Each shaman's spell in its own colour: haste yellow, stone skin grey, quick draw blue, a bigger bomb red. */
export const BUFF_COLORS: Readonly<Record<LastingBuff, number>> = {
  haste: 0xffd23f,
  stoneskin: 0xa9b0ba,
  quickDraw: 0x5bb8ff,
  blast: 0xff4a3a,
};

/** Fades out over the last this many ms of a spell. */
const FADE_MS = 800;

/**
 * A glow round an enemy under a shaman's spell (behind its body, in its container): a pulsing ring on the ground and a
 * faint halo, in the spell's colour; nothing without one.
 */
export class BuffAura {
  public readonly art = new Graphics();
  private timeMs = 0;

  public draw(kind: LastingBuff | undefined, leftMs: number, deltaMs: number, visible: boolean): void {
    this.art.clear();
    if (!kind || !visible) {
      return;
    }
    this.timeMs += deltaMs;
    const color = BUFF_COLORS[kind];
    const fade = Math.min(1, leftMs / FADE_MS);
    const pulse = 0.5 + 0.5 * Math.sin(this.timeMs / 220);
    this.art
      .ellipse(0, -34, 20, 38).fill({ color, alpha: (0.1 + 0.06 * pulse) * fade })
      .ellipse(0, 0, 22 + 3 * pulse, 5 + pulse).stroke({ width: 2, color, alpha: (0.55 + 0.3 * pulse) * fade });
  }
}
