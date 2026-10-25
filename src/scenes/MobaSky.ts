import type { Container } from 'pixi.js';
import { MOBA_SKY } from '../config';
import { viewWidth } from '../core/viewport';
import type { HostSync } from '../net/HostSync';
import type Arrow from '../objects/Arrow';
import { Comet } from '../objects/Comet';
import type { Background } from '../rendering/Background';
import { worldWidth } from '../systems/battlefield';
import { cometAt, daySky, eclipseAt, eclipsesUntil, sweptNear } from '../systems/dayCycle';

/** How often the host sends the sky's clock, and how far a guest's may drift before it jumps to it. */
const SKY_SYNC_MS = 5000;
const SKY_DRIFT_MS = 150;

export interface MobaSkyDeps {
  world: Container;
  background(): Background;
  arrows(): readonly Arrow[];
  hostSync(): HostSync | undefined;
  /** A co-op guest: the host's clock and comet hits. */
  guest: boolean;
  /** Host or alone: player `by` struck the comet at `at` (his gold). */
  struck?(by: number, at: { x: number; y: number }): void;
}

/**
 * MOBA's sky as the match runs (systems/dayCycle.ts from the match time and a seed; drawn by Background.daySky): the
 * days, nights and eclipses, and each eclipse's comet, flown here in the world. Host or alone: picks the seed, sends the
 * clock (`sky` event) every SKY_SYNC_MS and checks the players' arrows against the comet (`strikeComet`, after they
 * moved): the first to pass through it
 * pays its archer MOBA_SKY.cometGold and bursts it (`comet` event). ?debug: `scene.moba.sky.skip(ms)`, `eclipseSoon()`.
 */
export class MobaSky {
  private readonly comet = new Comet();
  /** The eclipses whose comet was struck. */
  private readonly struckComets = new Set<number>();
  private seed: number;
  private timeMs = 0;
  private sinceSyncMs = SKY_SYNC_MS;

  public constructor(private readonly deps: MobaSkyDeps) {
    this.seed = deps.guest ? 0 : Math.floor(Math.random() * 0x7fffffff);
    deps.world.addChild(this.comet);
  }

  /** The match time (ms) the sky shows. */
  public get time(): number {
    return this.timeMs;
  }

  /** Every frame: the clock runs on, the sky follows the camera at `viewLeft`. */
  public update(deltaMs: number, viewLeft: number): void {
    this.timeMs += deltaMs;
    const hostSync = this.deps.hostSync();
    this.sinceSyncMs += deltaMs;
    if (hostSync && this.sinceSyncMs >= SKY_SYNC_MS) {
      this.sinceSyncMs = 0;
      hostSync.push({ e: 'sky', seed: this.seed, t: Math.round(this.timeMs) });
    }
    this.deps.background().daySky?.show(daySky(this.seed, this.timeMs), viewLeft, viewWidth());
    this.updateComet();
    this.comet.update(deltaMs);
  }

  /** Co-op guest: the host's clock, or a comet struck there. */
  public applyNet(event: { e: 'sky'; seed: number; t: number } | { e: 'comet'; n: number }): void {
    if (event.e === 'comet') {
      this.strike(event.n);
      return;
    }
    this.seed = event.seed;
    if (Math.abs(event.t - this.timeMs) > SKY_DRIFT_MS) {
      this.timeMs = event.t;
    }
  }

  /** ?debug: the sky jumps `ms` on (the host's guests follow at the next sync). */
  public skip(ms: number): void {
    this.timeMs = Math.max(0, this.timeMs + ms);
    this.sinceSyncMs = SKY_SYNC_MS;
  }

  /** ?debug: jumps to 5 s before the next eclipse. */
  public eclipseSoon(): void {
    const next = eclipsesUntil(this.seed, this.timeMs + 3 * MOBA_SKY.eclipseMaxMs).find((eclipse) => eclipse.start > this.timeMs);
    if (next) {
      this.skip(next.start - 5000 - this.timeMs);
    }
  }

  public destroy(): void {
    this.comet.destroy();
  }

  private updateComet(): void {
    const eclipse = eclipseAt(this.seed, this.timeMs);
    const at = eclipse && !this.struckComets.has(eclipse.index) ? cometAt(eclipse, this.timeMs, worldWidth()) : undefined;
    if (!eclipse || !at) {
      this.comet.hide();
      return;
    }
    this.comet.fly(at.x, at.y, at.heading);
  }

  /**
   * Host or alone, once the arrows have moved this frame (`deltaMs`): the first player's arrow whose flight crossed the
   * comet's strikes it.
   */
  public strikeComet(deltaMs: number): void {
    const eclipse = eclipseAt(this.seed, this.timeMs);
    const at = eclipse && !this.struckComets.has(eclipse.index) ? cometAt(eclipse, this.timeMs, worldWidth()) : undefined;
    if (!eclipse || !at) {
      return;
    }
    const before = cometAt(eclipse, this.timeMs - deltaMs, worldWidth()) ?? at;
    const arrow = this.deps.arrows().find((shot) => {
      if (!shot.isActive || shot.isStuck || shot.hostile || shot.owner < 0) {
        return false;
      }
      const { start, end } = shot.getTravelSegment();
      return sweptNear(start, end, before, at, MOBA_SKY.cometRadius);
    });
    if (!arrow) {
      return;
    }
    this.strike(eclipse.index);
    this.deps.hostSync()?.push({ e: 'comet', n: eclipse.index });
    this.deps.struck?.(arrow.owner, { x: at.x, y: at.y });
  }

  private strike(index: number): void {
    if (this.struckComets.has(index)) {
      return;
    }
    this.struckComets.add(index);
    if (this.comet.visible) {
      this.comet.burst();
    }
  }
}
