import { GAME_WIDTH } from '../config';
import { fitView, type ViewFit } from '../core/viewport';
import type { ProjectileType } from '../types';
import type { AudioSettings } from '../audio/audioSettings';
import type { SoundId } from '../audio/SoundManager';
import type { SandboxSettings } from '../data/sandbox';
import type { ArrowType } from '../data/loadout';
import { Hud, type HudValues } from './Hud';
import { CoopPanel, type CoopView } from './CoopPanel';
import { SandboxForm } from './SandboxForm';
import { SoundLabPanel, type SoundLabMusic, type SoundLabMusicState, type SoundLabRow } from './SoundLabPanel';
import { HUD_BOTTOM_TEMPLATE, HUD_TOP_TEMPLATE, OVERLAY_TEMPLATE, weaponSlots } from './template';

/** Breathing room kept around the canvas + HUD stack inside the window. */
const PAGE_MARGIN = 16;
/**
 * Overlay zoom relative to the canvas scale: a bit larger than the canvas on small screens (`boost`) so text
 * stays readable, within `min`..`max`.
 */
const UI_SCALE = { min: 0.6, max: 1.15, boost: 1.12 };

export type UiScreen = 'menu' | 'coop' | 'sandbox' | 'animationLab' | 'soundLab' | 'game';

export type { CoopView } from './CoopPanel';

export type { HudValues } from './Hud';

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
  openGame?: () => void;
  /** Animation lab: leave the zoomed view and return to the list. */
  labBack?: () => void;
  toggleOptions?: () => void;
  selectProjectile?: (type: ProjectileType) => void;
  /** `level`: the level being edited (its battleground is shown behind the form). */
  sandboxChange?: (settings: SandboxSettings, level: number) => void;
  sandboxStart?: () => void;
  sandboxBack?: () => void;
  openCoop?: () => void;
  coopHost?: () => void;
  coopJoin?: (code: string) => void;
  coopSetup?: () => void;
  coopLeave?: () => void;
  trajectoryChange?: (enabled: boolean) => void;
  cursorCircleChange?: (enabled: boolean) => void;
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
  private readonly weaponsRoot: HTMLElement;
  private readonly trajectoryInput: HTMLInputElement;
  private readonly cursorCircleInput: HTMLInputElement;
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
    host.append(this.hudTop, stage, this.hudBottom);

    this.menuScreen = this.query('[data-menu]');
    this.labScreen = this.query('[data-test]');
    this.optionsDrawer = this.query('[data-drawer]');
    this.endScreen = this.query('[data-end]');
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
    this.onClick('[data-open-game]', () => this.handlers.openGame?.());
    this.onClick('[data-lab-back]', () => this.handlers.labBack?.());
    this.onClick('[data-options]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-close-options]', () => this.handlers.toggleOptions?.());
    this.endButton.addEventListener('click', () => this.onEndButton?.());
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

  public renderSandbox(settings: SandboxSettings): void {
    this.sandboxForm.render(settings);
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
