import { BATTLEGROUNDS, BATTLEGROUND_IDS, type BattlegroundId } from '../data/battlegrounds';
import { ENEMY_GROUPS, ENEMY_GROUP_IDS, enemyTypesOf } from '../data/enemyKinds';
import {
  ENEMY_TYPE_LABELS,
  HEALTH_LIMITS,
  MAX_ENEMIES_PER_TYPE,
  MAX_LEVELS,
  MIN_LEVELS,
  levelEnemyTotal,
  type SandboxSettings,
  type LevelSetup,
} from '../data/sandbox';
import type { EnemyType } from '../types';
import { ICON_BOWMAN, ICON_ENEMIES, ICON_KEEP } from './icons';
import { mapThumbnail } from './mapThumbnail';
import { panelTop, renderPanel } from './panelLayout';
import { editQuiverIn } from './quiverEditing';
import { quiverPage, type PartnerQuiver } from './quiverPage';

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
 * with − / +). Quiver: which arrow goes in each weapon slot (`quiverPage`). Back and Start sit in the top bar, the
 * pages and bowman and keep health under it; only the page scrolls (SandboxSettings.levels; a level's enemies then come in waves, systems/waveDirector).
 */
export class SandboxForm {
  private settings?: SandboxSettings;
  /** The level being edited. */
  private selected = 0;
  private page: SandboxPage = 'levels';
  /** The quiver slot the next picked arrow goes into. */
  private selectedSlot = 0;
  /** Co-op: the partner's quiver, shown (not editable) on the Quiver page. */
  private partner?: PartnerQuiver;

  public constructor(private readonly root: HTMLElement, private readonly callbacks: SandboxFormCallbacks) {
    root.addEventListener('input', (event) => {
      if ((event.target as HTMLElement).matches('[data-bowman-health], [data-keep-health]')) {
        this.readHealth();
      }
    });
    root.addEventListener('click', (event) => this.onClick(event.target as HTMLElement));
    editQuiverIn(
      root,
      () => (this.settings && this.page === 'quiver' ? { loadout: this.settings.loadout, slot: this.selectedSlot } : undefined),
      ({ loadout, slot, changed }) => {
        this.selectedSlot = slot;
        if (changed) {
          this.update({ ...this.settings!, loadout }, this.selected);
        } else {
          this.render(this.settings!);
        }
      },
    );
  }

  /** Co-op: the partner's quiver to show next to the player's own (undefined alone); redraws if it's open. */
  public setPartner(partner: PartnerQuiver | undefined): void {
    this.partner = partner;
    if (this.settings && this.page === 'quiver') {
      this.render(this.settings);
    }
  }

  public render(settings: SandboxSettings): void {
    this.settings = settings;
    this.selected = Math.min(this.selected, settings.levelCount - 1);
    const numberInput = (attribute: string, value: number, limits: { min: number; max: number; step: number }): string =>
      `<input type="number" ${attribute} value="${value}" min="${limits.min}" max="${limits.max}" step="${limits.step}">`;

    renderPanel(this.root, `
      ${panelTop(
    '<button class="secondary-button small-button" data-sandbox-back>← Back</button>',
    'Battle setup',
    '<button class="primary-button" data-sandbox-start>Start battle</button>',
    'Sandbox',
  )}
      <div class="sandbox-head">
        <div class="sandbox-pages" role="tablist" aria-label="Setup pages">
          ${PAGES.map(({ id, label }) => `<button type="button" class="sandbox-page${id === this.page ? ' active' : ''}" role="tab" aria-selected="${id === this.page}" data-page="${id}">${label}</button>`).join('')}
        </div>
        <div class="sandbox-health">
          <label class="health-field" title="Bowman health">${ICON_BOWMAN}<span>Bowman</span>${numberInput('data-bowman-health', settings.bowmanHealth, HEALTH_LIMITS.bowman)}</label>
          <label class="health-field" title="Keep health">${ICON_KEEP}<span>Keep</span>${numberInput('data-keep-health', settings.keepHealth, HEALTH_LIMITS.keep)}</label>
        </div>
      </div>
      <div class="panel-body">
        ${this.page === 'levels' ? this.levelsPage(settings) : quiverPage(settings.loadout, this.selectedSlot, this.partner)}
      </div>`);
  }

  private levelsPage(settings: SandboxSettings): string {
    const level = settings.levels[this.selected];
    return `
      <div class="level-tabs" role="tablist" aria-label="Levels">
        ${settings.levels.slice(0, settings.levelCount).map((level, index) => this.levelTab(level, index)).join('')}
        ${settings.levelCount < MAX_LEVELS ? '<button type="button" class="level-add" data-level-add>+ Add level</button>' : ''}
      </div>
      <div class="level-editor">
        <div class="level-editor-head">
          <div class="sandbox-section-label">Level ${this.selected + 1} · Battleground</div>
          ${settings.levelCount > MIN_LEVELS ? '<button type="button" class="level-remove" data-level-remove>Remove level</button>' : ''}
        </div>
        <div class="map-cards">
          ${BATTLEGROUND_IDS.map((id) => `<button type="button" class="map-card${id === level.battleground ? ' active' : ''}" data-map="${id}" aria-pressed="${id === level.battleground}">
            ${mapThumbnail(BATTLEGROUNDS[id])}<span>${BATTLEGROUNDS[id].name}</span></button>`).join('')}
        </div>
        <div class="sandbox-section-label">Enemies <span data-level-total>${levelEnemyTotal(level.enemies)}</span></div>
        ${ENEMY_GROUP_IDS.map((group) => `<div class="enemy-group-label">${ENEMY_GROUPS[group].label}</div>
        <div class="enemy-cards">
          ${enemyTypesOf(group).map((type) => this.enemyCard(type, level.enemies[type])).join('')}
        </div>`).join('')}
      </div>`;
  }

  private levelTab(level: LevelSetup, index: number): string {
    const active = index === this.selected;
    const total = levelEnemyTotal(level.enemies);
    return `<button type="button" class="level-tab${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-level="${index}" title="${BATTLEGROUNDS[level.battleground].name}">
      ${mapThumbnail(BATTLEGROUNDS[level.battleground])}
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
    // (The quiver's own clicks are editQuiverIn's.)
    if (page) {
      this.page = page.dataset.page as SandboxPage;
      this.render(settings);
    } else if (tab) {
      this.selected = Number(tab.dataset.level);
      this.render(settings);
      this.emit();
    } else if (target.closest('[data-level-add]') && settings.levelCount < MAX_LEVELS) {
      // The new level is the next stored one (it keeps whatever it was last set up with).
      this.update({ ...settings, levelCount: settings.levelCount + 1 }, settings.levelCount);
    } else if (target.closest('[data-level-remove]') && settings.levelCount > MIN_LEVELS) {
      // Later levels move up; the removed one goes to the end, out of the run.
      const levels = [...settings.levels];
      const [removed] = levels.splice(this.selected, 1);
      levels.push(removed);
      this.update({ ...settings, levels, levelCount: settings.levelCount - 1 }, Math.max(0, this.selected - 1));
    } else if (map) {
      this.update(this.withLevel(settings, { battleground: map.dataset.map as BattlegroundId }), this.selected);
    } else if (step) {
      const type = step.dataset.step as EnemyType;
      const level = settings.levels[this.selected];
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

  private withLevel(settings: SandboxSettings, change: Partial<LevelSetup>): SandboxSettings {
    return { ...settings, levels: settings.levels.map((level, index) => (index === this.selected ? { ...level, ...change } : level)) };
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
    const total = levelEnemyTotal(settings.levels[this.selected].enemies);
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
