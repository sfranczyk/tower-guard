import { SHAMAN } from '../config';
import { ARCHETYPES, type EnemyArchetype, type EnemyTraits } from '../data/enemyKinds';
import type { Vec2 } from '../types';

/**
 * The goblin shaman's spells (pure): what each kind of enemy gets, who a cast reaches, and a buff running on an enemy.
 * haste: the soldiers walk faster; stoneskin: the heavies take less damage and can't be pinned or knocked back;
 * quickDraw: archers draw and shoot sooner; blast: kamikazes run a little faster and their bomb is bigger;
 * mend: the undead (whom the priest can't heal) get health back at once.
 */
export type ShamanBuff = 'haste' | 'stoneskin' | 'quickDraw' | 'blast' | 'mend';

/** The buffs that last (mend is a one-off heal), in the order the co-op snapshot numbers them. */
export const LASTING_BUFFS = ['haste', 'stoneskin', 'quickDraw', 'blast'] as const;
export type LastingBuff = typeof LASTING_BUFFS[number];

/** What the shaman casts on an enemy of this archetype and traits; nothing for flyers and the other casters. */
export const shamanBuffFor = (archetype: EnemyArchetype, traits: EnemyTraits): ShamanBuff | undefined => {
  const info = ARCHETYPES[archetype];
  if (info.flies || info.heals || info.buffs) {
    return undefined;
  }
  if (!traits.healable) {
    return 'mend';
  }
  if (info.detonates) {
    return 'blast';
  }
  if (info.shoots) {
    return 'quickDraw';
  }
  return archetype === 'heavy' ? 'stoneskin' : 'haste';
};

export interface BuffCandidate {
  at: Vec2;
  /** What it would get (shamanBuffFor). */
  buff: ShamanBuff | undefined;
  /** Already under a lasting buff. */
  buffed: boolean;
  /** Health it is missing (for mend). */
  missing: number;
}

/** Who a cast from `from` reaches (indexes into `candidates`): within radius, not already buffed (the undead: wounded), nearest first, up to `max`. */
export const planBuffs = (from: Vec2, candidates: readonly BuffCandidate[], radius = SHAMAN.radius, max = SHAMAN.perCast): number[] =>
  candidates
    .map((candidate, index) => ({ candidate, index, distance: Math.hypot(candidate.at.x - from.x, candidate.at.y - from.y) }))
    .filter(({ candidate: { buff, buffed, missing }, distance }) =>
      buff !== undefined && distance <= radius && (buff === 'mend' ? missing > 0 : !buffed))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, max)
    .map(({ index }) => index);

/** A lasting buff on an enemy: which one and the time left, and what it changes. */
export class ActiveBuff {
  public kind?: LastingBuff;
  public leftMs = 0;

  public apply(kind: LastingBuff, durationMs = SHAMAN.durationMs): void {
    this.kind = kind;
    this.leftMs = durationMs;
  }

  public update(deltaMs: number): void {
    this.leftMs = Math.max(0, this.leftMs - deltaMs);
    if (this.leftMs === 0) {
      this.kind = undefined;
    }
  }

  public clear(): void {
    this.kind = undefined;
    this.leftMs = 0;
  }

  /** Walking pace × this. */
  public get speedFactor(): number {
    return this.kind === 'haste' ? SHAMAN.haste : this.kind === 'blast' ? SHAMAN.kamikazeHaste : 1;
  }

  /** Damage taken × this. */
  public get damageFactor(): number {
    return this.kind === 'stoneskin' ? SHAMAN.stoneskinDamage : 1;
  }

  /** An archer's draw and pause between shots × this. */
  public get drawPace(): number {
    return this.kind === 'quickDraw' ? SHAMAN.drawPace : 1;
  }

  /** A kamikaze's blast × this. */
  public get blastPower(): number {
    return this.kind === 'blast' ? SHAMAN.blastPower : 1;
  }

  /** Stone skin: no pin holds it and no blast knocks it back. */
  public get steady(): boolean {
    return this.kind === 'stoneskin';
  }

  /** For the co-op snapshot: [kind index, ms left], or undefined without a buff. */
  public get net(): [number, number] | undefined {
    return this.kind ? [LASTING_BUFFS.indexOf(this.kind), Math.round(this.leftMs)] : undefined;
  }

  public applyNet(net: readonly [number, number] | undefined): void {
    const kind = net ? LASTING_BUFFS[net[0]] : undefined;
    if (kind && net) {
      this.apply(kind, net[1]);
    } else {
      this.clear();
    }
  }
}
