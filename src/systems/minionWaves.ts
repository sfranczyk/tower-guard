/** One kind of minion a keep sends: `count` of `role` together every `everyMs`. */
export interface MinionGroup<R extends string> {
  readonly role: R;
  readonly count: number;
  readonly everyMs: number;
  /** When its first group comes (default: the clock's first). */
  readonly firstMs?: number;
}

/**
 * MOBA lanes' clock (pure, tested): each group comes on its own clock, the first `firstMs` after the start, then every
 * `everyMs`; a group's minions come out `spacingMs` apart (each group in its own file, so a troop and an archer may
 * come out together). `update` returns the roles to spawn this frame; the scene spawns one per keep. Groups are read
 * every frame, so tuning them takes effect at the group's next release.
 */
export class MinionWaves<R extends string> {
  private elapsedMs = 0;
  /** Per role: when its next group is due (ms since the start), and how many of the current one are still to come out. */
  private readonly clocks = new Map<R, { dueMs: number; queued: number; nextOutMs: number }>();

  public constructor(
    private readonly groups: () => readonly MinionGroup<R>[],
    private readonly firstMs: () => number,
    private readonly spacingMs: () => number,
  ) {}

  public update(deltaMs: number): R[] {
    this.elapsedMs += deltaMs;
    const out: R[] = [];
    this.groups().forEach(({ role, count, everyMs, firstMs }) => {
      let clock = this.clocks.get(role);
      if (!clock) {
        clock = { dueMs: firstMs ?? this.firstMs(), queued: 0, nextOutMs: 0 };
        this.clocks.set(role, clock);
      }
      while (this.elapsedMs >= clock.dueMs) {
        clock.queued += Math.max(0, Math.round(count));
        clock.nextOutMs = Math.max(clock.nextOutMs, clock.dueMs);
        clock.dueMs += Math.max(1000, everyMs);
      }
      while (clock.queued > 0 && this.elapsedMs >= clock.nextOutMs) {
        out.push(role);
        clock.queued -= 1;
        clock.nextOutMs += this.spacingMs();
      }
    });
    return out;
  }
}
