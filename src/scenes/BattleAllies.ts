import type { Container } from 'pixi.js';
import { ALLIES } from '../config';
import { getEnemyStats } from '../data/enemies';
import { ALLY_TYPES } from '../data/enemyKinds';
import { shownDamage } from '../rendering/damagePopup';
import Enemy, { type HitInfo } from '../objects/enemy/Enemy';
import { nextOrder, type AllyOrder } from '../systems/allyOrders';
import { AllyRoster, type AllySlotState } from '../systems/allyRoster';
import type { AllyType } from '../types';

export interface BattleAlliesDeps {
  world: Container;
  /** The level's soldiers (shared with CombatSystem); the fallen stay as corpses. */
  list: Enemy[];
  /** A soldier took a hit (damage numbers). */
  onDamaged?(ally: Enemy, amount: number, hit?: HitInfo): void;
}

/**
 * The player's soldiers in a level (each level starts with none): summoned from beyond the left edge, up to each kind's
 * limit and from a reserve trained one at a time (systems/allyRoster.ts), and the order they all follow (systems/allyOrders.ts).
 * What they do each frame is systems/AllyAI.ts.
 */
export class BattleAllies {
  public order: AllyOrder = 'hold';
  private readonly roster = new AllyRoster();

  public constructor(private readonly deps: BattleAlliesDeps) {}

  public get list(): Enemy[] {
    return this.deps.list;
  }

  /** Training runs with the game. */
  public update(deltaMs: number): void {
    this.roster.tick(deltaMs, (type) => this.alive(type));
  }

  public alive(type: AllyType): number {
    return this.list.filter((ally) => ally.kind === type && ally.isAlive()).length;
  }

  /** A soldier of `type` comes in from beyond the left edge, if one is ready in the reserve. */
  public summon(type: AllyType): Enemy | undefined {
    if (!this.roster.canSummon(type)) {
      return undefined;
    }
    this.roster.summoned(type);
    const stats = getEnemyStats(type, 1);
    const ally = new Enemy(ALLIES.spawnX, stats.health, stats.speed, 'bowman', type);
    // Called before the hit lands, so its health is what the hit takes from.
    ally.onDamaged = (amount, hit) => this.deps.onDamaged?.(ally, shownDamage(amount, ally.currentHealth), hit);
    this.list.push(ally);
    this.deps.world.addChild(ally);
    return ally;
  }

  public cycleOrder(): AllyOrder {
    this.order = nextOrder(this.order);
    return this.order;
  }

  /** The HUD's slots, in its order. */
  public slots(): AllySlotState[] {
    return ALLY_TYPES.map((type) => this.roster.slot(type, this.alive(type)));
  }

  /** The level is won: the soldiers still standing cheer. */
  public celebrate(): void {
    this.list.filter((ally) => ally.isAlive()).forEach((ally) => ally.celebrate());
  }
}
