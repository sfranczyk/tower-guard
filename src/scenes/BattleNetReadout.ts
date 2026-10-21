import type { GameContext } from '../core/Scene';
import type { GuestSync } from '../net/GuestSync';
import type { HostSync } from '../net/HostSync';
import type { Traffic } from '../net/Transport';

/** The readout is redrawn this often. */
const REFRESH_MS = 500;

const ms = (value: number | undefined): string => (value === undefined ? '–' : `${Math.round(value)} ms`);
const rate = (bytes: number, elapsedMs: number): string => `${(bytes / elapsedMs).toFixed(1)} KB/s`;

/**
 * Co-op with ?debug: how the link is doing, in a corner. The host lists each guest's round trip and traffic, a guest
 * its round trip, the jitter, how far behind the host it shows the world, the snapshots lost and its traffic.
 */
export class BattleNetReadout {
  private sinceMs = 0;
  private last: Traffic[] = [];

  public constructor(
    private readonly ctx: GameContext,
    private readonly hostSync?: HostSync,
    private readonly guestSync?: GuestSync,
  ) {}

  public update(deltaMs: number): void {
    const net = this.ctx.session.net;
    this.sinceMs += deltaMs;
    if (!net || this.sinceMs < REFRESH_MS) {
      return;
    }
    const elapsed = this.sinceMs;
    this.sinceMs = 0;
    const seats = this.hostSync ? net.present.map((_, seat) => seat).filter((seat) => seat > 0 && net.present[seat]) : [0];
    const lines = seats.map((seat) => {
      const now = net.transport.traffic(seat || undefined);
      const before = this.last[seat] ?? now;
      this.last[seat] = now;
      const traffic = `up ${rate(now.sent - before.sent, elapsed)} · down ${rate(now.received - before.received, elapsed)}`;
      if (this.hostSync) {
        return `P${seat + 1} ping ${ms(this.hostSync.roundTrips()[seat])} · ${traffic}`;
      }
      const stats = this.guestSync?.stats;
      return stats
        ? `ping ${ms(stats.rttMs)} · jitter ${ms(stats.jitterMs)} · delay ${ms(stats.delayMs)} · lost ${Math.round(stats.lossRatio * 100)}%\n${traffic}`
        : traffic;
    });
    this.ctx.ui.setNetReadout(lines.join('\n') || 'no guests');
  }

  public close(): void {
    this.ctx.ui.setNetReadout(undefined);
  }
}
