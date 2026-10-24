import type { Container } from 'pixi.js';
import type { GameContext } from '../core/Scene';
import { firstArrow } from '../data/loadout';
import type { Team } from '../data/moba';
import { loadoutOf } from '../net/coopLink';
import type { DamageNumbers } from '../objects/DamageNumbers';
import type DragonEnemy from '../objects/dragon/DragonEnemy';
import type Tower from '../objects/Tower';
import type { ProjectileType } from '../types';
import type { BattleAllies } from './BattleAllies';
import type { BattleEnemies } from './BattleEnemies';
import { BattleLanes } from './BattleLanes';
import { BattleMoba } from './BattleMoba';
import type { BattlePlayers } from './BattlePlayers';
import { BattleShop } from './BattleShop';
import type { Player } from './PlayerControl';

export interface MobaModeDeps {
  ctx: GameContext;
  world: Container;
  soldiers: BattleAllies;
  foes: BattleEnemies;
  teams: readonly Team[];
  /** A co-op guest: the host runs the lanes, the gold and the shop's purchases. */
  guest: boolean;
  popups(): DamageNumbers;
}

/**
 * MOBA mode (`?moba`) as GameScene sees it: the lanes (BattleLanes), and once the players stand, the match on the host
 * or alone (BattleMoba: gold, vaults, upgrades, respawns) and this browser's shop (BattleShop).
 */
export class MobaMode {
  /** The blue dragons (CombatSystem flies them with the blue soldiers). */
  public readonly allyFliers: DragonEnemy[] = [];
  public readonly lanes: BattleLanes;
  public match?: BattleMoba;
  public shop?: BattleShop;
  private team?: BattlePlayers;

  public constructor(private readonly deps: MobaModeDeps) {
    this.lanes = new BattleLanes({
      world: deps.world,
      soldiers: deps.soldiers,
      foes: deps.foes,
      fliers: this.allyFliers,
      onDamaged: (dragon, amount, hit) => deps.popups().show(dragon, amount, hit),
      level: (team, role) => this.match?.upgrades.minionLevel(team, role) ?? 1,
      spawned: (unit, team, role) => this.match?.watch(unit, team, role),
    });
    // Everyone starts with the normal arrow only; the shop sells the rest.
    deps.ctx.session.mobaLoadouts = deps.teams.map(() => ['normal']);
  }

  /** The players stand: the match (host or alone) and the shop at `keepOf` the local player's keep. */
  public start(team: BattlePlayers, keepOf: (player: Player) => Tower): void {
    this.team = team;
    if (!this.deps.guest) {
      this.match = new BattleMoba({ ctx: this.deps.ctx, team, teams: this.deps.teams, popups: this.deps.popups, changed: (player) => this.changed(player) });
    }
    this.shop = new BattleShop({ ctx: this.deps.ctx, local: () => team.local, keepOf, backend: () => this.match });
  }

  /** `live`: the match is still on (the lanes stop once a keep falls). */
  public update(deltaMs: number, live: boolean): void {
    if (live) {
      this.lanes.update(deltaMs);
      this.match?.update(deltaMs);
    }
    this.shop?.update(deltaMs);
  }

  /** The shop's normal-arrow levels on `owner`'s arrows of `type`. */
  public arrowPower(owner: number, type: ProjectileType): number | undefined {
    return this.match?.upgrades.arrowPower(owner, type);
  }

  /** What the status line's level hint says to this browser's player. */
  public goal(local: Team): string {
    return `bring down the ${local === 'blue' ? 'red' : 'blue'} keep`;
  }

  public destroy(): void {
    this.shop?.destroy();
    this.deps.ctx.session.mobaLoadouts = undefined;
  }

  /** `player` bought something: his quiver in the HUD (the arrow in hand kept, if still in it) and the open shop. */
  private changed(player: Player): void {
    if (!player.local || !this.team) {
      return;
    }
    const { ui, session } = this.deps.ctx;
    const loadout = loadoutOf(session, player.index);
    ui.setLoadout(loadout);
    if (!(loadout as readonly ProjectileType[]).includes(player.projectile)) {
      player.projectile = firstArrow(loadout);
    }
    ui.setActiveProjectile(player.projectile);
    this.shop?.refresh();
  }
}
