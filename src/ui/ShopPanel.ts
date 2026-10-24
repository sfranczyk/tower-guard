import type { Team } from '../data/moba';
import type { ShopButton, ShopSection } from '../data/shopView';
import type { ShopTab } from '../data/upgrades';
import { MOBA_VAULT_STEPS } from '../config';
import type { UiHandlers } from './uiHandlers';
import type { ArrowType } from '../data/loadout';
import { ICON_ALLIES, ICON_ENEMIES, ICON_UPGRADES, ICON_WEAPONS } from './icons';

/** What the MOBA shop shows now (scenes/BattleShop.ts builds it). */
export interface ShopView {
  team: Team;
  /** The player's keep shows on the left of the screen (settings drawer: his side, mirrored or not). */
  keepOnLeft: boolean;
  gold: number;
  vault: number;
  skills: ShopSection[];
  castle: ShopSection[];
}

const DETAIL_HINT = 'Point at an upgrade for its details.';

const TABS: ReadonlyArray<{ tab: ShopTab; label: string }> = [{ tab: 'skills', label: 'Skills' }, { tab: 'castle', label: 'Castle' }];

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The picture on an upgrade's buttons: its arrow, its minion, or a badge of its own. */
const upgradeIcon = (id: string): string => {
  const [kind, what] = id.split(':') as [string, string | undefined];
  if (kind === 'arrow' && what && what in ICON_WEAPONS) {
    return ICON_WEAPONS[what as ArrowType];
  }
  if (kind === 'minion') {
    return what === 'troop' ? ICON_ALLIES.squire : what === 'archer' ? ICON_ENEMIES.hunter : ICON_ENEMIES.dragon;
  }
  if (kind === 'basicArrow') {
    return ICON_WEAPONS.normal;
  }
  return kind === 'quick' ? ICON_UPGRADES.quick : ICON_UPGRADES[kind as keyof typeof ICON_UPGRADES] ?? '';
};

const buttonHtml = (button: ShopButton): string => {
  const price = button.state === 'owned' ? '✓' : `${button.price} g`;
  // Only the next level can be clicked; the details line says why one can't.
  const disabled = button.state === 'buyable' ? '' : ' disabled';
  return `<button class="shop-button ${button.state}" data-shop-buy="${escapeHtml(button.id)}" data-shop-tip="${escapeHtml(button.tooltip)}"${disabled}>`
    + `${upgradeIcon(button.id)}<span class="shop-label">${escapeHtml(button.label)}</span><span class="shop-price">${price}</span>`
    + '</button>';
};

const sectionHtml = (section: ShopSection): string => `<h3>${escapeHtml(section.title)}</h3>`
  + section.chains.map((chain) => `<div class="shop-chain">${chain.map(buttonHtml).join('<span class="shop-arrow" aria-hidden="true">→</span>')}</div>`).join('');

/**
 * MOBA's shop (press I by your own keep): a panel over the canvas's left side that doesn't pause or block the battle,
 * with the Skills tab (arrows, passives; paid from the purse) and the Castle tab (the team vault, minion upgrades).
 * Each upgrade's levels are buttons joined by arrows, the price on the button, the details in the line under the panel (no tooltips).
 */
export class ShopPanel {
  public readonly element: HTMLElement;
  /** Redrawn from the view; the details line under it stays. */
  private readonly content: HTMLElement;
  private readonly detail: HTMLElement;
  private tab: ShopTab = 'skills';
  private view?: ShopView;
  private shownHtml = '';

  public constructor(private readonly handlers: UiHandlers) {
    this.element = document.createElement('aside');
    this.element.className = 'shop-panel';
    this.element.hidden = true;
    this.content = document.createElement('div');
    this.content.className = 'shop-content';
    this.detail = document.createElement('p');
    this.detail.className = 'shop-detail';
    this.element.append(this.content, this.detail);
    // The details of the upgrade under the pointer (disabled buttons get no events: watched from the panel).
    this.element.addEventListener('pointermove', (event) => {
      const button = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-shop-tip]');
      const text = button?.dataset.shopTip ?? DETAIL_HINT;
      if (this.detail.textContent !== text) {
        this.detail.textContent = text;
      }
    });
    this.element.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-shop-tab], [data-shop-buy], [data-shop-vault], [data-shop-close]');
      if (!target) {
        return;
      }
      if (target.dataset.shopTab) {
        this.tab = target.dataset.shopTab as ShopTab;
        this.render();
      } else if (target.dataset.shopBuy) {
        this.handlers.shopBuy?.(target.dataset.shopBuy);
      } else if (target.dataset.shopVault) {
        this.handlers.shopVault?.(target.dataset.shopVault === 'in', Number(target.dataset.shopStep));
      } else {
        this.handlers.shopClose?.();
      }
    });
    // Clicks in the shop are not shots.
    this.element.addEventListener('pointerdown', (event) => event.stopPropagation());
  }

  public get open(): boolean {
    return !this.element.hidden;
  }

  /** Opens it (or redraws it with `view`). */
  public show(view: ShopView): void {
    this.view = view;
    if (this.element.hidden) {
      this.detail.textContent = DETAIL_HINT;
    }
    this.element.hidden = false;
    // Over the side away from the player's keep, so he stays in sight.
    this.element.classList.toggle('right', view.keepOnLeft);
    this.render();
  }

  public hide(): void {
    this.element.hidden = true;
  }

  private render(): void {
    const { view } = this;
    if (!view) {
      return;
    }
    const tabs = TABS.map(({ tab, label }) => `<button class="chip-button${tab === this.tab ? ' active' : ''}" data-shop-tab="${tab}">${label}</button>`).join('');
    const steps = (way: 'in' | 'out', has: number): string => MOBA_VAULT_STEPS
      .map((step) => `<button class="secondary-button" data-shop-vault="${way}" data-shop-step="${step}"${has < step ? ' disabled' : ''}>${step}</button>`).join('');
    const vault = `<div class="shop-vault"><span class="shop-vault-total">Team vault <b>${view.vault} g</b></span>`
      + `<div class="shop-vault-row"><span>Deposit</span>${steps('in', view.gold)}</div>`
      + `<div class="shop-vault-row"><span>Withdraw</span>${steps('out', view.vault)}</div></div>`;
    const sections = (this.tab === 'skills' ? view.skills : view.castle).map(sectionHtml).join('');
    const html = `<div class="shop-header shop-${view.team}"><h2>Shop</h2><span class="shop-gold">${view.gold} gold</span>`
      + `<button class="round-button" data-shop-close aria-label="Close the shop" title="Close (I)">×</button></div>`
      + `<div class="shop-tabs">${tabs}</div>${this.tab === 'castle' ? vault : ''}<div class="shop-body">${sections}</div>`;
    // Redrawn only when something changed (it is fed every few frames), so hovering keeps its tooltip.
    if (html !== this.shownHtml) {
      this.shownHtml = html;
      this.content.innerHTML = html;
    }
  }
}
