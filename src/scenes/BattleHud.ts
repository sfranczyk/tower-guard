import type { GameContext } from '../core/Scene';
import { runLevelCount } from '../data/sandbox';
import type { DamageNumbers } from '../objects/DamageNumbers';
import type Tower from '../objects/Tower';
import { ALLY_ORDER_LABELS } from '../systems/allyOrders';
import type { BattleAllies } from './BattleAllies';
import type { BattleBanners } from './BattleBanners';
import type { BattleEnemies } from './BattleEnemies';
import type { BattleNameTags } from './BattleNameTags';
import type { BattlePlayers } from './BattlePlayers';
import type { BattleSurvival } from './BattleSurvival';
import type { MobaMode } from './MobaMode';

export interface BattleHudDeps {
  ctx: GameContext;
  team: () => BattlePlayers;
  foes: BattleEnemies;
  soldiers: BattleAllies;
  moba?: MobaMode;
  survival: () => BattleSurvival | undefined;
  banners: () => BattleBanners | undefined;
  /** This browser's player's keep (MOBA red: the right one). */
  localKeep: () => Tower;
  damageNumbers: () => DamageNumbers;
  nameTags: () => BattleNameTags | undefined;
  mirrored: () => boolean;
}

/**
 * Each frame: the HUD bar (level progress, the local keep's and bowman's health, soldier slots, banners line), the
 * bowmen's own health bars and name tags, and blue numbers over the bowmen who lost health since the last frame.
 */
export class BattleHud {
  /** Each player's health as of the last frame (host and guest alike: from the health they see). */
  private readonly shownHealth: number[] = [];

  public constructor(private readonly deps: BattleHudDeps) {}

  public update(): void {
    const { ctx, moba, foes, soldiers } = this.deps;
    const { session, ui } = ctx;
    const { list: players, local } = this.deps.team();
    const maxHealth = (player: (typeof players)[number]): number => moba?.maxHealth(player) ?? session.sandbox.bowmanHealth;
    players.forEach((player) => {
      const before = this.shownHealth[player.index];
      if (before !== undefined && player.health < before) {
        this.deps.damageNumbers().showPlayerHit(player.bowman, before - player.health);
      }
      this.shownHealth[player.index] = player.health;
      player.bowman.tags.setHealthRatio(player.health / maxHealth(player));
      player.bowman.tags.setRegenerating(moba?.regenerating(player) ?? false);
    });
    this.deps.nameTags()?.update(players, this.deps.mirrored());
    ui.updateAllies({ slots: soldiers.slots(), order: soldiers.order, orderLabel: ALLY_ORDER_LABELS[soldiers.order] });
    const keep = this.deps.localKeep();
    ui.updateHud({
      defeatedEnemies: foes.defeated(),
      totalEnemies: foes.total,
      level: session.run.levelIndex + 1,
      levelCount: runLevelCount(session.sandbox),
      clockMs: this.deps.survival()?.remainingMs,
      moba: moba?.purse(local),
      health: {
        keep: { now: keep.getHealth(), max: keep.maxHealth },
        bowman: { now: local.health, max: maxHealth(local) },
        regenerating: moba?.regenerating(local),
      },
    });
    const banners = this.deps.banners();
    ui.updateBanners(banners && session.bannerMarkers ? { player: banners.state('player'), enemy: banners.state('enemy') } : undefined);
  }
}
