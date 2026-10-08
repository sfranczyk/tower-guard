import { Graphics } from 'pixi.js';
import { CHILL_TINT, FROZEN_TINT, LEVITATE_TINT, drawAirVortex, drawArcaneAura, drawFrostGlints, drawIceBlock } from '../rendering/afflictionArt';
import { drawBurning } from '../rendering/burning';
import { NO_AFFLICTIONS, chill, ignite, tickAfflictions, timeScale, type Afflictions } from '../systems/afflictions';
import { DRAGON_TURBULENCE_MS } from '../config';
import { turbulenceStrength } from '../systems/vortex';
import type { EnemyType, Vec2 } from '../types';

/** A burn fades out over its last this many ms. */
const BURN_FADE_MS = 600;

/** A bowman's own fire, unlike an enemy's: how long it burns, and how big and slow to fade its flames are. */
export interface AfflictionOptions {
  burnMs?: number;
  flameSize?: number;
  burnFadeMs?: number;
}
/** Held by a vortex while it's pulled this recently (ms). */
const VORTEX_HOLD_MS = 120;

/** What the guest needs to show an enemy's afflictions (co-op snapshot). */
export interface AfflictionNet {
  burn?: number;
  chill?: number;
  frozen?: number;
  /** Lifted off the ground by a vortex (px) and leaning into it (radians). */
  lift?: number;
  lean?: number;
  /** Levitating (hit by a vortex arrow), glowing. */
  lev?: boolean;
  /** A dragon in turbulence (hit by a vortex arrow): ms left. */
  turb?: number;
}

/**
 * An enemy's fire, frost and vortex state (systems/afflictions.ts) and their look: flames, frost glints or a block
 * of ice, drawn into `art` (a child of the enemy, over its body) from the body points it is given.
 */
export class AfflictionLayer {
  public readonly art = new Graphics();
  private state: Afflictions = { ...NO_AFFLICTIONS };
  private clockMs = Math.random() * 1000;
  /** Vortex: still being pulled (ms left), how high it's lifted and how far it leans towards the centre. */
  private vortexHoldMs = 0;
  public lift = 0;
  public lean = 0;
  /** Held up by the vortex arrow that hit it (glowing), rather than caught in the funnel. */
  public levitating = false;
  /** A dragon a vortex arrow hit: buffeted by a ring of wind for this long (ms). */
  private turbulenceMs = 0;
  /** A brute in a vortex's reach: walking at this pace while it's held (ms left). */
  private headwindFactor = 1;
  private headwindMs = 0;

  public constructor(private readonly type: EnemyType, private readonly options: AfflictionOptions = {}) {}

  /** How fast the enemy does everything (0 frozen, FROST_SLOW chilled, 1 normal). */
  public get timeScale(): number {
    return timeScale(this.state);
  }

  public get isBurning(): boolean {
    return this.state.burnMs > 0;
  }

  public get burnMs(): number {
    return this.state.burnMs;
  }

  public get isFrozen(): boolean {
    return this.state.frozenMs > 0;
  }

  public get isChilled(): boolean {
    return this.state.chillMs > 0;
  }

  /** Being dragged by a vortex right now (it can't walk or swing meanwhile). */
  public get inVortex(): boolean {
    return this.vortexHoldMs > 0;
  }

  /** How fast it walks against a vortex's wind (1 = no wind). */
  public get headwind(): number {
    return this.headwindMs > 0 ? this.headwindFactor : 1;
  }

  /** In a vortex's reach this frame but too heavy to be caught: it walks at `factor` of its pace. */
  public slowByWind(factor: number): void {
    this.headwindFactor = factor;
    this.headwindMs = VORTEX_HOLD_MS;
  }

  /** A dragon in turbulence (it can't breathe fire, its rider aims badly). */
  public get isTurbulent(): boolean {
    return this.turbulenceMs > 0;
  }

  /** How strong the turbulence is now (0..1, fading in and out). */
  public get turbulence(): number {
    return turbulenceStrength(this.turbulenceMs);
  }

  /** Hit by a vortex arrow (a dragon): a ring of wind swirls round it for DRAGON_TURBULENCE_MS. */
  public stir(): void {
    this.turbulenceMs = DRAGON_TURBULENCE_MS;
  }

  /** Set alight; returns true if it just caught fire. */
  public ignite(): boolean {
    const caught = this.state.burnMs <= 0;
    this.state = ignite(this.state, this.type, this.options.burnMs);
    return caught && this.state.burnMs > 0;
  }

  /** Hit by a frost arrow; returns true if it just froze solid. */
  public chill(headshot: boolean): boolean {
    const { state, froze } = chill(this.state, this.type, headshot);
    this.state = state;
    return froze;
  }

  /** Thrown down, killed or blown apart: the ice breaks and the vortex and turbulence let go (a fire keeps burning). */
  public thaw(): void {
    this.state = { ...this.state, frozenMs: 0 };
    this.turbulenceMs = 0;
    this.releaseVortex();
  }

  /** Warmed by fire or freed by a blast (the bowman, whose burn is his own): the ice and the chill are gone. */
  public warm(): void {
    this.state = { ...this.state, chillMs: 0, chillHits: 0, frozenMs: 0 };
  }

  /** Blown apart or shattered: nothing left to burn. */
  public extinguish(): void {
    this.state = { ...this.state, burnMs: 0 };
  }

  /** Held this frame by a vortex: lifted `lift` px, turned `lean`; `levitating` when it's the one the arrow hit. */
  public holdInVortex(lift: number, lean: number, levitating = false): void {
    this.vortexHoldMs = VORTEX_HOLD_MS;
    this.lift = lift;
    this.lean = lean;
    this.levitating = levitating;
  }

  public releaseVortex(): void {
    this.vortexHoldMs = 0;
    this.lift = 0;
    this.lean = 0;
    this.levitating = false;
  }

  /** Counts the timers down (real time, not slowed by the chill itself). */
  public tick(deltaMs: number): void {
    this.clockMs += deltaMs;
    this.state = tickAfflictions(this.state, deltaMs);
    this.turbulenceMs = Math.max(0, this.turbulenceMs - deltaMs);
    this.headwindMs = Math.max(0, this.headwindMs - deltaMs);
    if (this.vortexHoldMs > 0) {
      this.vortexHoldMs = Math.max(0, this.vortexHoldMs - deltaMs);
      if (this.vortexHoldMs === 0) {
        this.releaseVortex();
      }
    }
  }

  /** The tint for the body: icy while frozen, cold blue while chilled, violet while levitating. */
  public get tint(): number {
    return this.isFrozen ? FROZEN_TINT : this.isChilled ? CHILL_TINT : this.levitating ? LEVITATE_TINT : 0xffffff;
  }

  /**
   * Draws the afflictions over the body: `points` are its body points in the art's (container) space, `size`
   * the flame/glint scale; `iceBox` the points the ice block is fitted around (the standing figure).
   */
  public draw(points: readonly Vec2[], size: number, iceBox: readonly Vec2[] = points): void {
    const g = this.art.clear();
    if (this.isTurbulent) {
      drawAirVortex(g, points, this.clockMs, size, this.turbulence);
    }
    if (this.levitating) {
      drawArcaneAura(g, points, this.clockMs, size);
    }
    if (this.isFrozen) {
      drawIceBlock(g, iceBox, this.clockMs, size, Math.min(1, this.state.frozenMs / 250));
    } else if (this.isChilled) {
      drawFrostGlints(g, points, this.clockMs, size);
    }
    if (this.isBurning) {
      const { flameSize = size, burnFadeMs = BURN_FADE_MS } = this.options;
      drawBurning(g, points, this.clockMs, Math.min(1, this.state.burnMs / burnFadeMs), flameSize);
    }
  }

  public getNetState(): AfflictionNet | undefined {
    const { burnMs, chillMs, frozenMs } = this.state;
    if (burnMs <= 0 && chillMs <= 0 && frozenMs <= 0 && !this.inVortex && !this.isTurbulent) {
      return undefined;
    }
    const round = (value: number): number | undefined => (value > 0 ? Math.round(value) : undefined);
    return {
      burn: round(burnMs), chill: round(chillMs), frozen: round(frozenMs),
      lift: this.inVortex ? Math.round(this.lift * 10) / 10 : undefined,
      lean: this.inVortex ? Math.round(this.lean * 100) / 100 : undefined,
      lev: this.levitating || undefined,
      turb: round(this.turbulenceMs),
    };
  }

  /** Co-op guest: the host's afflictions (its timers keep counting down here until the next snapshot). */
  public applyNetState(net: AfflictionNet | undefined): void {
    this.state = { burnMs: net?.burn ?? 0, chillMs: net?.chill ?? 0, chillHits: 0, frozenMs: net?.frozen ?? 0 };
    this.turbulenceMs = net?.turb ?? 0;
    if (net?.lift !== undefined || net?.lean !== undefined) {
      this.holdInVortex(net.lift ?? 0, net.lean ?? 0, net.lev ?? false);
    } else {
      this.releaseVortex();
    }
  }
}
