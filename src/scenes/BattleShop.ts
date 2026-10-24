import { MOBA_PLAYERS } from '../config';
import type { GameContext } from '../core/Scene';
import { shopSections, type ShopFunds } from '../data/shopView';
import type Tower from '../objects/Tower';
import { DEFAULT_STATUS } from './battleText';
import type { Player } from './PlayerControl';

/** Where the shop's gold and levels live: the host's BattleMoba, or (co-op guest) the host's copy sent over. */
export interface ShopBackend {
  shopFunds(player: Player): ShopFunds;
  buy(player: Player, id: string): string | undefined;
  moveVault(player: Player, deposit: boolean, step: number): void;
}

export interface BattleShopDeps {
  ctx: GameContext;
  local(): Player;
  /** The player's own keep (the shop is there). */
  keepOf(player: Player): Tower;
  backend(): ShopBackend | undefined;
}

/** How often the open shop is rebuilt (gold comes in from kills while it is open). */
const REFRESH_MS = 200;

/**
 * MOBA's shop for this browser's player (ui/ShopPanel.ts): "Press I to open the shop" when he comes within
 * MOBA_PLAYERS.shopRange of his own keep, I (or Esc, or the ×) to open and close it, closed when he walks away or falls.
 * The battle goes on behind it. Buying goes to the backend.
 */
export class BattleShop {
  private near = false;
  private sinceRefreshMs = 0;

  public constructor(private readonly deps: BattleShopDeps) {
    const { handlers } = deps.ctx.ui;
    handlers.shopBuy = (id) => this.buy(id);
    handlers.shopVault = (deposit, step) => {
      this.deps.backend()?.moveVault(this.deps.local(), deposit, step);
      this.refresh();
    };
    handlers.shopClose = () => this.close();
  }

  public get open(): boolean {
    return this.deps.ctx.ui.shop.open;
  }

  /** I: opens it by the keep, closes it anywhere. */
  public toggle(): void {
    if (this.open) {
      this.close();
    } else if (this.near) {
      this.refresh(true);
    } else {
      this.deps.ctx.ui.setStatus('The shop is at your keep');
    }
  }

  public close(): void {
    this.deps.ctx.ui.shop.hide();
  }

  public update(deltaMs: number): void {
    const player = this.deps.local();
    const near = !player.bowman.isDead && Math.abs(player.bowman.x - this.deps.keepOf(player).x) <= MOBA_PLAYERS.shopRange;
    if (near && !this.near && !this.open) {
      this.deps.ctx.ui.setStatus('Press I to open the shop');
    } else if (!near && this.near) {
      this.deps.ctx.ui.setStatus(DEFAULT_STATUS);
    }
    this.near = near;
    if (!near && this.open) {
      this.close();
    }
    this.sinceRefreshMs += deltaMs;
    if (this.open && this.sinceRefreshMs >= REFRESH_MS) {
      this.refresh();
    }
  }

  /** Redraws the open shop (`force`: opens it). */
  public refresh(force = false): void {
    const backend = this.deps.backend();
    if (!backend || (!force && !this.open)) {
      return;
    }
    this.sinceRefreshMs = 0;
    const player = this.deps.local();
    const funds = backend.shopFunds(player);
    this.deps.ctx.ui.shop.show({
      team: player.team,
      gold: funds.player.gold,
      vault: funds.team.gold,
      skills: shopSections('skills', funds),
      castle: shopSections('castle', funds),
    });
  }

  private buy(id: string): void {
    const reason = this.deps.backend()?.buy(this.deps.local(), id);
    if (reason) {
      this.deps.ctx.ui.setStatus(reason);
    }
    this.refresh();
  }

  public destroy(): void {
    this.close();
    const { handlers } = this.deps.ctx.ui;
    handlers.shopBuy = undefined;
    handlers.shopVault = undefined;
    handlers.shopClose = undefined;
  }
}
