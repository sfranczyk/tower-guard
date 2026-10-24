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
import type { BattleMoba } from './BattleMoba';
import type { BattlePlayers } from './BattlePlayers';
import type { BattleRelief } from './BattleRelief';
import { BattleSurvival } from './BattleSurvival';
import type { LevelOutcome } from './levelEnd';
import { showLevelEnd, showMobaEnd } from './levelEndScreen';
import { mobaEndInfo } from './levelEnd';
import type { Team } from '../data/moba';

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
  relief?: BattleRelief;
  /** MOBA: fallen players come back (BattleMoba); the match ends only with a keep, won by the local player's team. */
  moba?: BattleMoba;
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
  /** How the decided level went (the guest hears it from the host). */
  public won = false;
  /** What the end screen's button (and Space) does. */
  public endAction?: () => void;

  public constructor(private readonly deps: BattleOutcomeDeps) {}

  public check(): void {
    const { team, playerTower, enemyTower, banners, foes, survival, moba } = this.deps;
    if (moba) {
      moba.handleFallen();
      if (playerTower.isDestroyed() || enemyTower.isDestroyed()) {
        this.endMatch(enemyTower.isDestroyed() ? 'blue' : 'red');
      }
      return;
    }
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
  public showGuestEnd(sent: EndInfo): void {
    // MOBA: said from this player's team's side.
    const info = sent.winner ? mobaEndInfo(sent.winner, this.deps.team.local.team, sent.stats) : sent;
    this.ended = true;
    this.won = info.outcome === 'win';
    this.deps.stopInput();
    this.deps.ctx.ui.dialogs.showEndScreen({ ...info, buttonLabel: 'Waiting for the host…', onButton: () => {} });
  }

  /** MOBA: `winner` brought the other keep down; its minions and players cheer. */
  private endMatch(winner: Team): void {
    const { ctx, team, foes, enemies, soldiers, playerTower, enemyTower } = this.deps;
    const hostSync = this.deps.hostSync();
    this.ended = true;
    this.won = winner === team.local.team;
    this.deps.stopInput();
    foes.stopWaves();
    if (winner === 'red') {
      enemies.forEach((enemy) => enemy.celebrate());
      hostSync?.push({ e: 'cheer' });
    } else {
      soldiers.celebrate();
    }
    const stats = [
      { label: 'blue keep', value: `${Math.ceil(playerTower.getHealth())} / ${playerTower.maxHealth}` },
      { label: 'red keep', value: `${Math.ceil(enemyTower.getHealth())} / ${enemyTower.maxHealth}` },
    ];
    this.endAction = showMobaEnd(ctx, winner, team.local.team, stats, hostSync);
  }

  private end(won: boolean, levelCleared = false): void {
    const { ctx, team, foes, enemies, soldiers, playerTower, enemyTower, banners, survival, relief } = this.deps;
    const hostSync = this.deps.hostSync();
    this.ended = true;
    this.won = won;
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
    const outcome: LevelOutcome = {
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
    };
    const show = (): void => {
      this.endAction = showLevelEnd(ctx, outcome, () => ({
      levelIndex: run.levelIndex + 1,
      // Bowmen heal by the difficulty; the keep starts every level whole.
      bowmanHealths: players.map((player) => healAfterLevel(sandbox.difficulty, player.health, sandbox.bowmanHealth)),
      keepHealth: sandbox.keepHealth,
      enemyKeepHealth: enemyTower.getHealth(),
      }), hostSync);
    };
    // A held survival level: the relief force marches in behind the end screen ("View battlefield" to watch it).
    if (won && survival?.timeUp) {
      relief?.arrive();
    }
    show();
  }
}
