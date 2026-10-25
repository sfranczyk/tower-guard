import type { Container } from 'pixi.js';
import { BOWMAN_WALK_SPEED, MOBA_ARROW_CHARGES, MOBA_SKY } from '../config';
import type { GameContext } from '../core/Scene';
import { firstArrow } from '../data/loadout';
import type { Team } from '../data/moba';
import type { ShopFunds } from '../data/shopView';
import { playerStats } from '../data/upgrades';
import { loadoutOf } from '../net/coopLink';
import type { GuestSync } from '../net/GuestSync';
import type { HostSync } from '../net/HostSync';
import type { GameEvent, MobaNet } from '../net/protocol';
import type Arrow from '../objects/Arrow';
import type { DamageNumbers } from '../objects/DamageNumbers';
import type DragonEnemy from '../objects/dragon/DragonEnemy';
import type Tower from '../objects/Tower';
import type { Background } from '../rendering/Background';
import type { Foe } from '../systems/combatGeometry';
import type { ProjectileType } from '../types';
import type { BattleAllies } from './BattleAllies';
import type { BattleEnemies } from './BattleEnemies';
import { BattleLanes } from './BattleLanes';
import { BattleMoba } from './BattleMoba';
import type { BattlePlayers } from './BattlePlayers';
import { BattleShop, type ShopBackend } from './BattleShop';
import { MobaSky } from './MobaSky';
import type { Player } from './PlayerControl';

export interface MobaModeDeps {
  ctx: GameContext;
  world: Container;
  soldiers: BattleAllies;
  foes: BattleEnemies;
  teams: readonly Team[];
  popups(): DamageNumbers;
  hostSync(): HostSync | undefined;
  guestSync(): GuestSync | undefined;
  /** The scenery (its day sky) and the arrows in flight (the comet's hits), once the battle is built. */
  background(): Background;
  arrows(): readonly Arrow[];
  /** The camera's left edge (the sky keeps its place in the view). */
  viewLeft(): number;
  /** The battle view is flipped for this player (texts flip back). */
  mirrored(): boolean;
}

/** How often the host checks whether the economy changed (and sends it to the guests). */
const ECONOMY_SYNC_MS = 200;

/**
 * MOBA mode (`?moba`) as GameScene sees it: the lanes (BattleLanes), and once the players stand, the match on the host
 * or alone (BattleMoba: gold, vaults, upgrades, respawns) and this browser's shop (BattleShop). Co-op: the host sends
 * the economy (`moba` event), gold popups and respawns, and takes the guests' purchases (`shop` message); a guest
 * shows the host's numbers and applies its own upgrades to its bowman (quiver, reloads, speed).
 */
export class MobaMode implements ShopBackend {
  /** The blue dragons (CombatSystem flies them with the blue soldiers). */
  public readonly allyFliers: DragonEnemy[] = [];
  public readonly lanes: BattleLanes;
  public match?: BattleMoba;
  public shop?: BattleShop;
  /** Days, nights, eclipses and their comets (?debug: `scene.moba.sky.eclipseSoon()`). */
  public sky?: MobaSky;
  private team?: BattlePlayers;
  /** Co-op guest: the host's economy as last sent. */
  private synced?: MobaNet;
  /** Co-op host: what was last sent of it. */
  private sentEconomy = '';
  private sinceEconomyMs = 0;

  public constructor(private readonly deps: MobaModeDeps) {
    this.lanes = new BattleLanes({
      world: deps.world,
      soldiers: deps.soldiers,
      foes: deps.foes,
      fliers: this.allyFliers,
      hostSync: deps.hostSync,
      onDamaged: (dragon, amount, hit) => deps.popups().show(dragon, amount, hit),
      level: (team, role) => this.match?.upgrades.minionLevel(team, role) ?? 1,
      spawned: (unit, team, role) => this.match?.watch(unit, team, role),
    });
    // Everyone starts with the normal arrow only; the shop sells the rest.
    deps.ctx.session.mobaLoadouts = deps.teams.map(() => ['normal']);
  }

  /** The blue side's minions (the co-op sync sends and animates them like the enemies). */
  public get allies(): Foe[] {
    return [...this.deps.soldiers.list, ...this.allyFliers];
  }

  /** The players stand: the match (host or alone) and the shop at `keepOf` the local player's keep. */
  public start(team: BattlePlayers, keepOf: (player: Player) => Tower, guest: boolean): void {
    this.team = team;
    team.list.forEach((player) => {
      player.cooldowns.limits = MOBA_ARROW_CHARGES;
    });
    if (!guest) {
      this.match = new BattleMoba({
        ctx: this.deps.ctx, team, teams: this.deps.teams, popups: this.deps.popups,
        changed: (player) => this.changed(player),
        goldShown: (by, at, delta) => this.deps.hostSync()?.push({ e: 'gold', player: by, x: Math.round(at.x), y: Math.round(at.y), delta }),
        revived: (player) => this.deps.hostSync()?.push({ e: 'revive', player: player.index, x: Math.round(player.bowman.x) }),
      });
    }
    this.shop = new BattleShop({ ctx: this.deps.ctx, local: () => team.local, keepOf, backend: () => this });
    this.sky = new MobaSky({
      world: this.deps.world, background: this.deps.background, arrows: this.deps.arrows, hostSync: this.deps.hostSync, mirrored: this.deps.mirrored, guest,
      struck: (by, at) => this.match?.bonus(by, MOBA_SKY.cometGold, at),
    });
  }

  /** Co-op host: the guests' purchases come in. */
  public listen(hostSync: HostSync): void {
    hostSync.onShop = (message, from) => {
      const player = this.team?.list[from];
      if (!player || !this.match) {
        return;
      }
      const reason = message.buy ? this.match.buy(player, message.buy) : undefined;
      if (message.deposit !== undefined) {
        this.match.moveVault(player, message.deposit, message.step ?? 0);
      }
      if (reason) {
        this.team?.status(player, reason);
      }
    };
  }

  /** `live`: the match is still on (the lanes stop once a keep falls). */
  public update(deltaMs: number, live: boolean): void {
    if (live && !this.deps.guestSync()) {
      this.lanes.update(deltaMs);
      this.match?.update(deltaMs);
    }
    this.shop?.update(deltaMs);
    this.sky?.update(deltaMs, this.deps.viewLeft());
    this.sinceEconomyMs += deltaMs;
    const hostSync = this.deps.hostSync();
    if (hostSync && this.match && this.sinceEconomyMs >= ECONOMY_SYNC_MS) {
      this.sinceEconomyMs = 0;
      const economy = this.economy(this.match);
      const text = JSON.stringify(economy);
      if (text !== this.sentEconomy) {
        this.sentEconomy = text;
        hostSync.push({ e: 'moba', ...economy });
      }
    }
  }

  /** Co-op guest: the host's economy, a gold popup for this player, a player back at his keep, or the sky. */
  public applyNet(event: Extract<GameEvent, { e: 'moba' | 'gold' | 'revive' | 'sky' | 'comet' }>): void {
    const team = this.team;
    if (!team) {
      return;
    }
    if (event.e === 'sky' || event.e === 'comet') {
      this.sky?.applyNet(event);
      return;
    }
    if (event.e === 'gold') {
      if (event.player === team.local.index) {
        this.deps.popups().showGold({ x: event.x, y: event.y }, event.delta);
      }
      return;
    }
    if (event.e === 'revive') {
      const player = team.list[event.player];
      if (player) {
        player.bowman.revive(event.x);
        player.bowman.figure.facing = player.team === 'red' ? -1 : 1;
      }
      return;
    }
    const { e: _kind, ...economy } = event;
    this.synced = economy;
    const loadouts = this.deps.ctx.session.mobaLoadouts;
    team.list.forEach((player) => {
      const stats = playerStats(economy.lv[player.index] ?? {});
      const before = loadoutOf(this.deps.ctx.session, player.index).join();
      if (loadouts) {
        loadouts[player.index] = [...stats.quiver];
      }
      if (player.local) {
        player.cooldowns.pace = stats.cooldown;
        player.bowman.movementSpeed = BOWMAN_WALK_SPEED * stats.speed;
        if (before !== stats.quiver.join()) {
          this.changed(player);
        }
      }
    });
    this.shop?.refresh();
  }

  /** The shop's normal-arrow levels on `owner`'s arrows of `type`. */
  public arrowPower(owner: number, type: ProjectileType): number | undefined {
    return this.match?.upgrades.arrowPower(owner, type);
  }

  /** Full health of `player` (with his Max health levels). */
  public maxHealth(player: Player): number {
    if (this.match) {
      return this.match.maxHealth(player);
    }
    const levels = this.synced?.lv[player.index] ?? {};
    return Math.round(this.deps.ctx.session.sandbox.moba.bowmanHealth * playerStats(levels).maxHealth);
  }

  /** `player` is healing now (the HUD's regeneration icon; a co-op guest: as the host last sent). */
  public regenerating(player: Player): boolean {
    return this.match ? this.match.regenerating(player) : this.synced?.rg.includes(player.index) ?? false;
  }

  /** The HUD's purse line for this browser's player. */
  public purse(player: Player): { team: Team; gold: number; vault: number } {
    if (this.match) {
      return this.match.purse(player);
    }
    return { team: player.team, gold: this.synced?.gold[player.index] ?? 0, vault: this.synced?.vault[player.team] ?? 0 };
  }

  /** What the status line's level hint says to this browser's player. */
  public goal(local: Team): string {
    return `bring down the ${local === 'blue' ? 'red' : 'blue'} keep`;
  }

  /** ShopBackend: the host's numbers (a co-op guest: as last sent). */
  public shopFunds(player: Player): ShopFunds {
    if (this.match) {
      return this.match.shopFunds(player);
    }
    const synced = this.synced;
    return {
      player: { levels: synced?.lv[player.index] ?? {}, gold: synced?.gold[player.index] ?? 0 },
      team: { levels: synced?.tlv[player.team] ?? {}, gold: synced?.vault[player.team] ?? 0 },
    };
  }

  /** ShopBackend: bought here, or (a co-op guest) asked of the host, whose answer comes back as the next `moba`. */
  public buy(player: Player, id: string): string | undefined {
    if (this.match) {
      return this.match.buy(player, id);
    }
    this.deps.guestSync()?.sendShop({ t: 'shop', buy: id });
    return undefined;
  }

  public moveVault(player: Player, deposit: boolean, step: number): void {
    if (this.match) {
      this.match.moveVault(player, deposit, step);
    } else {
      this.deps.guestSync()?.sendShop({ t: 'shop', deposit, step });
    }
  }

  public destroy(): void {
    this.shop?.destroy();
    this.sky?.destroy();
    this.deps.ctx.session.mobaLoadouts = undefined;
  }

  private economy(match: BattleMoba): MobaNet {
    return {
      gold: [...match.economy.gold],
      vault: { ...match.economy.vault },
      lv: match.upgrades.playerLevels.map((levels) => ({ ...levels })),
      tlv: { blue: { ...match.upgrades.teamLevels.blue }, red: { ...match.upgrades.teamLevels.red } },
      rg: this.team?.list.filter((player) => match.regenerating(player)).map((player) => player.index) ?? [],
    };
  }

  /** `player` bought something: his quiver in the HUD (the arrow in hand kept, if still in it) and the open shop. */
  private changed(player: Player): void {
    if (!player.local) {
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
