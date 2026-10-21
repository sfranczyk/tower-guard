/** The guest never shows the host's world less than this far in the past (one frame plus a little)... */
export const MIN_DELAY_MS = 70;
/** ... nor more (on a very jittery link a late frame is held rather than waiting longer). */
export const MAX_DELAY_MS = 250;
/** Where the delay starts before any jitter is measured. */
const START_DELAY_MS = 100;
/** The delay covers this many times the measured jitter on top of the frame interval. */
const JITTER_MARGIN = 3;
/** The delay follows its target over about this long (so the shown time never jumps). */
const DELAY_EASE_MS = 1000;
/** Jitter rises fast on a late frame and falls back slowly. */
const JITTER_RISE = 0.3;
const JITTER_FALL = 0.02;
/** The base transit time creeps up this much per frame (the route can change), down at once. */
const OFFSET_CREEP = 0.002;

/**
 * Co-op guest: when to show the host's frames. Frames carry the host's time and a sequence number; the guest maps
 * host time onto its own clock (the fastest transit seen is the base) and plays the host's world back a delay in
 * the past that grows with the measured jitter, so late frames still arrive before they're needed. Pure: times in,
 * times out (both sides use performance.now(), not the game loop, so a paused loop doesn't skew them).
 */
export class PlaybackClock {
  private offset?: number;
  private jitter = 0;
  private delay = START_DELAY_MS;
  private lastSeq = -1;
  private received = 0;
  private missed = 0;

  public constructor(private readonly frameMs: number) {}

  /** A frame came in; false when it's older than one already seen (dropped: newest wins). */
  public arrive(seq: number, hostMs: number, localMs: number): boolean {
    if (seq <= this.lastSeq) {
      return false;
    }
    if (this.lastSeq >= 0) {
      this.missed += seq - this.lastSeq - 1;
    }
    this.lastSeq = seq;
    this.received += 1;
    const transit = localMs - hostMs;
    this.offset = this.offset === undefined || transit < this.offset ? transit : this.offset + (transit - this.offset) * OFFSET_CREEP;
    const late = transit - this.offset;
    this.jitter += (late - this.jitter) * (late > this.jitter ? JITTER_RISE : JITTER_FALL);
    return true;
  }

  /** Eases the delay towards what the jitter asks for. */
  public advance(deltaMs: number): void {
    const target = Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, this.frameMs + JITTER_MARGIN * this.jitter));
    this.delay += (target - this.delay) * Math.min(1, deltaMs / DELAY_EASE_MS);
  }

  /** The host time to show now (undefined before the first frame). */
  public showAt(localMs: number): number | undefined {
    return this.offset === undefined ? undefined : localMs - this.offset - this.delay;
  }

  public get stats(): { jitterMs: number; delayMs: number; lossRatio: number } {
    const expected = this.received + this.missed;
    return { jitterMs: this.jitter, delayMs: this.delay, lossRatio: expected > 0 ? this.missed / expected : 0 };
  }
}
