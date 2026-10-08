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
  type WaveSetup,
} from '../data/sandbox';
import { LOADOUT_SLOTS, clearSlot, isArrowType, placeArrow } from '../data/loadout';
import type { EnemyType } from '../types';
import { ICON_BOWMAN, ICON_ENEMIES, ICON_KEEP } from './icons';
import { mapThumbnail } from './mapThumbnail';
import { QuiverDrag, type QuiverDragSource, type QuiverDropTarget } from './quiverDrag';
import { quiverPage } from './quiverPage';

/** The form's pages: the levels (maps and enemies) and the quiver (the arrows in the weapon slots). */
type SandboxPage = 'levels' | 'quiver';
const PAGES: ReadonlyArray<{ id: SandboxPage; label: string }> = [
  { id: 'levels', label: 'Levels' },
  { id: 'quiver', label: 'Quiver' },
];

export interface SandboxFormCallbacks {
  /** `level` is the level being edited (its battleground is previewed behind the form). */
  change(settings: SandboxSettings, level: number): void;
  start(): void;
  back(): void;
}

/**
 * The sandbox setup form, in two pages. Levels: the run is a row of levels (tabs, each with its map and enemy
 * count, plus add and remove); below, the selected level's battleground (map cards) and enemies (a card per type
 * with − / +). Quiver: which arrow goes in each weapon slot (`quiverPage`). Bowman and keep health sit in the
 * header. In the code a level is still a "wave" (SandboxSettings.waves).
 */
export class SandboxForm {
  private settings?: SandboxSettings;
  /** The level being edited. */
  private selected = 0;
  private page: SandboxPage = 'levels';
  /** The quiver slot the next picked arrow goes into. */
  private selectedSlot = 0;

  public constructor(private readonly root: HTMLElement, private readonly callbacks: SandboxFormCallbacks) {
    root.addEventListener('input', (event) => {
      if ((event.target as HTMLElement).matches('[data-bowman-health], [data-keep-health]')) {
        this.readHealth();
      }
    });
    root.addEventListener('click', (event) => this.onClick(event.target as HTMLElement));
    new QuiverDrag(root, (source, target) => this.onQuiverDrop(source, target));
  }

  public render(settings: SandboxSettings): void {
    this.settings = settings;
    this.selected = Math.min(this.selected, settings.waveCount - 1);
    const numberInput = (attribute: string, value: number, limits: { min: number; max: number; step: number }): string =>
      `<input type="number" ${attribute} value="${value}" min="${limits.min}" max="${limits.max}" step="${limits.step}">`;

    this.root.innerHTML = `
      <div class="sandbox-head">
        <div><div class="eyebrow">Sandbox</div><h2>Battle setup</h2></div>
        <div class="sandbox-pages" role="tablist" aria-label="Setup pages">
          ${PAGES.map(({ id, label }) => `<button type="button" class="sandbox-page${id === this.page ? ' active' : ''}" role="tab" aria-selected="${id === this.page}" data-page="${id}">${label}</button>`).join('')}
        </div>
        <div class="sandbox-health">
          <label class="health-field" title="Bowman health">${ICON_BOWMAN}<span>Bowman</span>${numberInput('data-bowman-health', settings.bowmanHealth, HEALTH_LIMITS.bowman)}</label>
          <label class="health-field" title="Keep health">${ICON_KEEP}<span>Keep</span>${numberInput('data-keep-health', settings.keepHealth, HEALTH_LIMITS.keep)}</label>
        </div>
      </div>
      ${this.page === 'levels' ? this.levelsPage(settings) : quiverPage(settings.loadout, this.selectedSlot)}
      <div class="sandbox-actions">
        <button class="secondary-button" data-sandbox-back>Back</button>
        <button class="primary-button" data-sandbox-start>Start battle</button>
      </div>`;
  }

  private levelsPage(settings: SandboxSettings): string {
    const level = settings.waves[this.selected];
    return `
      <div class="level-tabs" role="tablist" aria-label="Levels">
        ${settings.waves.slice(0, settings.waveCount).map((wave, index) => this.levelTab(wave, index)).join('')}
        ${settings.waveCount < MAX_WAVES ? '<button type="button" class="level-add" data-level-add>+ Add level</button>' : ''}
      </div>
      <div class="level-editor">
        <div class="level-editor-head">
          <div class="sandbox-section-label">Level ${this.selected + 1} · Battleground</div>
          ${settings.waveCount > MIN_WAVES ? '<button type="button" class="level-remove" data-level-remove>Remove level</button>' : ''}
        </div>
        <div class="map-cards">
          ${BATTLEGROUND_IDS.map((id) => `<button type="button" class="map-card${id === level.battleground ? ' active' : ''}" data-map="${id}" aria-pressed="${id === level.battleground}">
            ${mapThumbnail(BATTLEGROUNDS[id])}<span>${BATTLEGROUNDS[id].name}</span></button>`).join('')}
        </div>
        <div class="sandbox-section-label">Enemies <span data-level-total>${waveEnemyTotal(level.enemies)}</span></div>
        <div class="enemy-cards">
          ${ENEMY_TYPES.map((type) => this.enemyCard(type, level.enemies[type])).join('')}
        </div>
      </div>`;
  }

  private levelTab(wave: WaveSetup, index: number): string {
    const active = index === this.selected;
    const total = waveEnemyTotal(wave.enemies);
    return `<button type="button" class="level-tab${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-level="${index}" title="${BATTLEGROUNDS[wave.battleground].name}">
      ${mapThumbnail(BATTLEGROUNDS[wave.battleground])}
      <span class="level-tab-text"><strong>Level ${index + 1}</strong><small data-tab-total="${index}">${total} ${total === 1 ? 'enemy' : 'enemies'}</small></span>
    </button>`;
  }

  private enemyCard(type: EnemyType, count: number): string {
    return `<div class="enemy-card${count === 0 ? ' empty' : ''}" data-enemy-card="${type}">
      ${ICON_ENEMIES[type]}
      <span class="enemy-name">${ENEMY_TYPE_LABELS[type]}</span>
      <span class="stepper">
        <button type="button" data-step="${type}" data-delta="-1" aria-label="One ${ENEMY_TYPE_LABELS[type]} fewer"${count <= 0 ? ' disabled' : ''}>−</button>
        <output data-count="${type}">${count}</output>
        <button type="button" data-step="${type}" data-delta="1" aria-label="One ${ENEMY_TYPE_LABELS[type]} more"${count >= MAX_ENEMIES_PER_TYPE ? ' disabled' : ''}>+</button>
      </span>
    </div>`;
  }

  private onClick(target: HTMLElement): void {
    const settings = this.settings;
    if (!settings) {
      return;
    }
    const tab = target.closest<HTMLElement>('[data-level]');
    const map = target.closest<HTMLElement>('[data-map]');
    const step = target.closest<HTMLButtonElement>('[data-step]');
    const page = target.closest<HTMLElement>('[data-page]');
    const slotClear = target.closest<HTMLElement>('[data-slot-clear]');
    const slot = target.closest<HTMLElement>('[data-slot]');
    const arrow = target.closest<HTMLElement>('[data-arrow]');
    if (page) {
      this.page = page.dataset.page as SandboxPage;
      this.render(settings);
    } else if (slotClear) {
      this.selectedSlot = Number(slotClear.dataset.slotClear);
      this.update({ ...settings, loadout: clearSlot(settings.loadout, this.selectedSlot) }, this.selected);
    } else if (slot) {
      this.selectedSlot = Number(slot.dataset.slot);
      this.render(settings);
    } else if (arrow && isArrowType(arrow.dataset.arrow)) {
      const loadout = placeArrow(settings.loadout, this.selectedSlot, arrow.dataset.arrow);
      // Move on to the next slot, so filling the quiver is one click per arrow.
      this.selectedSlot = (this.selectedSlot + 1) % LOADOUT_SLOTS;
      this.update({ ...settings, loadout }, this.selected);
    } else if (tab) {
      this.selected = Number(tab.dataset.level);
      this.render(settings);
      this.emit();
    } else if (target.closest('[data-level-add]') && settings.waveCount < MAX_WAVES) {
      // The new level is the next stored one (it keeps whatever it was last set up with).
      this.update({ ...settings, waveCount: settings.waveCount + 1 }, settings.waveCount);
    } else if (target.closest('[data-level-remove]') && settings.waveCount > MIN_WAVES) {
      // Later levels move up; the removed one goes to the end, out of the run.
      const waves = [...settings.waves];
      const [removed] = waves.splice(this.selected, 1);
      waves.push(removed);
      this.update({ ...settings, waves, waveCount: settings.waveCount - 1 }, Math.max(0, this.selected - 1));
    } else if (map) {
      this.update(this.withLevel(settings, { battleground: map.dataset.map as BattlegroundId }), this.selected);
    } else if (step) {
      const type = step.dataset.step as EnemyType;
      const level = settings.waves[this.selected];
      const count = Math.max(0, Math.min(MAX_ENEMIES_PER_TYPE, level.enemies[type] + Number(step.dataset.delta)));
      this.settings = this.withLevel(settings, { enemies: { ...level.enemies, [type]: count } });
      // Update in place, so held clicks and the scroll position aren't disturbed.
      this.refreshEnemy(type, count);
      this.emit();
    } else if (target.closest('[data-sandbox-start]')) {
      this.callbacks.start();
    } else if (target.closest('[data-sandbox-back]')) {
      this.callbacks.back();
    }
  }

  /** An arrow card or a slot's arrow dropped on a slot (placed there, swapping), or a slot's back on the list (emptied). */
  private onQuiverDrop(source: QuiverDragSource, target: QuiverDropTarget): void {
    const settings = this.settings;
    if (!settings) {
      return;
    }
    const type = 'arrow' in source ? source.arrow : settings.loadout[source.slot];
    if (target === 'arrows') {
      if ('slot' in source) {
        this.selectedSlot = source.slot;
        this.update({ ...settings, loadout: clearSlot(settings.loadout, source.slot) }, this.selected);
      }
    } else if (type) {
      this.selectedSlot = target.slot;
      this.update({ ...settings, loadout: placeArrow(settings.loadout, target.slot, type) }, this.selected);
    }
  }

  private withLevel(settings: SandboxSettings, change: Partial<WaveSetup>): SandboxSettings {
    return { ...settings, waves: settings.waves.map((wave, index) => (index === this.selected ? { ...wave, ...change } : wave)) };
  }

  private update(settings: SandboxSettings, selected: number): void {
    this.selected = selected;
    this.render(settings);
    this.emit();
  }

  private refreshEnemy(type: EnemyType, count: number): void {
    const settings = this.settings!;
    const card = this.root.querySelector(`[data-enemy-card="${type}"]`);
    card?.classList.toggle('empty', count === 0);
    const output = this.root.querySelector(`[data-count="${type}"]`);
    if (output) {
      output.textContent = `${count}`;
    }
    this.root.querySelectorAll<HTMLButtonElement>(`[data-step="${type}"]`).forEach((button) => {
      button.disabled = Number(button.dataset.delta) < 0 ? count <= 0 : count >= MAX_ENEMIES_PER_TYPE;
    });
    const total = waveEnemyTotal(settings.waves[this.selected].enemies);
    const levelTotal = this.root.querySelector('[data-level-total]');
    if (levelTotal) {
      levelTotal.textContent = `${total}`;
    }
    const tabTotal = this.root.querySelector(`[data-tab-total="${this.selected}"]`);
    if (tabTotal) {
      tabTotal.textContent = `${total} ${total === 1 ? 'enemy' : 'enemies'}`;
    }
  }

  private readHealth(): void {
    const settings = this.settings;
    if (!settings) {
      return;
    }
    const value = (selector: string, fallback: number): number => {
      const input = this.root.querySelector<HTMLInputElement>(selector);
      return input && input.value !== '' ? Number(input.value) : fallback;
    };
    this.settings = {
      ...settings,
      bowmanHealth: value('[data-bowman-health]', settings.bowmanHealth),
      keepHealth: value('[data-keep-health]', settings.keepHealth),
    };
    this.emit();
  }

  private emit(): void {
    if (this.settings) {
      this.callbacks.change(this.settings, this.selected);
    }
  }
}
