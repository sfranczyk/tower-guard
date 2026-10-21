import { ALLIES } from '../config';
import { ALLY_TYPES } from '../data/enemyKinds';
import type { AllyType } from '../types';

/**
 * Who may be summoned now (pure, tested): each kind keeps a reserve. Soldiers are trained one at a time
 * (`ALLIES.<type>TrainMs` each) while the reserve plus those standing are below `ALLIES.<type>Limit`; a full kind waits,
 * and a fallen one frees his place, so training goes on. The player summons from the reserve, as many as are ready.
 * A level starts with an empty reserve. Training runs with the game (`tick` from the scene's update), so it waits while
 * it is paused; limits and training times are read when used, so the tuning panel changes them live.
 */

export const allyLimit = (type: AllyType): number => ALLIES[`${type}Limit`];
export const allyTrainMs = (type: AllyType): number => ALLIES[`${type}TrainMs`];

/** One slot of the HUD: how many are ready, how many stand of how many allowed, and the share of the next one's training still to run (0 = none training). */
export interface AllySlotState {
  type: AllyType;
  ready: number;
  alive: number;
  limit: number;
  cooldown: number;
}

export class AllyRoster {
  private readonly ready = new Map<AllyType, number>();
  private readonly trainedMs = new Map<AllyType, number>();

  /** Trains the next of each kind with room for him (`alive` standing). */
  public tick(deltaMs: number, alive: (type: AllyType) => number): void {
    ALLY_TYPES.forEach((type) => {
      if (!this.hasRoom(type, alive(type))) {
        return;
      }
      const trained = (this.trainedMs.get(type) ?? 0) + deltaMs;
      if (trained >= allyTrainMs(type)) {
        this.ready.set(type, this.readyOf(type) + 1);
        this.trainedMs.set(type, 0);
      } else {
        this.trainedMs.set(type, trained);
      }
    });
  }

  public readyOf(type: AllyType): number {
    return this.ready.get(type) ?? 0;
  }

  /** One of `type` waits in the reserve. */
  public canSummon(type: AllyType): boolean {
    return this.readyOf(type) > 0;
  }

  /** One `type` left the reserve for the field. */
  public summoned(type: AllyType): void {
    this.ready.set(type, Math.max(0, this.readyOf(type) - 1));
  }

  public slot(type: AllyType, alive: number): AllySlotState {
    const training = this.hasRoom(type, alive);
    const share = training ? 1 - Math.min(1, (this.trainedMs.get(type) ?? 0) / Math.max(1, allyTrainMs(type))) : 0;
    return { type, ready: this.readyOf(type), alive, limit: allyLimit(type), cooldown: share };
  }

  private hasRoom(type: AllyType, alive: number): boolean {
    return this.readyOf(type) + alive < allyLimit(type);
  }
}
