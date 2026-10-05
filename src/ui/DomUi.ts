import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ProjectileType } from '../types';
import { HUD_BOTTOM_TEMPLATE, HUD_TOP_TEMPLATE, OVERLAY_TEMPLATE } from './template';

/** Breathing room kept around the canvas + HUD stack inside the window. */
const PAGE_MARGIN = 16;

export type UiScreen = 'menu' | 'animationLab' | 'game';

export interface HudValues {
  towerHealth: number;
  bowmanHealth: number;
  defeatedEnemies: number;
  totalEnemies: number;
  level: number;
  levelName: string;
  gold: number;
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
  toggleOptions?: () => void;
  selectProjectile?: (type: ProjectileType) => void;
  gravityChange?: (value: number) => void;
  tensionChange?: (value: number) => void;
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
  private readonly statusElement: HTMLElement;
  private readonly strengthElement: HTMLElement;
  private readonly towerHealthElement: HTMLElement;
  private readonly bowmanHealthElement: HTMLElement;
  private readonly enemyCountElement: HTMLElement;
  private readonly levelElement: HTMLElement;
  private readonly levelNameElement: HTMLElement;
  private readonly goldElement: HTMLElement;
  private readonly projectileButtons: HTMLButtonElement[];
  private readonly gravityInput: HTMLInputElement;
  private readonly tensionInput: HTMLInputElement;
  private readonly gravityValue: HTMLElement;
  private readonly tensionValue: HTMLElement;
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
    this.statusElement = this.query('[data-status]');
    this.strengthElement = this.query('[data-force]');
    this.towerHealthElement = this.query('[data-tower-health]');
    this.bowmanHealthElement = this.query('[data-bowman-health]');
    this.enemyCountElement = this.query('[data-enemy-count]');
    this.levelElement = this.query('[data-level]');
    this.levelNameElement = this.query('[data-level-name]');
    this.goldElement = this.query('[data-gold]');
    this.projectileButtons = Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-projectile]'));
    this.gravityInput = this.query<HTMLInputElement>('[data-gravity]');
    this.tensionInput = this.query<HTMLInputElement>('[data-tension]');
    this.gravityValue = this.query('[data-gravity-value]');
    this.tensionValue = this.query('[data-tension-value]');

    this.onClick('[data-start]', () => this.handlers.start?.());
    this.onClick('[data-open-test]', () => this.handlers.openAnimationLab?.());
    this.onClick('[data-open-game]', () => this.handlers.openGame?.());
    this.onClick('[data-options]', () => this.handlers.toggleOptions?.());
    this.onClick('[data-close-options]', () => this.handlers.toggleOptions?.());
    this.endButton.addEventListener('click', () => this.onEndButton?.());
    this.projectileButtons.forEach((button) => {
      button.addEventListener('click', () => this.handlers.selectProjectile?.(button.dataset.projectile as ProjectileType));
    });
    this.gravityInput.addEventListener('input', () => this.handlers.gravityChange?.(Number(this.gravityInput.value)));
    this.tensionInput.addEventListener('input', () => this.handlers.tensionChange?.(Number(this.tensionInput.value)));

    window.addEventListener('resize', () => this.fitCanvas());
    this.showScreen('menu');
  }

  /** Shows one screen and hides the others, including the end screen and settings drawer. */
  public showScreen(screen: UiScreen): void {
    this.menuScreen.hidden = screen !== 'menu';
    this.labScreen.hidden = screen !== 'animationLab';
    this.hudTop.hidden = screen !== 'game';
    this.hudBottom.hidden = screen !== 'game';
    this.endScreen.hidden = true;
    this.optionsDrawer.hidden = true;
    this.fitCanvas();
  }

  public setStatus(text: string): void {
    this.statusElement.textContent = text;
  }

  public setAimPower(ratio: number): void {
    this.strengthElement.textContent = `${Math.round(ratio * 100)}%`;
  }

  public updateHud(values: HudValues): void {
    this.towerHealthElement.textContent = `${values.towerHealth} HP`;
    this.bowmanHealthElement.textContent = `${values.bowmanHealth} HP`;
    this.enemyCountElement.textContent = `${values.defeatedEnemies} / ${values.totalEnemies}`;
    this.levelElement.textContent = `${values.level}`;
    this.levelNameElement.textContent = values.levelName;
    this.goldElement.textContent = `${values.gold}`;
  }

  public setActiveProjectile(type: ProjectileType): void {
    this.projectileButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.projectile === type);
    });
  }

  public setOptionsVisible(visible: boolean): void {
    this.optionsDrawer.hidden = !visible;
  }

  public setOptionValues(gravity: number, tension: number): void {
    this.gravityValue.textContent = `${Math.round(gravity)}`;
    this.tensionValue.textContent = `${Math.round(tension * 100)}%`;
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
