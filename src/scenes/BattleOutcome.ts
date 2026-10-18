import type { GameContext } from '../core/Scene';
import { healAfterLevel } from '../data/difficulty';
import type { HostSync } from '../net/HostSync';
import type { EndInfo } from '../net/protocol';
import type Tower from '../objects/Tower';
import type { Foe } from '../systems/CombatSystem';
import { livingBowmen } from '../systems/targeting';
import type { BattleAllies } from './BattleAllies';
import type { BattleBanners } from './BattleBanners';
import type { BattleEnemies } from './BattleEnemies';
import type { BattlePlayers } from './BattlePlayers';
import { BattleSurvival } from './BattleSurvival';
import { showLevelEnd } from './levelEndScreen';

export interface BattleOutcomeDeps {
  ctx: GameContext;
  team: BattlePlayers;
  foes: BattleEnemies;
  enemies: Foe[];
  soldiers: BattleAllies;
  playerTower: Tower;
  enemyTower: Tower;
  banners?: BattleBanners;
  survival?: BattleSurvival;
  hostSync: () => HostSync | undefined;
  /** The level is decided: this browser's keyboard and mouse stop. */
  stopInput: () => void;
}

/**
 * How a level ends (alone or the co-op host; the guest is told by the host, `showGuestEnd`): lost once every bowman has
 * fallen, or the keep (or our banner); won with the enemy keep, the enemy banner, every enemy down or, in survival, at
 * dawn. The end screen (levelEndScreen) decides between the next level and the end of the run.
 */
export class BattleOutcome {
  public ended = false;
  /** What the end screen's button (and Space) does. */
  public endAction?: () => void;

  public constructor(private readonly deps: BattleOutcomeDeps) {}

  public check(): void {
    const { team, playerTower, enemyTower, banners, foes, survival } = this.deps;
    team.handleFallen();
    if (livingBowmen(team.bowmen).length === 0 || playerTower.isDestroyed() || banners?.outcome === 'lost') {
      this.end(false);
      return;
    }
    if (enemyTower.isDestroyed()) {
      this.end(true);
      return;
    }
    // A captured banner wins the level like clearing it.
    if (banners?.outcome === 'won') {
      this.end(true, true);
      return;
    }
    if (foes.allDefeated()) {
      this.end(true, true);
      return;
    }
    // Survival: dawn. Whoever is still on the field runs off, and the level is held.
    if (survival?.timeUp) {
      BattleSurvival.fleeAll(this.deps.enemies);
      this.end(true, true);
    }
  }

  /** Guest: the host decides what comes after the level. */
  public showGuestEnd(info: EndInfo): void {
    this.ended = true;
    this.deps.stopInput();
    this.deps.ctx.ui.showEndScreen({ ...info, buttonLabel: 'Waiting for the host…', onButton: () => {} });
  }

  private end(won: boolean, levelCleared = false): void {
    const { ctx, team, foes, enemies, soldiers, playerTower, enemyTower, banners, survival } = this.deps;
    const hostSync = this.deps.hostSync();
    this.ended = true;
    this.deps.stopInput();
    foes.stopWaves();
    if (!won) {
      enemies.filter((enemy) => !enemy.fleeing).forEach((enemy) => enemy.celebrate());
      hostSync?.push({ e: 'cheer' });
    } else {
      soldiers.celebrate();
    }
    const { run, sandbox } = ctx.session;
    const players = team.list;
    this.endAction = showLevelEnd(ctx, {
      won,
      levelCleared,
      levelIndex: run.levelIndex,
      defeated: foes.defeated(),
      totalEnemies: foes.total,
      keep: { health: playerTower.getHealth(), max: playerTower.maxHealth },
      enemyKeepDestroyed: enemyTower.isDestroyed(),
      playerKeepDestroyed: playerTower.isDestroyed(),
      banner: banners?.outcome === 'won' ? 'captured' : banners?.outcome === 'lost' ? 'lost' : undefined,
      playerHealths: players.map((player) => player.health),
      survivedMs: survival && survival.durationMs - survival.remainingMs,
    }, () => ({
      levelIndex: run.levelIndex + 1,
      // Bowmen heal by the difficulty; the keep starts every level whole.
      bowmanHealths: players.map((player) => healAfterLevel(sandbox.difficulty, player.health, sandbox.bowmanHealth)),
      keepHealth: sandbox.keepHealth,
      enemyKeepHealth: enemyTower.getHealth(),
    }), hostSync);
  }
}
