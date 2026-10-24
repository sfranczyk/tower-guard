import { MOBA_LANES } from '../config';
import { MINION_KINDS, minionGroups, type MinionRole } from '../data/moba';
import { MinionWaves } from '../systems/minionWaves';
import type { BattleAllies } from './BattleAllies';
import type { BattleEnemies } from './BattleEnemies';

/**
 * MOBA lanes (`?moba`): both keeps send their minions down the lane on one clock (systems/minionWaves.ts, groups in
 * data/moba.ts and config MOBA_LANES): blue ones from beyond the left edge as the player's soldiers (BattleAllies,
 * AllyAI marches them on the red keep), red ones from beyond the right edge as the enemies (BattleEnemies, EnemyAI).
 * The match ends when a keep falls (BattleOutcome).
 */
export class BattleLanes {
  private readonly waves = new MinionWaves<MinionRole>(minionGroups, () => MOBA_LANES.firstGroupMs, () => MOBA_LANES.groupSpacingMs);

  public constructor(private readonly soldiers: BattleAllies, private readonly foes: BattleEnemies) {}

  /** Until the match is decided (GameScene stops calling it). */
  public update(deltaMs: number): void {
    this.waves.update(deltaMs).forEach((role) => {
      this.soldiers.deploy(MINION_KINDS.blue[role]);
      this.foes.spawn(MINION_KINDS.red[role]);
    });
  }
}
