import { LEFTOVERS } from '../config';
import Enemy from '../objects/enemy/Enemy';
import type Arrow from '../objects/Arrow';
import type { Foe } from '../systems/combatGeometry';
import { leftoverAlpha, leftoverGone } from '../systems/leftovers';

/** One list of fighters the field keeps corpses of, and what is told when one is cleared away. */
export interface CorpsePool {
  list: Foe[];
  cleared?(foe: Foe): void;
}

export interface BattleLeftoversDeps {
  /** The lists holding the fallen: enemies, soldiers, MOBA's blue dragons. */
  pools(): readonly CorpsePool[];
  arrows(): readonly Arrow[];
}

/**
 * Clears the field (config LEFTOVERS): a fallen fighter fades and is gone `corpseMs` after it fell (out of its list and
 * the world, with the arrows in it), a stuck arrow `arrowMs` after it stuck. Host and co-op guest each clear their own
 * (it only changes what is drawn), so nothing is sent.
 */
export class BattleLeftovers {
  private readonly deadMs = new WeakMap<Foe, number>();
  private readonly stuckMs = new WeakMap<Arrow, number>();

  public constructor(private readonly deps: BattleLeftoversDeps) {}

  public update(deltaMs: number): void {
    const { corpseMs, arrowMs, fadeMs } = LEFTOVERS;
    const gone = new Set<Foe>();
    this.deps.pools().forEach((pool) => {
      for (let index = pool.list.length - 1; index >= 0; index -= 1) {
        const foe = pool.list[index];
        // A dead horse waits for its rider to come off (he is an enemy of his own).
        if (foe.isAlive() || (foe instanceof Enemy && foe.rider?.mount.riderPending)) {
          continue;
        }
        const age = (this.deadMs.get(foe) ?? 0) + deltaMs;
        this.deadMs.set(foe, age);
        foe.alpha = leftoverAlpha(age, corpseMs, fadeMs);
        if (leftoverGone(age, corpseMs)) {
          pool.list.splice(index, 1);
          foe.removeFromParent();
          gone.add(foe);
          pool.cleared?.(foe);
        }
      }
    });
    this.deps.arrows().forEach((arrow) => {
      if (!arrow.isActive || !arrow.isStuck) {
        return;
      }
      if (arrow.stuckTo && gone.has(arrow.stuckTo as Foe)) {
        arrow.deactivate(true);
        return;
      }
      const age = (this.stuckMs.get(arrow) ?? 0) + deltaMs;
      this.stuckMs.set(arrow, age);
      arrow.alpha = leftoverAlpha(age, arrowMs, fadeMs);
      if (leftoverGone(age, arrowMs)) {
        arrow.deactivate(true);
      }
    });
  }
}
