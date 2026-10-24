import { clockText } from '../scenes/battleText';
import { ICON_ENEMY_PIP } from './icons';

export interface HudValues {
  defeatedEnemies: number;
  totalEnemies: number;
  level: number;
  levelCount: number;
  /** Survival: ms left on the clock (the chip shows it and the defeated count instead of pips). */
  clockMs?: number;
  /** MOBA: the local player's team, gold and his team's vault (the chip shows them instead of the level's progress). */
  moba?: { team: 'blue' | 'red'; gold: number; vault: number };
  /** The local player's keep and bowman, as numbers beside the Level chip. */
  health?: { keep: HealthValue; bowman: HealthValue; regenerating?: boolean };
}

export interface HealthValue {
  now: number;
  max: number;
}

const healthText = ({ now, max }: HealthValue): string => `${Math.ceil(Math.max(0, now))} / ${Math.round(max)}`;

/** Up to this many enemies the level shows one pip each; bigger levels get a progress bar. */
const MAX_PIPS = 14;

/** The in-game HUD bar above the canvas: the level's progress (health bars hang over the keep and bowmen in the world). */
export class Hud {
  private readonly level: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly levelBar: HTMLElement;
  private readonly enemyCount: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly purse: HTMLElement;
  private readonly healthChip: HTMLElement;
  private readonly keepHealth: HTMLElement;
  private readonly bowmanHealth: HTMLElement;
  private readonly regenIcon: HTMLElement;
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
    this.clock = query('[data-survival-clock]');
    this.purse = query('[data-moba-purse]');
    this.healthChip = query('[data-health-chip]');
    this.keepHealth = query('[data-keep-health]');
    this.bowmanHealth = query('[data-bowman-health]');
    this.regenIcon = query('[data-regen-icon]');
  }

  public update(values: HudValues): void {
    this.updateHealth(values.health);
    this.level.textContent = `${values.level} / ${values.levelCount}`;
    const { moba } = values;
    this.purse.hidden = !moba;
    this.enemyCount.hidden = !!moba;
    if (moba) {
      this.pips.hidden = true;
      this.levelBar.parentElement!.hidden = true;
      this.clock.hidden = true;
      const text = `<span class="moba-team ${moba.team}">${moba.team === 'blue' ? 'Blue' : 'Red'}</span> <b>${moba.gold}</b> gold · vault ${moba.vault}`;
      if (this.purse.innerHTML !== text) {
        this.purse.innerHTML = text;
      }
      return;
    }
    const survival = values.clockMs !== undefined;
    this.clock.hidden = !survival;
    if (survival) {
      // Survival: the time to dawn instead of the level's progress.
      this.clock.innerHTML = `${clockText(values.clockMs!)}<small>to dawn</small>`;
      this.enemyCount.textContent = `${values.defeatedEnemies} defeated`;
      this.pips.hidden = true;
      this.levelBar.parentElement!.hidden = true;
      return;
    }
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

  private updateHealth(health: HudValues['health']): void {
    this.healthChip.hidden = !health;
    if (!health) {
      return;
    }
    const keep = healthText(health.keep);
    const bowman = healthText(health.bowman);
    if (this.keepHealth.textContent !== keep) {
      this.keepHealth.textContent = keep;
    }
    if (this.bowmanHealth.textContent !== bowman) {
      this.bowmanHealth.textContent = bowman;
    }
    this.regenIcon.hidden = !health.regenerating;
  }

}
