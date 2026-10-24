import type { Container } from 'pixi.js';
import { ALLIES, MOBA_LANES } from '../config';
import { getEnemyStats } from '../data/enemies';
import { isFlyingType } from '../data/enemyKinds';
import { MINION_KINDS, minionGroups, type MinionRole, type Team } from '../data/moba';
import type { Foe } from '../systems/combatGeometry';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import { BLUE_DRAGON_LOOK } from '../objects/dragon/dragonKinds';
import type { HitInfo } from '../objects/enemy/Enemy';
import { shownDamage } from '../rendering/damagePopup';
import { MinionWaves } from '../systems/minionWaves';
import { minionPower } from '../data/upgrades';
import type { BattleAllies } from './BattleAllies';
import type { BattleEnemies } from './BattleEnemies';

/** Health bar colours of the two sides' minions. */
const TEAM_BAR_COLORS: Readonly<Record<Team, number>> = { blue: 0x5fb4ff, red: 0xe0524a };

export interface BattleLanesDeps {
  world: Container;
  soldiers: BattleAllies;
  foes: BattleEnemies;
  /** The blue dragons (shared with CombatSystem; the fallen stay as corpses). */
  fliers: DragonEnemy[];
  /** A blue dragon took a hit (damage numbers). */
  onDamaged?(dragon: DragonEnemy, amount: number, hit?: HitInfo): void;
  /** The level of a team's minions of `role` (1 = none bought; MobaUpgrades). */
  level?(team: Team, role: MinionRole): number;
  /** Every new minion, its team and role (its last hit pays gold: BattleMoba.watch). */
  spawned?(unit: Foe, team: Team, role: MinionRole): void;
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
      (['blue', 'red'] as const).forEach((team) => {
        const level = this.deps.level?.(team, role) ?? 1;
        const power = minionPower(level);
        const unit = team === 'blue' ? this.deployBlue(role, power) : this.deps.foes.spawn(MINION_KINDS.red[role], undefined, power);
        BattleLanes.mark(unit, team, level);
        this.deps.spawned?.(unit, team, role);
      });
    });
  }

  /** Its team's colour on the health bar, its level as stars under it. */
  private static mark(unit: Foe, team: Team, level: number): void {
    const color = TEAM_BAR_COLORS[team];
    if (unit instanceof DragonEnemy) {
      unit.barColor = color;
      unit.setStars(level - 1);
    } else {
      unit.bars.teamColor = color;
      unit.bars.setStars(level - 1);
      unit.drawHealthBar();
    }
  }

  private deployBlue(role: MinionRole, power: number): Foe {
    const kind = MINION_KINDS.blue[role];
    if (!isFlyingType(kind)) {
      return this.deps.soldiers.deploy(kind, power);
    }
    const stats = getEnemyStats(kind, 1);
    const dragon = new DragonEnemy(ALLIES.spawnX - 40, stats.health * power, stats.speed, kind, BLUE_DRAGON_LOOK);
    dragon.power = power;
    dragon.faceRight();
    // Called before the hit lands, so its health is what the hit takes from.
    dragon.onDamaged = (amount, hit) => this.deps.onDamaged?.(dragon, shownDamage(amount, dragon.currentHealth), hit);
    this.deps.fliers.push(dragon);
    this.deps.world.addChild(dragon);
    return dragon;
  }
}
