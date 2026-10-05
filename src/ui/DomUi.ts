import type { ProjectileType } from '../types';
import { UI_TEMPLATE } from './template';

export type UiScreen = 'menu' | 'animationLab' | 'game';

export interface HudValues {
  towerHealth: number;
  bowmanHealth: number;
  defeatedEnemies: number;
  totalEnemies: number;
  level: number;
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

/** HTML overlay on top of the canvas: menus, HUD, settings drawer and end screen. */
export class DomUi {
  public readonly handlers: UiHandlers = {};

  private readonly root: HTMLDivElement;
  private readonly menuScreen: HTMLElement;
  private readonly labScreen: HTMLElement;
  private readonly gameUi: HTMLElement;
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
  private readonly goldElement: HTMLElement;
  private readonly projectileButtons: HTMLButtonElement[];
  private readonly gravityInput: HTMLInputElement;
  private readonly tensionInput: HTMLInputElement;
  private readonly gravityValue: HTMLElement;
  private readonly tensionValue: HTMLElement;
  private onEndButton?: () => void;

  public constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ui-root';
    this.root.innerHTML = UI_TEMPLATE;
    host.appendChild(this.root);

    this.menuScreen = this.query('[data-menu]');
    this.labScreen = this.query('[data-test]');
    this.gameUi = this.query('[data-game-ui]');
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
    this.goldElement = this.query('[data-gold]');
    this.projectileButtons = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-projectile]'));
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
  }

  /** Shows one screen and hides the others, including the end screen and settings drawer. */
  public showScreen(screen: UiScreen): void {
    this.menuScreen.hidden = screen !== 'menu';
    this.labScreen.hidden = screen !== 'animationLab';
    this.gameUi.hidden = screen !== 'game';
    this.endScreen.hidden = true;
    this.optionsDrawer.hidden = true;
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

  private onClick(selector: string, handler: () => void): void {
    this.query<HTMLButtonElement>(selector).addEventListener('click', handler);
  }

  private query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
  }
}
