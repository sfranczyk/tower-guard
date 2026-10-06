import { ICON_ENEMY_PIP } from './icons';

export interface HudValues {
  towerHealth: number;
  towerMaxHealth: number;
  bowmanHealth: number;
  bowmanMaxHealth: number;
  defeatedEnemies: number;
  totalEnemies: number;
  wave: number;
  waveCount: number;
}

/** Up to this many enemies the wave shows one pip each; bigger waves get a progress bar. */
const MAX_PIPS = 14;

/** Health bar colour by share left: green, then amber, then red. */
export const healthColor = (ratio: number): string => {
  if (ratio > 0.6) {
    return 'var(--good)';
  }
  return ratio > 0.3 ? 'var(--warn)' : 'var(--bad)';
};

/** The in-game HUD bar above the canvas: keep and bowman health bars and the wave's progress. */
export class Hud {
  private readonly towerBar: HTMLElement;
  private readonly towerValue: HTMLElement;
  private readonly bowmanBar: HTMLElement;
  private readonly bowmanValue: HTMLElement;
  private readonly wave: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly waveBar: HTMLElement;
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
    this.towerBar = query('[data-tower-bar]');
    this.towerValue = query('[data-tower-health]');
    this.bowmanBar = query('[data-bowman-bar]');
    this.bowmanValue = query('[data-bowman-health]');
    this.wave = query('[data-wave]');
    this.pips = query('[data-enemy-pips]');
    this.waveBar = query('[data-wave-bar]');
    this.enemyCount = query('[data-enemy-count]');
  }

  public update(values: HudValues): void {
    Hud.setBar(this.towerBar, values.towerHealth / values.towerMaxHealth);
    this.towerValue.textContent = `${Math.ceil(values.towerHealth)} / ${values.towerMaxHealth}`;
    Hud.setBar(this.bowmanBar, values.bowmanHealth / values.bowmanMaxHealth);
    this.bowmanValue.textContent = `${Math.ceil(values.bowmanHealth)} / ${values.bowmanMaxHealth}`;
    this.wave.textContent = `${values.wave} / ${values.waveCount}`;
    this.enemyCount.textContent = `${values.defeatedEnemies} of ${values.totalEnemies} defeated`;

    const usePips = values.totalEnemies <= MAX_PIPS;
    this.pips.hidden = !usePips;
    this.waveBar.parentElement!.hidden = usePips;
    if (usePips) {
      if (this.pipCount !== values.totalEnemies) {
        this.pipCount = values.totalEnemies;
        this.pips.innerHTML = Array.from({ length: values.totalEnemies }, () => `<span class="pip">${ICON_ENEMY_PIP}</span>`).join('');
      }
      Array.from(this.pips.children).forEach((pip, index) => pip.classList.toggle('defeated', index < values.defeatedEnemies));
    } else {
      this.waveBar.style.width = `${(values.defeatedEnemies / Math.max(1, values.totalEnemies)) * 100}%`;
    }
  }

  private static setBar(bar: HTMLElement, ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    bar.style.width = `${clamped * 100}%`;
    bar.style.background = healthColor(clamped);
  }
}
