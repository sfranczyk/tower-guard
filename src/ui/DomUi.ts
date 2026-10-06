import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ProjectileType } from '../types';
import type { AudioSettings } from '../audio/audioSettings';
import type { SoundId } from '../audio/SoundManager';
import type { SandboxSettings } from '../data/sandbox';
import { Hud, type HudValues } from './Hud';
import { SandboxForm } from './SandboxForm';
import { SoundLabPanel, type SoundLabMusic, type SoundLabMusicState, type SoundLabRow } from './SoundLabPanel';
import { HUD_BOTTOM_TEMPLATE, HUD_TOP_TEMPLATE, OVERLAY_TEMPLATE } from './template';

/** Breathing room kept around the canvas + HUD stack inside the window. */
const PAGE_MARGIN = 16;

export type UiScreen = 'menu' | 'sandbox' | 'animationLab' | 'soundLab' | 'game';

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
  openGame?: () => void;
  /** Animation lab: leave the zoomed view and return to the list. */
  labBack?: () => void;
  toggleOptions?: () => void;
  selectProjectile?: (type: ProjectileType) => void;
  sandboxChange?: (settings: SandboxSettings) => void;
  sandboxStart?: () => void;
  sandboxBack?: () => void;
  trajectoryChange?: (enabled: boolean) => void;
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
  private readonly soundLabScreen: HTMLElement;
  private readonly soundLabPanel: SoundLabPanel;
  private readonly projectileButtons: HTMLButtonElement[];
  private readonly trajectoryInput: HTMLInputElement;
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
      change: (settings) => this.handlers.sandboxChange?.(settings),
      start: () => this.handlers.sandboxStart?.(),
      back: () => this.handlers.sandboxBack?.(),
    });
    this.soundLabScreen = this.query('[data-sound-lab]');
    this.soundLabPanel = new SoundLabPanel(this.query('[data-sound-lab-panel]'), {
      play: (id, variant) => this.handlers.soundLabPlay?.(id, variant),
      toggleMusic: () => this.handlers.soundLabToggleMusic?.(),
      musicSeam: () => this.handlers.soundLabMusicSeam?.(),
      audioChange: (changes) => this.handlers.soundLabAudioChange?.(changes),
      back: () => this.handlers.soundLabBack?.(),
    });
    this.projectileButtons = Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-projectile]'));
    this.trajectoryInput = this.query<HTMLInputElement>('[data-trajectory]');
    this.soundInput = this.query<HTMLInputElement>('[data-sound]');
    this.volumeInput = this.query<HTMLInputElement>('[data-volume]');
    this.musicInput = this.query<HTMLInputElement>('[data-music]');
    this.musicVolumeInput = this.query<HTMLInputElement>('[data-music-volume]');

    this.onClick('[data-start]', () => this.handlers.start?.());
    this.onClick('[data-menu-settings]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-dev-toggle]', () => this.toggleDevTools());
    this.onClick('[data-open-test]', () => this.handlers.openAnimationLab?.());
    this.onClick('[data-open-sound-lab]', () => this.handlers.openSoundLab?.());
    this.onClick('[data-open-game]', () => this.handlers.openGame?.());
    this.onClick('[data-lab-back]', () => this.handlers.labBack?.());
    this.onClick('[data-options]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-close-options]', () => this.handlers.toggleOptions?.());
    this.endButton.addEventListener('click', () => this.onEndButton?.());
    this.projectileButtons.forEach((button) => {
      button.addEventListener('click', () => this.handlers.selectProjectile?.(button.dataset.projectile as ProjectileType));
    });
    this.trajectoryInput.addEventListener('change', () => this.handlers.trajectoryChange?.(this.trajectoryInput.checked));
    const audioChange = (changes: Partial<AudioSettings>): void => this.handlers.audioChange?.(changes);
    this.soundInput.addEventListener('change', () => audioChange({ effectsEnabled: this.soundInput.checked }));
    this.volumeInput.addEventListener('input', () => audioChange({ effectsVolume: Number(this.volumeInput.value) / 100 }));
    this.musicInput.addEventListener('change', () => audioChange({ musicEnabled: this.musicInput.checked }));
    this.musicVolumeInput.addEventListener('input', () => audioChange({ musicVolume: Number(this.musicVolumeInput.value) / 100 }));

    window.addEventListener('resize', () => this.fitCanvas());
    this.showScreen('menu');
  }

  /** Shows one screen and hides the others, including the end screen and settings drawer. */
  public showScreen(screen: UiScreen): void {
    this.menuScreen.hidden = screen !== 'menu';
    this.sandboxScreen.hidden = screen !== 'sandbox';
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

  public setActiveProjectile(type: ProjectileType): void {
    this.projectileButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.projectile === type);
    });
  }

  public setOptionsVisible(visible: boolean): void {
    this.optionsDrawer.hidden = !visible;
  }

  /** Rebuilds the sandbox setup form (e.g. after the wave count changes). */
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
  private fitCanvas(): void {
    const viewport = document.documentElement;
    const availableWidth = viewport.clientWidth - PAGE_MARGIN * 2;
    this.host.style.width = `${availableWidth}px`;
    // Two passes: the HUD height depends on the width it wraps in, which depends on the canvas width.
    for (let pass = 0; pass < 2; pass += 1) {
      const hudHeight = (this.hudTop.hidden ? 0 : this.hudTop.offsetHeight)
        + (this.hudBottom.hidden ? 0 : this.hudBottom.offsetHeight);
      const availableHeight = viewport.clientHeight - PAGE_MARGIN * 2 - hudHeight;
      const ratio = Math.max(0, Math.min(availableWidth / GAME_WIDTH, availableHeight / GAME_HEIGHT));
      const width = Math.max(1, Math.floor(GAME_WIDTH * ratio));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${Math.max(1, Math.floor(GAME_HEIGHT * ratio))}px`;
      this.host.style.width = `${width}px`;
    }
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
