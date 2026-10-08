import { stepFlight, type Flight } from './flight';
import { groundAt } from './terrain';

/** Co-op: a thrown body's flight for the guest (its position comes in the snapshot). */
export interface ThrowNet {
  vx: number;
  spin: number;
}

/** One step of a throw: landed or not, how hard it hit the ground, and the flight as it is after the step. */
export interface ThrowStep {
  landed: boolean;
  impactSpeed: number;
  flight: Flight;
}

/**
 * What enemies and bowmen share when the arrows' effects take hold of them (pure, tested): thrown through the air by
 * a vortex (falling, tumbling, landing; a co-op guest's copy is moved by the host and only tumbles here), and pinned
 * to the ground by the foot. The vortex's hold itself is AfflictionLayer's; how each lands and looks is its own.
 */
export class BodyMotion {
  private flightState?: Flight;
  /** Co-op guest: the host moves it while it flies (this side only tumbles it). */
  public fromNet = false;
  /** Host: told when it lands from a throw, with the speed it hit the ground at (for the fall damage). */
  public onLanded?: (impactSpeed: number) => void;
  private pinMs = 0;

  /** The throw it's in (undefined on the ground). */
  public get flight(): Readonly<Flight> | undefined {
    return this.flightState;
  }

  public get isThrown(): boolean {
    return this.flightState !== undefined;
  }

  /** Thrown from (`x`, `y`) at (`vx`, `vy`) px/s, starting turned `rotation` and tumbling at `spin` radians/s. */
  public throw(x: number, y: number, vx: number, vy: number, spin: number, rotation: number): void {
    this.flightState = { x, y, vx, vy, rotation, spin, timeMs: 0 };
  }

  /**
   * One step of the throw (x kept within `minX`..`maxX`). `driven` (a co-op guest's copy): it stays where the host
   * put it and lands once it's coming down at the ground (`placeFlight` gives that). Not landed, the flight moves on.
   */
  public step(deltaMs: number, minX: number, maxX: number, driven = false): ThrowStep {
    const flight = this.flightState!;
    const step = stepFlight(flight, deltaMs, groundAt, minX, maxX);
    if (driven) {
      const landed = flight.vy > 0 && flight.y >= groundAt(flight.x) - 0.5;
      const held = { ...step.flight, x: flight.x, y: flight.y, vy: flight.vy };
      if (!landed) {
        this.flightState = held;
      }
      return { landed, impactSpeed: step.impactSpeed, flight: held };
    }
    if (!step.landed) {
      this.flightState = step.flight;
    }
    return { landed: step.landed, impactSpeed: step.impactSpeed, flight: step.flight };
  }

  /** Co-op guest: the host has it at (`x`, `y`), going down if `vy` > 0 (kept as it was if not given). */
  public placeFlight(x: number, y: number, vy?: number): void {
    if (this.flightState) {
      this.flightState = { ...this.flightState, x, y, vy: vy ?? this.flightState.vy };
    }
  }

  /** On the ground again (it landed, or was blown apart up there): returns who to tell it landed, once. */
  public endFlight(): ((impactSpeed: number) => void) | undefined {
    this.flightState = undefined;
    this.fromNet = false;
    const landed = this.onLanded;
    this.onLanded = undefined;
    return landed;
  }

  /** Co-op: the throw for the guest (rounded). */
  public get netThrow(): ThrowNet | undefined {
    const flight = this.flightState;
    return flight ? { vx: Math.round(flight.vx), spin: Math.round(flight.spin * 10) / 10 } : undefined;
  }

  public get isPinned(): boolean {
    return this.pinMs > 0;
  }

  /** Time left pinned (ms). */
  public get pinnedMs(): number {
    return this.pinMs;
  }

  /** Pinned for `durationMs` (a fresh pin restarts the time); returns true if it wasn't pinned before. */
  public pin(durationMs: number): boolean {
    const fresh = this.pinMs <= 0;
    this.pinMs = Math.max(this.pinMs, durationMs);
    return fresh;
  }

  /** Torn free (thrown, knocked down, killed), or the host's time left (co-op guest). */
  public setPin(ms: number): void {
    this.pinMs = Math.max(0, ms);
  }

  /** The pin's time runs down (real time: frost doesn't slow it). */
  public tickPin(deltaMs: number): void {
    this.pinMs = Math.max(0, this.pinMs - deltaMs);
  }
}
