import { DRAGON_TURN_MS } from '../../config';
import { facingScale, nextHoverSide, stepFacing, type HoverSide } from '../../systems/dragonFlight';
import { flightShare, kick, startManoeuvre, stepManoeuvre, type ManoeuvreState } from '../../systems/dragonManoeuvre';
import { buffetOffset } from '../../systems/vortex';
import type { Vec2 } from '../../types';
import type { DragonLook } from './dragonKinds';

/** Co-op: the flight look (wings held spread 0..1, nose-down pitch, wing beat speed). */
export type FlightNet = [number, number, number];

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * A dragon's flight (DragonEnemy's part, no Pixi): its hovers and flights between them (systems/dragonManoeuvre.ts),
 * the fire dragon's strafing runs, the side of its target it keeps to and its turn, turbulence and hit jolts on top, and the wing beat's clock.
 */
export class DragonMotion {
  /** The side of its target it hovers on (1: to the right, facing left), and its facing mid-turn (−1 left … 1 right). */
  public side: HoverSide = 1;
  public facing = -1;
  /** The wing beat's clock (beats faster climbing). */
  public wingMs: number;
  private readonly manoeuvre: ManoeuvreState;
  /** Thrown about by turbulence (a vortex arrow) and jolted by hits: the offset added to where it flies (px). */
  private offset = { x: 0, y: 0 };

  public constructor(private readonly look: DragonLook, timeMs: number) {
    this.wingMs = timeMs;
    this.manoeuvre = startManoeuvre(look.altitude, look.hoverOffset);
  }

  /** Which way it faces (−1 left, 1 right; mid-turn, the way it's turning to). */
  public get facingX(): HoverSide {
    return -this.side as HoverSide;
  }

  public get isTurning(): boolean {
    return this.facing !== this.facingX;
  }

  /** How fast it is flying, as a share of DRAGON_FLIGHT.transitSpeed (0..1). */
  public get flightSpeed(): number {
    return flightShare(this.manoeuvre);
  }

  /** Wings held spread (0..1), for the pose. */
  public get glide(): number {
    return this.manoeuvre.glide;
  }

  /** The sprite's x scale for its facing (squeezed mid-turn). */
  public get scaleX(): number {
    return facingScale(this.facing);
  }

  /**
   * One frame of flight (host): moves `pos` towards its hover point in front of `targetX`, or on to the next one,
   * then the turbulence and any hit jolt on top. Celebrating it keeps its side; busy (`hold`) it doesn't set off.
   */
  public fly(pos: Vec2, input: {
    targetX: number; timeMs: number; deltaMs: number; followSpeed: number; turbulence: number; cheering: boolean; hold: boolean;
    strafe?: { reach: number; altitude: number }; waiting?: boolean;
  }): void {
    const { manoeuvre } = this;
    // Everyone in the keep: a dragon with somewhere to wait (the fire dragon) waits there, without strafes.
    const waiting = input.waiting === true && this.look.waits !== undefined;
    pos.x -= this.offset.x;
    pos.y -= this.offset.y;
    // On a strafing run it keeps the side it started from, even once its target is behind it.
    if (manoeuvre.strafe) {
      this.side = manoeuvre.strafe.side;
    } else if (!input.cheering) {
      this.side = nextHoverSide(pos.x, input.targetX, this.side, manoeuvre.offset);
    }
    stepManoeuvre(manoeuvre, pos, {
      targetX: input.targetX, side: this.side, timeMs: input.timeMs, deltaMs: input.deltaMs, followSpeed: input.followSpeed,
      ranges: waiting ? this.look.waits ?? this.look.hovers : this.look.hovers, hold: input.hold, strafe: waiting ? undefined : input.strafe,
      turning: this.isTurning, waiting, rng: Math.random,
    });
    if (manoeuvre.strafe) {
      this.side = manoeuvre.strafe.side;
    }
    const gust = buffetOffset(input.timeMs, input.turbulence);
    this.offset = { x: gust.x + manoeuvre.jolt.x, y: gust.y + manoeuvre.jolt.y };
    pos.x += this.offset.x;
    pos.y += this.offset.y;
  }

  /** On a strafing run (the fire dragon): it breathes only when the run lights the fire. */
  public get isStrafing(): boolean {
    return this.manoeuvre.strafe !== undefined;
  }

  /** True once when a strafing run is to light the fire (it has just reared its head at its start). */
  public takeStrafeIgnite(): boolean {
    const { strafe } = this.manoeuvre;
    if (!strafe?.ignite) {
      return false;
    }
    strafe.ignite = false;
    return true;
  }

  /** The enemies won: it stays where it hovers. */
  public stay(): void {
    this.manoeuvre.strafe = undefined;
    this.manoeuvre.phase = 'hover';
    this.manoeuvre.hoverLeftMs = Infinity;
  }

  /** Hit from the left (`fromLeft`) or the right: a small jolt away from the arrow. */
  public kick(fromLeft: boolean): void {
    kick(this.manoeuvre, fromLeft);
  }

  /** The wing beat (at its flap rate) and the turn, over `deltaMs`. */
  public step(deltaMs: number): void {
    this.wingMs += deltaMs * this.manoeuvre.flapRate;
    if (this.isTurning) {
      this.facing = stepFacing(this.facing, this.facingX, deltaMs, DRAGON_TURN_MS);
    }
  }

  /** Its rotation: tilted by the gusts, nose down diving and up braking (either way it faces). */
  public tilt(timeMs: number, turbulence: number): number {
    return buffetOffset(timeMs, turbulence).tilt + this.manoeuvre.pitch * facingScale(this.facing);
  }

  public getNetState(): { side: HoverSide; fl: FlightNet } {
    const { glide, pitch, flapRate } = this.manoeuvre;
    return { side: this.side, fl: [round2(glide), round2(pitch), round2(flapRate)] };
  }

  /** Co-op guest: the host's side (the turn itself plays here) and flight look. */
  public applyNetState(side?: HoverSide, fl?: FlightNet): void {
    this.side = side ?? this.side;
    if (fl) {
      [this.manoeuvre.glide, this.manoeuvre.pitch, this.manoeuvre.flapRate] = fl;
    }
  }
}
