import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ProjectileType } from '../types';
import type { SandboxSettings } from '../data/sandbox';
import { SandboxForm } from './SandboxForm';
import { HUD_BOTTOM_TEMPLATE, HUD_TOP_TEMPLATE, OVERLAY_TEMPLATE } from './template';

/** Breathing room kept around the canvas + HUD stack inside the window. */
const PAGE_MARGIN = 16;

export type UiScreen = 'menu' | 'sandbox' | 'animationLab' | 'game';

export interface HudValues {
  towerHealth: number;
  bowmanHealth: number;
  defeatedEnemies: number;
  totalEnemies: number;
  wave: number;
  waveCount: number;
  battlegroundName: string;
}

export interface EndScreenOptions {
  title: string;
  titleColor: string;
  copy: string;
  buttonLabel: string;
  onButton: () => void;
}

/** Callbacks wired to DOM controls. Scenes assign the ones they care about. */
export interface UiHandlers {
  start?: () => void;
  openAnimationLab?: () => void;
  openGame?: () => void;
  /** Animation lab: leave the zoomed view and return to the list. */
  labBack?: () => void;
  toggleOptions?: () => void;
  selectProjectile?: (type: ProjectileType) => void;
  sandboxChange?: (settings: SandboxSettings) => void;
  sandboxStart?: () => void;
  sandboxBack?: () => void;
  trajectoryChange?: (enabled: boolean) => void;
  soundChange?: (enabled: boolean) => void;
  /** Master volume 0..1. */
  volumeChange?: (volume: number) => void;
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
  private readonly towerHealthElement: HTMLElement;
  private readonly bowmanHealthElement: HTMLElement;
  private readonly enemyCountElement: HTMLElement;
  private readonly waveElement: HTMLElement;
  private readonly battlegroundElement: HTMLElement;
  private readonly sandboxScreen: HTMLElement;
  private readonly sandboxForm: SandboxForm;
  private readonly projectileButtons: HTMLButtonElement[];
  private readonly trajectoryInput: HTMLInputElement;
  private readonly soundInput: HTMLInputElement;
  private readonly volumeInput: HTMLInputElement;
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
    this.towerHealthElement = this.query('[data-tower-health]');
    this.bowmanHealthElement = this.query('[data-bowman-health]');
    this.enemyCountElement = this.query('[data-enemy-count]');
    this.waveElement = this.query('[data-wave]');
    this.battlegroundElement = this.query('[data-battleground]');
    this.sandboxScreen = this.query('[data-sandbox]');
    this.sandboxForm = new SandboxForm(this.query('[data-sandbox-form]'), {
      change: (settings) => this.handlers.sandboxChange?.(settings),
      start: () => this.handlers.sandboxStart?.(),
      back: () => this.handlers.sandboxBack?.(),
    });
    this.projectileButtons = Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-projectile]'));
    this.trajectoryInput = this.query<HTMLInputElement>('[data-trajectory]');
    this.soundInput = this.query<HTMLInputElement>('[data-sound]');
    this.volumeInput = this.query<HTMLInputElement>('[data-volume]');

    this.onClick('[data-start]', () => this.handlers.start?.());
    this.onClick('[data-open-test]', () => this.handlers.openAnimationLab?.());
    this.onClick('[data-open-game]', () => this.handlers.openGame?.());
    this.onClick('[data-lab-back]', () => this.handlers.labBack?.());
    this.onClick('[data-options]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-close-options]', () => this.handlers.toggleOptions?.());
    this.endButton.addEventListener('click', () => this.onEndButton?.());
    this.projectileButtons.forEach((button) => {
      button.addEventListener('click', () => this.handlers.selectProjectile?.(button.dataset.projectile as ProjectileType));
    });
    this.trajectoryInput.addEventListener('change', () => this.handlers.trajectoryChange?.(this.trajectoryInput.checked));
    this.soundInput.addEventListener('change', () => this.handlers.soundChange?.(this.soundInput.checked));
    this.volumeInput.addEventListener('input', () => this.handlers.volumeChange?.(Number(this.volumeInput.value) / 100));

    window.addEventListener('resize', () => this.fitCanvas());
    this.showScreen('menu');
  }

  /** Shows one screen and hides the others, including the end screen and settings drawer. */
  public showScreen(screen: UiScreen): void {
    this.menuScreen.hidden = screen !== 'menu';
    this.sandboxScreen.hidden = screen !== 'sandbox';
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
    this.towerHealthElement.textContent = `${values.towerHealth} HP`;
    this.bowmanHealthElement.textContent = `${values.bowmanHealth} HP`;
    this.enemyCountElement.textContent = `${values.defeatedEnemies} / ${values.totalEnemies}`;
    this.waveElement.textContent = `${values.wave} / ${values.waveCount}`;
    this.battlegroundElement.textContent = values.battlegroundName;
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

  public setTrajectoryOption(showTrajectory: boolean): void {
    this.trajectoryInput.checked = showTrajectory;
  }

  public setSoundOptions(enabled: boolean, volume: number): void {
    this.soundInput.checked = enabled;
    this.volumeInput.value = `${Math.round(volume * 100)}`;
  }

  public showEndScreen(options: EndScreenOptions): void {
    this.endTitle.textContent = options.title;
    this.endTitle.style.color = options.titleColor;
    this.endCopy.textContent = options.copy;
    this.endButton.textContent = options.buttonLabel;
    this.onEndButton = options.onButton;
    this.endScreen.hidden = false;
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
