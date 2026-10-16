import { KAMIKAZE_BOMB } from '../config';

/**
 * What can set a kamikaze's bomb off: dying in a blast (another bomb or an explosive arrow) or from a fall, reaching
 * a bowman or the keep, a fire arrow or lightning striking it. Any other death (arrows, burns, …) is silent.
 */
export type BombTrigger = 'blast' | 'fall' | 'contact' | 'fire' | 'lightning';

/** The chance `trigger` sets the bomb off; frozen in ice it never goes off (it shatters). */
export function bombChance(trigger: BombTrigger, frozen: boolean): number {
  if (frozen) {
    return 0;
  }
  if (trigger === 'fire') {
    return KAMIKAZE_BOMB.fireChance;
  }
  if (trigger === 'lightning') {
    return KAMIKAZE_BOMB.lightningChance;
  }
  return 1;
}

export const bombGoesOff = (trigger: BombTrigger, frozen: boolean, roll = Math.random()): boolean => roll < bombChance(trigger, frozen);

/**
 * The chance a kamikaze caught in a blast is set off by it (medium and hard: EnemyEdge.chainFalloff): the bomb a bowman
 * set off (arrow, fire, lightning, contact, an explosive arrow's blast) is link 0, the ones its blast catches link 1,
 * and so on; each link `falloff` less likely than the one before, with no end to the chain. Else it's a dud.
 */
export const chainChance = (link: number, falloff: number): number => (1 - falloff) ** link;

/**
 * Bombs lit by a blast, each going off KAMIKAZE_BOMB.chainDelayMs after it was lit (counted in game time, so a pause
 * holds them): a group of kamikazes blows up one after another, every bomb as strong as the first.
 */
export class BombFuses<T> {
  private fuses: { bomb: T; msLeft: number }[] = [];

  public light(bomb: T): void {
    this.fuses.push({ bomb, msLeft: KAMIKAZE_BOMB.chainDelayMs });
  }

  /** The bombs whose fuse burnt down this frame (lit in the order they were). */
  public tick(deltaMs: number): T[] {
    this.fuses.forEach((fuse) => {
      fuse.msLeft -= deltaMs;
    });
    const due = this.fuses.filter((fuse) => fuse.msLeft <= 0);
    this.fuses = this.fuses.filter((fuse) => fuse.msLeft > 0);
    return due.map((fuse) => fuse.bomb);
  }
}
