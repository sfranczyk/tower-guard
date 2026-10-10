import { ICON_ENEMY_PIP } from './icons';

export interface HudValues {
  defeatedEnemies: number;
  totalEnemies: number;
  level: number;
  levelCount: number;
}

/** Up to this many enemies the level shows one pip each; bigger levels get a progress bar. */
const MAX_PIPS = 14;

/** The in-game HUD bar above the canvas: the level's progress (health bars hang over the keep and bowmen in the world). */
export class Hud {
  private readonly level: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly levelBar: HTMLElement;
  private readonly enemyCount: HTMLElement;
  private pipCount = -1;

  public constructor(root: HTMLElement) {
    const query = (selector: string): HTMLElement => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) {
        throw new Error(`Missing HUD element: ${selector}`);
      }
      return element;
    };
    this.level = query('[data-level-number]');
    this.pips = query('[data-enemy-pips]');
    this.levelBar = query('[data-level-bar]');
    this.enemyCount = query('[data-enemy-count]');
  }

  public update(values: HudValues): void {
    this.level.textContent = `${values.level} / ${values.levelCount}`;
    this.enemyCount.textContent = `${values.defeatedEnemies} of ${values.totalEnemies} defeated`;

    const usePips = values.totalEnemies <= MAX_PIPS;
    this.pips.hidden = !usePips;
    this.levelBar.parentElement!.hidden = usePips;
    if (usePips) {
      if (this.pipCount !== values.totalEnemies) {
        this.pipCount = values.totalEnemies;
        this.pips.innerHTML = Array.from({ length: values.totalEnemies }, () => `<span class="pip">${ICON_ENEMY_PIP}</span>`).join('');
      }
      Array.from(this.pips.children).forEach((pip, index) => pip.classList.toggle('defeated', index < values.defeatedEnemies));
    } else {
      this.levelBar.style.width = `${(values.defeatedEnemies / Math.max(1, values.totalEnemies)) * 100}%`;
    }
  }

}
