import { ENEMY_ATTACK, PRIEST_CAST_MS } from '../../config';
import { attackImpactProgress, type AttackStyle } from '../../rendering/attackSwing';
import { CHEER_KINDS, type CheerKind } from '../../rendering/stickmanCheer';

/** A looping victory cheer, played at a slightly random tempo. */
export interface Cheer {
  kind: CheerKind;
  timeMs: number;
  tempo: number;
}

/**
 * What an enemy is busy doing (pure, tested): a swing under way (its style, and the damage dealt when it lands), the
 * pause before the next, a spell being cast (the priest's heal), a short stagger after a hit, and the cheer once the
 * enemies have won.
 */
export class EnemyActions {
  private attackTimerMs = 0;
  /** The swing under way (a black knight picks one of its three each time). */
  private swingStyle: AttackStyle;
  /** Damage to deal when the current swing lands. */
  private pendingImpact?: () => void;
  private cooldownMs = 0;
  /** Time left of a spell being cast (the priest's heal). */
  private castTimerMs = 0;
  /** What the spell does when the cast ends (lost if it is cut short). */
  private pendingSpell?: () => void;
  private staggerMs = 0;
  /** Set when the enemies win. */
  public cheer?: Cheer;

  public constructor(
    private readonly attackStyles: readonly AttackStyle[],
    style: AttackStyle,
    private readonly random: () => number = Math.random,
  ) {
    this.swingStyle = style;
  }

  /** The swing under way (or the last one). */
  public get style(): AttackStyle {
    return this.swingStyle;
  }

  /** Mid-swing (its club on the way). */
  public get swinging(): boolean {
    return this.attackTimerMs > 0;
  }

  public get casting(): boolean {
    return this.castTimerMs > 0;
  }

  /** Starts a swing (`style`, or one of its swings at random); `onImpact` runs when it lands. Returns the style. */
  public swing(onImpact?: () => void, style?: AttackStyle): AttackStyle {
    this.swingStyle = style ?? this.attackStyles[Math.floor(this.random() * this.attackStyles.length)];
    this.attackTimerMs = ENEMY_ATTACK.animationMs;
    this.pendingImpact = onImpact;
    return this.swingStyle;
  }

  /** Runs the swing's clock on and lands the hit at its strike key; returns how far through it is. */
  public advanceSwing(deltaMs: number): number {
    this.attackTimerMs = Math.max(0, this.attackTimerMs - deltaMs);
    const progress = 1 - this.attackTimerMs / ENEMY_ATTACK.animationMs;
    if (this.pendingImpact && progress >= attackImpactProgress(this.swingStyle)) {
      const impact = this.pendingImpact;
      this.pendingImpact = undefined;
      impact();
    }
    return progress;
  }

  /** The pause between swings runs down all the time, also while the target is out of reach. */
  public tickCooldown(deltaMs: number): void {
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);
  }

  /** Free to start a swing (not mid-swing or casting, pause over): starts the pause and returns true. */
  public tryStartCooldown(intervalMs: number): boolean {
    if (this.attackTimerMs > 0 || this.castTimerMs > 0 || this.cooldownMs > 0) {
      return false;
    }
    this.cooldownMs = intervalMs;
    return true;
  }

  /** Raises the scepter for PRIEST_CAST_MS; `onDone` runs when the cast ends (not if it is cut short). */
  public cast(onDone?: () => void): void {
    this.castTimerMs = PRIEST_CAST_MS;
    this.pendingSpell = onDone;
  }

  /** Runs the cast on (the spell goes off at its end); returns how far through it is. */
  public advanceCast(deltaMs: number): number {
    this.castTimerMs = Math.max(0, this.castTimerMs - deltaMs);
    if (this.castTimerMs === 0 && this.pendingSpell) {
      const spell = this.pendingSpell;
      this.pendingSpell = undefined;
      spell();
    }
    return 1 - this.castTimerMs / PRIEST_CAST_MS;
  }

  /** Staggered by a hit for at least `ms`. */
  public stagger(ms: number): void {
    this.staggerMs = Math.max(this.staggerMs, ms);
  }

  /** Runs the stagger down; true while it lasts. */
  public tickStagger(deltaMs: number): boolean {
    this.staggerMs = Math.max(0, this.staggerMs - deltaMs);
    return this.staggerMs > 0;
  }

  /** Swing and cast cut short (the swing's damage never lands). */
  public interrupt(): void {
    this.attackTimerMs = 0;
    this.castTimerMs = 0;
    this.pendingImpact = undefined;
    this.pendingSpell = undefined;
  }

  /** Everything cut short, the stagger too (knocked down, thrown, cheering). */
  public stop(): void {
    this.interrupt();
    this.staggerMs = 0;
  }

  /** The enemies won: stops and picks one of the cheers. */
  public celebrate(): void {
    this.cheer = {
      kind: CHEER_KINDS[Math.floor(this.random() * CHEER_KINDS.length)],
      timeMs: this.random() * 200,
      tempo: 0.9 + this.random() * 0.2,
    };
    this.stop();
  }

  /** Plays the cheer on at its tempo. */
  public advanceCheer(deltaMs: number): Cheer | undefined {
    if (this.cheer) {
      this.cheer.timeMs += deltaMs * this.cheer.tempo;
    }
    return this.cheer;
  }
}
