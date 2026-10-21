import { GAME_WIDTH, MAX_VIEW_WIDTH } from '../config';
import { fitView, type ViewFit } from '../core/viewport';
import type { ProjectileType } from '../types';
import type { AudioSettings } from '../audio/audioSettings';
import type { SandboxSettings } from '../data/sandbox';
import type { ArrowType } from '../data/loadout';
import { Hud, type HudValues } from './Hud';
import { CoopPanel, type CoopView } from './CoopPanel';
import { SandboxForm } from './SandboxForm';
import { type PartnerQuiver } from './quiverPage';
import { TuningPanel } from './TuningPanel';
import type { UiHandlers } from './uiHandlers';
import { BattleDialogs } from './BattleDialogs';
import { SettingsDrawer } from './SettingsDrawer';
import { onClickIn, queryIn } from './domQuery';
import { SoundLabPanel, type SoundLabMusic, type SoundLabMusicState, type SoundLabRow } from './SoundLabPanel';
import { HUD_BOTTOM_TEMPLATE, HUD_TOP_TEMPLATE, OVERLAY_TEMPLATE, allySlots, weaponSlots } from './template';
import { ICON_BANNERS, ICON_ORDERS } from './icons';
import { BANNER_STATE_LABELS, type BannerAt } from '../systems/banners';
import type { AllyType } from '../types';
import { DEV_TOOLS } from '../core/devTools';

/** Breathing room kept around the canvas + HUD stack inside the window. */
const PAGE_MARGIN = 16;
/**
 * Overlay zoom relative to the canvas scale: a bit larger than the canvas on small screens (`boost`) so text
 * stays readable, within `min`..`max`.
 */
const UI_SCALE = { min: 0.6, max: 1.15, boost: 1.12 };

/** What the weapon slots show of the local player's arrows (systems/arrowCooldowns). */
export interface WeaponCharges {
  charges(type: ArrowType): number;
  max(type: ArrowType): number;
  remaining(type: ArrowType): number;
}
export type UiScreen = 'menu' | 'coop' | 'sandbox' | 'animationLab' | 'soundLab' | 'game';

export type { CoopView } from './CoopPanel';

export type { HudValues } from './Hud';

/** The soldiers' slots in the HUD now: standing / allowed of each kind, the share of its pause left, the order. */
export interface AllyHudView {
  slots: ReadonlyArray<{ type: AllyType; alive: number; limit: number; cooldown: number }>;
  order: 'hold' | 'advance' | 'retreat';
  orderLabel: string;
}

export type { EndScreenOptions, PauseView } from './BattleDialogs';

/** Page colours behind the game, taken from the current battleground. */
export interface UiTheme {
  accent: string;
  backdrop: string;
}

/** Callbacks wired to DOM controls. Scenes assign the ones they care about. */
export type { UiHandlers } from './uiHandlers';

/**
 * HTML around and over the canvas. Lays out [HUD top][canvas + overlay][HUD bottom], scales the
 * canvas to the space left by the HUD, and owns menus, settings drawer and end screen.
 */
export class DomUi {
  public readonly handlers: UiHandlers = {};
  public readonly settings: SettingsDrawer;
  public readonly dialogs: BattleDialogs;

  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly hudTop: HTMLElement;
  private readonly hudBottom: HTMLElement;
  private readonly menuScreen: HTMLElement;
  private readonly labScreen: HTMLElement;
  private readonly optionsDrawer: HTMLElement;
  private readonly labBackButton: HTMLButtonElement;
  private readonly statusElement: HTMLElement;
  private readonly hud: Hud;
  private readonly devTools: HTMLElement;
  private readonly sandboxScreen: HTMLElement;
  private readonly sandboxForm: SandboxForm;
  private readonly coopScreen: HTMLElement;
  private readonly coopPanel: CoopPanel;
  private readonly soundLabScreen: HTMLElement;
  private readonly soundLabPanel: SoundLabPanel;
  private readonly tuningPanel = new TuningPanel();
  private readonly weaponsRoot: HTMLElement;
  private readonly alliesRoot: HTMLElement;
  private shownOrder?: string;
  private readonly bannersLine: HTMLElement;
  private shownBanners = '';

  public constructor(host: HTMLElement, canvas: HTMLCanvasElement) {
    this.host = host;
    this.canvas = canvas;
    this.hudTop = DomUi.createElement('hud hud-top', HUD_TOP_TEMPLATE);
    this.hudBottom = DomUi.createElement('hud hud-bottom', HUD_BOTTOM_TEMPLATE);
    const stage = DomUi.createElement('stage', '');
    const overlay = DomUi.createElement('', OVERLAY_TEMPLATE);
    overlay.id = 'ui-root';
    stage.append(canvas, overlay);
    stage.append(this.tuningPanel.element);
    host.append(this.hudTop, stage, this.hudBottom);

    this.menuScreen = this.query('[data-menu]');
    this.labScreen = this.query('[data-test]');
    this.optionsDrawer = this.query('[data-drawer]');
    this.dialogs = new BattleDialogs(host, this.handlers);
    this.labBackButton = this.query<HTMLButtonElement>('[data-lab-back]');
    this.statusElement = this.query('[data-status]');
    this.hud = new Hud(this.hudTop);
    this.devTools = this.query('[data-dev-tools]');
    this.sandboxScreen = this.query('[data-sandbox]');
    this.sandboxForm = new SandboxForm(this.query('[data-sandbox-form]'), {
      change: (settings, level) => this.handlers.sandboxChange?.(settings, level),
      start: () => this.handlers.sandboxStart?.(),
      back: () => this.handlers.sandboxBack?.(),
    });
    this.coopScreen = this.query('[data-coop]');
    this.coopPanel = new CoopPanel(this.query('[data-coop-panel]'), {
      host: () => this.handlers.coopHost?.(),
      join: (code) => this.handlers.coopJoin?.(code),
      setup: () => this.handlers.coopSetup?.(),
      leave: () => this.handlers.coopLeave?.(),
      loadoutChange: (loadout) => this.handlers.coopLoadout?.(loadout),
    });
    this.soundLabScreen = this.query('[data-sound-lab]');
    this.soundLabPanel = new SoundLabPanel(this.query('[data-sound-lab-panel]'), {
      play: (id, variant) => this.handlers.soundLabPlay?.(id, variant),
      toggleMusic: () => this.handlers.soundLabToggleMusic?.(),
      musicSeam: () => this.handlers.soundLabMusicSeam?.(),
      audioChange: (changes) => this.handlers.soundLabAudioChange?.(changes),
      back: () => this.handlers.soundLabBack?.(),
    });
    this.weaponsRoot = this.query<HTMLElement>('[data-projectiles]');
    this.settings = new SettingsDrawer(host, this.handlers);
    this.bannersLine = this.query<HTMLElement>('[data-banners]');

    this.onClick('[data-start]', () => this.handlers.start?.());
    this.onClick('[data-open-coop]', () => this.handlers.openCoop?.());
    this.onClick('[data-menu-settings]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-dev-toggle]', () => this.toggleDevTools());
    this.onClick('[data-open-test]', () => this.handlers.openAnimationLab?.());
    this.onClick('[data-open-sound-lab]', () => this.handlers.openSoundLab?.());
    this.onClick('[data-open-design-lab]', () => this.handlers.openDesignLab?.());
    this.onClick('[data-open-tuning]', () => this.handlers.toggleTuning?.());
    // After the dev buttons are wired: query() throws on a missing element.
    if (!DEV_TOOLS) {
      this.query('[data-dev-toggle]').remove();
      this.devTools.remove();
    }
    this.onClick('[data-lab-menu]', () => this.handlers.labMenu?.());
    this.onClick('[data-lab-back]', () => this.handlers.labBack?.());
    this.onClick('[data-close-options]', () => this.handlers.toggleOptions?.());
    this.alliesRoot = this.query<HTMLElement>('[data-allies]');
    this.alliesRoot.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-ally], [data-ally-order]');
      if (!button) {
        return;
      }
      if (button.dataset.ally) {
        this.handlers.summonAlly?.(button.dataset.ally as AllyType);
      } else {
        this.handlers.cycleAllyOrder?.();
      }
      // Drop focus so Space doesn't press it again.
      button.blur();
    });
    this.weaponsRoot.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-projectile]');
      if (button) {
        this.handlers.selectProjectile?.(button.dataset.projectile as ProjectileType);
        // Drop focus so Space (shrapnel burst) doesn't press the slot again.
        button.blur();
      }
    });

    window.addEventListener('resize', () => this.fitCanvas());
    this.watchPixelRatio();
    this.showScreen('menu');
  }

  /** Shows one screen and hides the others, including the end screen and settings drawer. */
  public showScreen(screen: UiScreen): void {
    this.menuScreen.hidden = screen !== 'menu';
    this.sandboxScreen.hidden = screen !== 'sandbox';
    this.coopScreen.hidden = screen !== 'coop';
    this.soundLabScreen.hidden = screen !== 'soundLab';
    this.labScreen.hidden = screen !== 'animationLab';
    this.hudTop.hidden = screen !== 'game';
    this.hudBottom.hidden = screen !== 'game';
    this.labBackButton.hidden = true;
    this.dialogs.hide();
    this.optionsDrawer.hidden = true;
    this.fitCanvas();
  }

  /** Shows the animation lab's back button while an animation is zoomed in. */
  public setLabZoomed(zoomed: boolean): void {
    this.labBackButton.hidden = !zoomed;
  }

  public setStatus(text: string): void {
    this.statusElement.textContent = text;
  }

  public updateHud(values: HudValues): void {
    this.hud.update(values);
  }

  /** Tints the page behind the game and the UI accent with the battleground's colours. */
  public setTheme(theme: UiTheme): void {
    const root = document.documentElement.style;
    root.setProperty('--accent', theme.accent);
    root.setProperty('--backdrop', theme.backdrop);
  }

  /** The weapon slots in the HUD, from the battle setup's quiver. */
  public setLoadout(loadout: readonly (ArrowType | null)[]): void {
    this.weaponsRoot.innerHTML = weaponSlots(loadout);
  }

  /** Each frame: shots ready / held under each weapon slot, and the shade over it while the next one loads. */
  public updateWeaponCooldowns(cooldowns: WeaponCharges): void {
    this.weaponsRoot.querySelectorAll<HTMLButtonElement>('[data-projectile]').forEach((button) => {
      const type = button.dataset.projectile as ArrowType;
      const charges = cooldowns.charges(type);
      const count = button.parentElement?.querySelector<HTMLElement>('[data-ammo]');
      const text = `${charges}/${cooldowns.max(type)}`;
      if (count && count.textContent !== text) {
        count.textContent = text;
      }
      // Loading the next shot shades the slot, as with one shot, even while others are ready (vortex).
      const wait = button.querySelector<HTMLElement>('[data-wait]');
      const height = `${Math.round(cooldowns.remaining(type) * 100)}%`;
      if (wait && wait.style.height !== height) {
        wait.style.height = height;
      }
    });
  }

  /** The soldiers' slots in the HUD (none: hidden, e.g. in online co-op until they're synced). */
  public setAllies(allies: ReadonlyArray<{ type: AllyType; label: string }>): void {
    this.alliesRoot.hidden = allies.length === 0;
    this.alliesRoot.innerHTML = allySlots(allies);
    this.shownOrder = undefined;
  }

  /** Each frame: counts, pauses and the order (only what changed is touched). */
  public updateAllies(view: AllyHudView): void {
    if (this.alliesRoot.hidden) {
      return;
    }
    view.slots.forEach(({ type, alive, limit, cooldown }) => {
      const count = this.alliesRoot.querySelector<HTMLElement>(`[data-ally-count="${type}"]`);
      const text = `${alive}/${limit}`;
      if (count && count.textContent !== text) {
        count.textContent = text;
      }
      this.alliesRoot.querySelector(`[data-ally="${type}"]`)?.classList.toggle('full', alive >= limit);
      const wait = this.alliesRoot.querySelector<HTMLElement>(`[data-ally-wait="${type}"]`);
      if (wait) {
        wait.style.height = `${Math.round(cooldown * 100)}%`;
      }
    });
    if (this.shownOrder !== view.order) {
      this.shownOrder = view.order;
      this.alliesRoot.querySelector('[data-order-icon]')!.innerHTML = ICON_ORDERS[view.order];
      this.alliesRoot.querySelector('[data-order-label]')!.textContent = view.orderLabel;
      this.alliesRoot.querySelector('[data-ally-order]')?.setAttribute('title', `Orders: ${view.orderLabel} (V)`);
    }
  }

  public setActiveProjectile(type: ProjectileType): void {
    this.weaponsRoot.querySelectorAll<HTMLButtonElement>('[data-projectile]').forEach((button) => {
      button.classList.toggle('active', button.dataset.projectile === type);
    });
  }

  public setOptionsVisible(visible: boolean): void {
    this.optionsDrawer.hidden = !visible;
  }

  /** Rebuilds the sandbox setup form (e.g. after the level count changes). */
  public renderCoop(view: CoopView): void {
    this.coopPanel.render(view);
  }

  /** Opens the battle setup on its mode picker. */
  public openSandbox(settings: SandboxSettings, multiplayer: boolean): void {
    this.sandboxForm.open(settings, multiplayer);
  }

  /** Esc in the battle setup: as its Back button. */
  public sandboxBack(): void {
    this.sandboxForm.back();
  }

  /** Co-op host: the guests' quivers, shown on the battle setup's Quiver page (undefined alone). */
  public setSandboxPartners(partners: PartnerQuiver[] | undefined): void {
    this.sandboxForm.setPartners(partners);
  }

  public renderSoundLab(rows: readonly SoundLabRow[], music: SoundLabMusic, settings: Readonly<AudioSettings>): void {
    this.soundLabPanel.render(rows, music, settings);
  }

  public updateSoundLabMusic(state: SoundLabMusicState): void {
    this.soundLabPanel.updateMusic(state);
  }

  /** Each frame: where both banners are (undefined: no banners, or markers off); touched only when it changes. */
  public updateBanners(view: { player: BannerAt; enemy: BannerAt } | undefined): void {
    const text = view ? `${ICON_BANNERS.player} Ours: ${BANNER_STATE_LABELS[view.player]} · ${ICON_BANNERS.enemy} Theirs: ${BANNER_STATE_LABELS[view.enemy]}` : '';
    if (text === this.shownBanners) {
      return;
    }
    this.shownBanners = text;
    this.bannersLine.hidden = !view;
    this.bannersLine.innerHTML = text;
  }

  /** The dev tuning panel (`?tune`), over the canvas's right edge. */
  public get isTuningOpen(): boolean {
    return this.tuningPanel.isOpen;
  }

  public setTuningOpen(open: boolean): void {
    this.tuningPanel.setOpen(open);
  }

  private toggleDevTools(): void {
    this.devTools.hidden = !this.devTools.hidden;
    this.query('[data-dev-toggle]').setAttribute('aria-expanded', String(!this.devTools.hidden));
  }

  /** Largest canvas size with the game's aspect ratio that fits next to the visible HUD bars. */
  /**
   * Called after each fit (core/viewport.ts): main.ts resizes the renderer to the view width and draws at
   * the size it's shown, instead of the browser stretching a fixed-size bitmap (blurry).
   */
  public onCanvasFit?: (fit: ViewFit) => void;

  /** Browser zoom or moving the window to another screen changes devicePixelRatio: fit again. */
  private watchPixelRatio(): void {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', () => {
      this.fitCanvas();
      this.watchPixelRatio();
    }, { once: true });
  }

  /** The widest the view may get (a battle level sets its field's width, so no unplayable ground shows). */
  private maxViewWidth = MAX_VIEW_WIDTH;

  /** Caps the view at `width` game px (default: no cap beyond MAX_VIEW_WIDTH) and fits the canvas again. */
  public limitViewWidth(width = MAX_VIEW_WIDTH): void {
    if (width === this.maxViewWidth) return;
    this.maxViewWidth = width;
    this.fitCanvas();
  }

  public fitCanvas(): void {
    const viewport = document.documentElement;
    const availableWidth = viewport.clientWidth - PAGE_MARGIN * 2;
    this.host.style.width = `${availableWidth}px`;
    let fit = fitView(availableWidth, viewport.clientHeight, this.maxViewWidth);
    // Two passes: the HUD height depends on the width it wraps in, which depends on the canvas width.
    for (let pass = 0; pass < 2; pass += 1) {
      const hudHeight = (this.hudTop.hidden ? 0 : this.hudTop.offsetHeight)
        + (this.hudBottom.hidden ? 0 : this.hudBottom.offsetHeight);
      const availableHeight = viewport.clientHeight - PAGE_MARGIN * 2 - hudHeight;
      fit = fitView(availableWidth, availableHeight, this.maxViewWidth);
      this.canvas.style.width = `${Math.max(1, fit.cssWidth)}px`;
      this.canvas.style.height = `${Math.max(1, fit.cssHeight)}px`;
      this.host.style.width = `${Math.max(1, fit.cssWidth)}px`;
    }
    // How far the base-width area (e.g. the animation lab's panel) sits in from the edges of a wider view.
    this.host.style.setProperty('--view-inset', `${((fit.viewWidth - GAME_WIDTH) / 2) * fit.scale}px`);
    // Overlays (menu, panels, end screen, drawer) are designed for a canvas at scale 1 and zoom with it.
    this.host.style.setProperty('--ui-scale', `${Math.min(UI_SCALE.max, Math.max(UI_SCALE.min, fit.scale * UI_SCALE.boost))}`);
    this.onCanvasFit?.(fit);
  }

  private static createElement(className: string, html: string): HTMLDivElement {
    const element = document.createElement('div');
    element.className = className;
    element.innerHTML = html;
    return element;
  }

  private onClick(selector: string, handler: () => void): void {
    onClickIn(this.host, selector, handler);
  }

  private query<T extends HTMLElement = HTMLElement>(selector: string): T {
    return queryIn<T>(this.host, selector);
  }
}
