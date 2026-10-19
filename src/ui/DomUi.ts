import { GAME_WIDTH } from '../config';
import { fitView, type ViewFit } from '../core/viewport';
import type { ProjectileType } from '../types';
import type { AudioSettings } from '../audio/audioSettings';
import type { SoundId } from '../audio/SoundManager';
import type { SandboxSettings } from '../data/sandbox';
import type { ArrowType, Loadout } from '../data/loadout';
import { Hud, type HudValues } from './Hud';
import { CoopPanel, type CoopView } from './CoopPanel';
import { SandboxForm } from './SandboxForm';
import { quiverPage, type PartnerQuiver } from './quiverPage';
import { editQuiverIn, type QuiverEdit } from './quiverEditing';
import { TuningPanel } from './TuningPanel';
import { SoundLabPanel, type SoundLabMusic, type SoundLabMusicState, type SoundLabRow } from './SoundLabPanel';
import { HUD_BOTTOM_TEMPLATE, HUD_TOP_TEMPLATE, OVERLAY_TEMPLATE, allySlots, weaponSlots } from './template';
import { ICON_BANNERS, ICON_ORDERS } from './icons';
import { BANNER_STATE_LABELS, type BannerAt } from '../systems/banners';
import type { AllyType } from '../types';

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

/** What the battle's pause dialog shows. */
export interface PauseView {
  byPartner: boolean;
  coop: boolean;
  /** Alone or the co-op host: "Restart level" (the guest waits for the host). */
  canRestart: boolean;
  /** The local bowman is in the keep: his quiver, editable in the dialog. */
  quiver?: Loadout;
}

export interface EndScreenOptions {
  title: string;
  /** Colours the title: green for a win, red for a loss. */
  outcome: 'win' | 'loss';
  copy: string;
  /** Small figures shown in a row under the copy (e.g. enemies defeated, keep health). */
  stats?: ReadonlyArray<{ label: string; value: string }>;
  buttonLabel: string;
  onButton: () => void;
}

/** Page colours behind the game, taken from the current battleground. */
export interface UiTheme {
  accent: string;
  backdrop: string;
}

/** Callbacks wired to DOM controls. Scenes assign the ones they care about. */
export interface UiHandlers {
  start?: () => void;
  openAnimationLab?: () => void;
  openSoundLab?: () => void;
  openDesignLab?: () => void;
  toggleTuning?: () => void;
  /** The end screen's "View battlefield" (true) or "Back to results" (false). */
  viewBattlefield?: (viewing: boolean) => void;
  /** Animation and design lab: back to the main menu. */
  labMenu?: () => void;
  /** Animation lab: leave the zoomed view and return to the list. */
  labBack?: () => void;
  toggleOptions?: () => void;
  /** The pause dialog's "Resume", "Restart level" and "Main menu" buttons. */
  pauseResume?: () => void;
  pauseRestart?: () => void;
  pauseMenu?: () => void;
  /** The pause dialog's quiver (shown while the bowman is in the keep) was changed. */
  pauseLoadout?: (loadout: Loadout) => void;
  selectProjectile?: (type: ProjectileType) => void;
  summonAlly?: (type: AllyType) => void;
  cycleAllyOrder?: () => void;
  /** `level`: the level being edited (its battleground is shown behind the form). */
  sandboxChange?: (settings: SandboxSettings, level: number) => void;
  sandboxStart?: () => void;
  sandboxBack?: () => void;
  openCoop?: () => void;
  coopHost?: () => void;
  coopJoin?: (code: string) => void;
  coopSetup?: () => void;
  coopLeave?: () => void;
  coopLoadout?: (loadout: Loadout) => void;
  trajectoryChange?: (enabled: boolean) => void;
  cursorCircleChange?: (enabled: boolean) => void;
  /** Damage numbers over the enemies' heads toggled in the settings drawer. */
  damageNumbersChange?: (enabled: boolean) => void;
  bannerMarkersChange?: (enabled: boolean) => void;
  /** Friendly fire (the players' arrows and their effects hit the bowmen too) toggled in the settings drawer. */
  friendlyFireChange?: (enabled: boolean) => void;
  /** Number of shots that keep their trail (0..3) picked in the settings drawer. */
  arrowTrailsChange?: (count: number) => void;
  /** A music or effects toggle/volume (0..1) changed in the settings drawer. */
  audioChange?: (changes: Partial<AudioSettings>) => void;
  soundLabPlay?: (id: SoundId, variant?: number) => void;
  soundLabToggleMusic?: () => void;
  soundLabMusicSeam?: () => void;
  soundLabAudioChange?: (changes: Partial<AudioSettings>) => void;
  soundLabBack?: () => void;
}

/**
 * HTML around and over the canvas. Lays out [HUD top][canvas + overlay][HUD bottom], scales the
 * canvas to the space left by the HUD, and owns menus, settings drawer and end screen.
 */
export class DomUi {
  public readonly handlers: UiHandlers = {};

  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly hudTop: HTMLElement;
  private readonly hudBottom: HTMLElement;
  private readonly menuScreen: HTMLElement;
  private readonly labScreen: HTMLElement;
  private readonly optionsDrawer: HTMLElement;
  private readonly endScreen: HTMLElement;
  private readonly pauseScreen: HTMLElement;
  private readonly pauseCopy: HTMLElement;
  private readonly pauseCard: HTMLElement;
  private readonly pauseQuiverRoot: HTMLElement;
  private readonly pauseRestart: HTMLElement;
  /** The quiver being edited in the pause dialog (undefined while none is shown). */
  private pauseQuiver?: QuiverEdit;
  private readonly endTitle: HTMLElement;
  private readonly endCopy: HTMLElement;
  private readonly endButton: HTMLButtonElement;
  private readonly labBackButton: HTMLButtonElement;
  private readonly statusElement: HTMLElement;
  private readonly hud: Hud;
  private readonly endStats: HTMLElement;
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
  private readonly trajectoryInput: HTMLInputElement;
  private readonly cursorCircleInput: HTMLInputElement;
  private readonly damageNumbersInput: HTMLInputElement;
  private readonly bannerMarkersInput: HTMLInputElement;
  private readonly bannersLine: HTMLElement;
  private shownBanners = '';
  private readonly friendlyFireInput: HTMLInputElement;
  private readonly trailButtons: HTMLButtonElement[];
  private readonly soundInput: HTMLInputElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly musicInput: HTMLInputElement;
  private readonly musicVolumeInput: HTMLInputElement;
  private onEndButton?: () => void;

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
    this.endScreen = this.query('[data-end]');
    this.pauseScreen = this.query('[data-pause]');
    this.pauseCopy = this.query('[data-pause-copy]');
    this.pauseCard = this.query('[data-pause] .end-card');
    this.pauseQuiverRoot = this.query('[data-pause-quiver]');
    this.pauseRestart = this.query('[data-pause-restart]');
    editQuiverIn(this.pauseQuiverRoot, () => this.pauseQuiver, ({ loadout, slot, changed }) => {
      this.pauseQuiver = { loadout, slot };
      this.renderPauseQuiver();
      if (changed) {
        this.handlers.pauseLoadout?.(loadout);
      }
    });
    this.endTitle = this.query('[data-end-title]');
    this.endCopy = this.query('[data-end-copy]');
    this.endButton = this.query<HTMLButtonElement>('[data-end-button]');
    this.labBackButton = this.query<HTMLButtonElement>('[data-lab-back]');
    this.statusElement = this.query('[data-status]');
    this.hud = new Hud(this.hudTop);
    this.endStats = this.query('[data-end-stats]');
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
    this.trajectoryInput = this.query<HTMLInputElement>('[data-trajectory]');
    this.cursorCircleInput = this.query<HTMLInputElement>('[data-cursor-circle]');
    this.damageNumbersInput = this.query<HTMLInputElement>('[data-damage-numbers]');
    this.bannerMarkersInput = this.query<HTMLInputElement>('[data-banner-markers]');
    this.bannersLine = this.query<HTMLElement>('[data-banners]');
    this.friendlyFireInput = this.query<HTMLInputElement>('[data-friendly-fire]');
    this.trailButtons = Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-trail-count]'));
    this.soundInput = this.query<HTMLInputElement>('[data-sound]');
    this.volumeInput = this.query<HTMLInputElement>('[data-volume]');
    this.musicInput = this.query<HTMLInputElement>('[data-music]');
    this.musicVolumeInput = this.query<HTMLInputElement>('[data-music-volume]');

    this.onClick('[data-start]', () => this.handlers.start?.());
    this.onClick('[data-open-coop]', () => this.handlers.openCoop?.());
    this.onClick('[data-menu-settings]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-dev-toggle]', () => this.toggleDevTools());
    this.onClick('[data-open-test]', () => this.handlers.openAnimationLab?.());
    this.onClick('[data-open-sound-lab]', () => this.handlers.openSoundLab?.());
    this.onClick('[data-open-design-lab]', () => this.handlers.openDesignLab?.());
    this.onClick('[data-open-tuning]', () => this.handlers.toggleTuning?.());
    this.onClick('[data-lab-menu]', () => this.handlers.labMenu?.());
    this.onClick('[data-lab-back]', () => this.handlers.labBack?.());
    this.onClick('[data-close-options]', () => this.handlers.toggleOptions?.());
    this.endButton.addEventListener('click', () => this.onEndButton?.());
    this.onClick('[data-end-view]', () => this.setEndViewing(true));
    this.onClick('[data-end-back]', () => this.setEndViewing(false));
    this.onClick('[data-pause-resume]', () => this.handlers.pauseResume?.());
    this.onClick('[data-pause-restart]', () => this.handlers.pauseRestart?.());
    this.onClick('[data-pause-settings]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-pause-menu]', () => this.handlers.pauseMenu?.());
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
    this.trajectoryInput.addEventListener('change', () => this.handlers.trajectoryChange?.(this.trajectoryInput.checked));
    this.cursorCircleInput.addEventListener('change', () => this.handlers.cursorCircleChange?.(this.cursorCircleInput.checked));
    this.damageNumbersInput.addEventListener('change', () => this.handlers.damageNumbersChange?.(this.damageNumbersInput.checked));
    this.bannerMarkersInput.addEventListener('change', () => this.handlers.bannerMarkersChange?.(this.bannerMarkersInput.checked));
    this.friendlyFireInput.addEventListener('change', () => this.handlers.friendlyFireChange?.(this.friendlyFireInput.checked));
    this.trailButtons.forEach((button) => button.addEventListener('click', () => {
      this.handlers.arrowTrailsChange?.(Number(button.dataset.trailCount));
      // Drop focus so Space (shrapnel burst) doesn't press it again.
      button.blur();
    }));
    const audioChange = (changes: Partial<AudioSettings>): void => this.handlers.audioChange?.(changes);
    this.soundInput.addEventListener('change', () => audioChange({ effectsEnabled: this.soundInput.checked }));
    this.volumeInput.addEventListener('input', () => audioChange({ effectsVolume: Number(this.volumeInput.value) / 100 }));
    this.musicInput.addEventListener('change', () => audioChange({ musicEnabled: this.musicInput.checked }));
    this.musicVolumeInput.addEventListener('input', () => audioChange({ musicVolume: Number(this.musicVolumeInput.value) / 100 }));

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
    this.endScreen.hidden = true;
    this.endScreen.classList.remove('viewing');
    this.pauseScreen.hidden = true;
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
  public openSandbox(settings: SandboxSettings): void {
    this.sandboxForm.open(settings);
  }

  /** Esc in the battle setup: as its Back button. */
  public sandboxBack(): void {
    this.sandboxForm.back();
  }


  /** Co-op host: the guest's quiver, shown on the battle setup's Quiver page (undefined alone). */
  public setSandboxPartner(partner: PartnerQuiver | undefined): void {
    this.sandboxForm.setPartner(partner);
  }

  public renderSoundLab(rows: readonly SoundLabRow[], music: SoundLabMusic, settings: Readonly<AudioSettings>): void {
    this.soundLabPanel.render(rows, music, settings);
  }

  public updateSoundLabMusic(state: SoundLabMusicState): void {
    this.soundLabPanel.updateMusic(state);
  }

  public setTrajectoryOption(showTrajectory: boolean): void {
    this.trajectoryInput.checked = showTrajectory;
  }

  public setCursorCircleOption(showCursorCircle: boolean): void {
    this.cursorCircleInput.checked = showCursorCircle;
  }

  public setBannerMarkersOption(enabled: boolean): void {
    this.bannerMarkersInput.checked = enabled;
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

  public setDamageNumbersOption(enabled: boolean): void {
    this.damageNumbersInput.checked = enabled;
  }

  public setFriendlyFireOption(enabled: boolean): void {
    this.friendlyFireInput.checked = enabled;
  }

  public setArrowTrailsOption(count: number): void {
    this.trailButtons.forEach((button) => {
      const active = Number(button.dataset.trailCount) === count;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', `${active}`);
    });
  }

  public setAudioOptions(settings: Readonly<AudioSettings>): void {
    this.soundInput.checked = settings.effectsEnabled;
    this.volumeInput.value = `${Math.round(settings.effectsVolume * 100)}`;
    this.musicInput.checked = settings.musicEnabled;
    this.musicVolumeInput.value = `${Math.round(settings.musicVolume * 100)}`;
  }

  public showEndScreen(options: EndScreenOptions): void {
    this.endTitle.textContent = options.title;
    this.endTitle.dataset.outcome = options.outcome;
    this.endCopy.textContent = options.copy;
    this.endStats.innerHTML = (options.stats ?? [])
      .map(({ label, value }) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
    this.endStats.hidden = !options.stats?.length;
    this.endButton.textContent = options.buttonLabel;
    this.onEndButton = options.onButton;
    this.endScreen.hidden = false;
    this.endScreen.classList.remove('viewing');
  }

  /**
   * Hides the end card to look over the battlefield (only a "Back to results" button stays), or brings it back; tells
   * the scene (`handlers.viewBattlefield`).
   */
  public setEndViewing(viewing: boolean): void {
    if (this.endScreen.hidden || this.endScreen.classList.contains('viewing') === viewing) {
      return;
    }
    this.endScreen.classList.toggle('viewing', viewing);
    this.handlers.viewBattlefield?.(viewing);
  }

  /**
   * The battle's pause dialog (hidden with `undefined`). It lies under the settings drawer and the tuning panel, so
   * both stay usable while paused.
   */
  public showPause(pause: PauseView | undefined): void {
    this.pauseScreen.hidden = !pause;
    if (pause) {
      this.pauseCopy.textContent = pause.byPartner ? 'Your partner paused the battle.' : pause.coop ? 'Paused for both players.' : 'The battle waits for you.';
      this.pauseRestart.hidden = !pause.canRestart;
      this.pauseQuiver = pause.quiver ? { loadout: [...pause.quiver], slot: 0 } : undefined;
      this.renderPauseQuiver();
    }
  }

  /** In the keep: the quiver editor; out in the open: a hint where to change it. */
  private renderPauseQuiver(): void {
    this.pauseCard.classList.toggle('pause-wide', this.pauseQuiver !== undefined);
    this.pauseQuiverRoot.innerHTML = this.pauseQuiver
      ? quiverPage(this.pauseQuiver.loadout, this.pauseQuiver.slot)
      : '<p class="pause-quiver-hint">Hide in the keep to change your quiver.</p>';
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

  public fitCanvas(): void {
    const viewport = document.documentElement;
    const availableWidth = viewport.clientWidth - PAGE_MARGIN * 2;
    this.host.style.width = `${availableWidth}px`;
    let fit = fitView(availableWidth, viewport.clientHeight);
    // Two passes: the HUD height depends on the width it wraps in, which depends on the canvas width.
    for (let pass = 0; pass < 2; pass += 1) {
      const hudHeight = (this.hudTop.hidden ? 0 : this.hudTop.offsetHeight)
        + (this.hudBottom.hidden ? 0 : this.hudBottom.offsetHeight);
      const availableHeight = viewport.clientHeight - PAGE_MARGIN * 2 - hudHeight;
      fit = fitView(availableWidth, availableHeight);
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
    this.query<HTMLButtonElement>(selector).addEventListener('click', handler);
  }

  private query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.host.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }
}
