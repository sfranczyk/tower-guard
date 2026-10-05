import { BATTLEGROUNDS, BATTLEGROUND_IDS, type BattlegroundId } from '../data/battlegrounds';
import {
  ENEMY_TYPES,
  ENEMY_TYPE_LABELS,
  HEALTH_LIMITS,
  MAX_ENEMIES_PER_TYPE,
  MAX_WAVES,
  MIN_WAVES,
  waveEnemyTotal,
  type SandboxSettings,
  type WaveEnemyCounts,
} from '../data/sandbox';

export interface SandboxFormCallbacks {
  change(settings: SandboxSettings): void;
  start(): void;
  back(): void;
}

/** The sandbox setup form: wave count, per-wave enemies and battleground, bowman and keep health. */
export class SandboxForm {
  private settings?: SandboxSettings;

  public constructor(private readonly root: HTMLElement, private readonly callbacks: SandboxFormCallbacks) {
    root.addEventListener('input', () => this.emitChange());
    root.addEventListener('change', () => this.emitChange());
    root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-sandbox-start]')) {
        this.callbacks.start();
      } else if (target.closest('[data-sandbox-back]')) {
        this.callbacks.back();
      }
    });
  }

  public render(settings: SandboxSettings): void {
    this.settings = settings;
    const option = (value: string | number, label: string, selected: boolean): string =>
      `<option value="${value}"${selected ? ' selected' : ''}>${label}</option>`;
    const numberInput = (attributes: string, value: number, min: number, max: number, step = 1): string =>
      `<input type="number" ${attributes} value="${value}" min="${min}" max="${max}" step="${step}">`;

    const waveOptions = Array.from({ length: MAX_WAVES - MIN_WAVES + 1 }, (_, index) => {
      const count = MIN_WAVES + index;
      return option(count, `${count}`, count === settings.waveCount);
    }).join('');
    const rows = settings.waves.slice(0, settings.waveCount).map((wave, index) => `
      <tr>
        <td class="wave-number">${index + 1}</td>
        ${ENEMY_TYPES.map((type) => `<td>${numberInput(`data-wave="${index}" data-enemy="${type}"`, wave.enemies[type], 0, MAX_ENEMIES_PER_TYPE)}</td>`).join('')}
        <td class="wave-total" data-wave-total="${index}">${waveEnemyTotal(wave.enemies)}</td>
        <td><select data-wave="${index}" data-battleground>
          ${BATTLEGROUND_IDS.map((id) => option(id, BATTLEGROUNDS[id].name, id === wave.battleground)).join('')}
        </select></td>
      </tr>`).join('');

    this.root.innerHTML = `
      <div class="eyebrow">Sandbox</div>
      <h2>Battle setup</h2>
      <div class="sandbox-fields">
        <label class="field"><span class="hud-label">Waves</span><select data-wave-count>${waveOptions}</select></label>
        <label class="field"><span class="hud-label">Bowman health</span>${numberInput('data-bowman-health', settings.bowmanHealth, HEALTH_LIMITS.bowman.min, HEALTH_LIMITS.bowman.max, HEALTH_LIMITS.bowman.step)}</label>
        <label class="field"><span class="hud-label">Keep health</span>${numberInput('data-keep-health', settings.keepHealth, HEALTH_LIMITS.keep.min, HEALTH_LIMITS.keep.max, HEALTH_LIMITS.keep.step)}</label>
      </div>
      <table class="wave-table">
        <thead><tr>
          <th>Wave</th>${ENEMY_TYPES.map((type) => `<th>${ENEMY_TYPE_LABELS[type]}</th>`).join('')}<th>Total</th><th>Battleground</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sandbox-actions">
        <button class="secondary-button" data-sandbox-back>Back</button>
        <button class="primary-button" data-sandbox-start>Start battle</button>
      </div>`;
  }

  /** Reads the form into settings (waves beyond the visible ones keep their previous setup). */
  private read(): SandboxSettings | undefined {
    const previous = this.settings;
    if (!previous) {
      return undefined;
    }
    const value = (selector: string, fallback: number): number => {
      const input = this.root.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
      return input ? Number(input.value) : fallback;
    };
    return {
      waveCount: value('[data-wave-count]', previous.waveCount),
      bowmanHealth: value('[data-bowman-health]', previous.bowmanHealth),
      keepHealth: value('[data-keep-health]', previous.keepHealth),
      waves: previous.waves.map((wave, index) => {
        const enemies = Object.fromEntries(ENEMY_TYPES.map((type) => [
          type,
          value(`[data-wave="${index}"][data-enemy="${type}"]`, wave.enemies[type]),
        ])) as WaveEnemyCounts;
        const select = this.root.querySelector<HTMLSelectElement>(`select[data-wave="${index}"][data-battleground]`);
        return { enemies, battleground: (select?.value as BattlegroundId | undefined) ?? wave.battleground };
      }),
    };
  }

  private emitChange(): void {
    const settings = this.read();
    if (!settings) {
      return;
    }
    settings.waves.slice(0, settings.waveCount).forEach((wave, index) => {
      const total = this.root.querySelector(`[data-wave-total="${index}"]`);
      if (total) {
        total.textContent = `${waveEnemyTotal(wave.enemies)}`;
      }
    });
    this.settings = settings;
    this.callbacks.change(settings);
  }
}
