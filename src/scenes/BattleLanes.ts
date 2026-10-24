import type { Container } from 'pixi.js';
import { ALLIES, MOBA_LANES } from '../config';
import { getEnemyStats } from '../data/enemies';
import { isFlyingType } from '../data/enemyKinds';
import { MINION_KINDS, minionGroups, type MinionRole } from '../data/moba';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import { BLUE_DRAGON_LOOK } from '../objects/dragon/dragonKinds';
import type { HitInfo } from '../objects/enemy/Enemy';
import { shownDamage } from '../rendering/damagePopup';
import { MinionWaves } from '../systems/minionWaves';
import type { BattleAllies } from './BattleAllies';
import type { BattleEnemies } from './BattleEnemies';

export interface BattleLanesDeps {
  world: Container;
  soldiers: BattleAllies;
  foes: BattleEnemies;
  /** The blue dragons (shared with CombatSystem; the fallen stay as corpses). */
  fliers: DragonEnemy[];
  /** A blue dragon took a hit (damage numbers). */
  onDamaged?(dragon: DragonEnemy, amount: number, hit?: HitInfo): void;
}

/**
 * MOBA lanes (`?moba`): both keeps send their minions down the lane on one clock (systems/minionWaves.ts, groups in
 * data/moba.ts and config MOBA_LANES): blue ones from beyond the left edge as the player's side (soldiers in
 * BattleAllies, dragons in `fliers`; AllyAI marches them on the red keep), red ones from beyond the right edge as the
 * enemies (BattleEnemies, EnemyAI). The match ends when a keep falls (BattleOutcome).
 */
export class BattleLanes {
  private readonly waves = new MinionWaves<MinionRole>(minionGroups, () => MOBA_LANES.firstGroupMs, () => MOBA_LANES.groupSpacingMs);

  public constructor(private readonly deps: BattleLanesDeps) {}

  /** Until the match is decided (GameScene stops calling it). */
  public update(deltaMs: number): void {
    this.waves.update(deltaMs).forEach((role) => {
      this.deployBlue(role);
      this.deps.foes.spawn(MINION_KINDS.red[role]);
    });
  }

  private deployBlue(role: MinionRole): void {
    const kind = MINION_KINDS.blue[role];
    if (!isFlyingType(kind)) {
      this.deps.soldiers.deploy(kind);
      return;
    }
    const stats = getEnemyStats(kind, 1);
    const dragon = new DragonEnemy(ALLIES.spawnX - 40, stats.health, stats.speed, kind, BLUE_DRAGON_LOOK);
    dragon.faceRight();
    // Called before the hit lands, so its health is what the hit takes from.
    dragon.onDamaged = (amount, hit) => this.deps.onDamaged?.(dragon, shownDamage(amount, dragon.currentHealth), hit);
    this.deps.fliers.push(dragon);
    this.deps.world.addChild(dragon);
  }
}
