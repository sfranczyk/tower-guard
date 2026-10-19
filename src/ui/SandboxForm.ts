import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS, isDifficultyLevel } from '../data/difficulty';
import { BATTLEGROUNDS, type BattlegroundId } from '../data/battlegrounds';
import { ENEMY_GROUPS, ENEMY_GROUP_IDS, enemyTypesOf } from '../data/enemyKinds';
import {
  ENEMY_TYPE_LABELS,
  HEALTH_LIMITS,
  MAX_ENEMIES_PER_TYPE,
  MAX_LEVELS,
  MIN_LEVELS,
  RUN_MODES,
  RUN_MODE_DESCRIPTIONS,
  RUN_MODE_LABELS,
  SURVIVAL_MINUTES,
  battlegroundsFor,
  levelEnemyTotal,
  runBattleground,
  runLevelCount,
  supportAllowed,
  type RunMode,
  type SandboxSettings,
  type LevelSetup,
  type SurvivalLevel,
} from '../data/sandbox';
import type { EnemyType } from '../types';
import { ICON_BOWMAN, ICON_ENEMIES, ICON_KEEP } from './icons';
import { mapThumbnail } from './mapThumbnail';
import { panelTop, renderPanel } from './panelLayout';
import { editQuiverIn } from './quiverEditing';
import { quiverPage, type PartnerQuiver } from './quiverPage';
import { survivalEditor, survivalTabText } from './survivalEditor';

/** The form's pages: the levels (maps and enemies), the rules (health, difficulty, banners, support) and the quiver. */
type SandboxPage = 'levels' | 'rules' | 'quiver';
const PAGES: ReadonlyArray<{ id: SandboxPage; label: string }> = [
  { id: 'levels', label: 'Levels' },
  { id: 'rules', label: 'Rules' },
  { id: 'quiver', label: 'Quiver' },
];

export interface SandboxFormCallbacks {
  /** `level` is the level being edited (its battleground is previewed behind the form). */
  change(settings: SandboxSettings, level: number): void;
  start(): void;
  back(): void;
}

/**
 * The sandbox setup form. It opens on the mode picker (Battle or Survival, two big cards); then three pages. Levels: the run is a row of levels (tabs, each with its map and enemy
 * count, plus add and remove); below, the selected level's battleground (map cards) and enemies (a card per type
 * with − / +). Rules: health, difficulty, banners, support, one per row. Quiver: which arrow goes in each weapon slot
 * (`quiverPage`). Back (to the mode picker) and Start sit in the top bar, the pages under it; only the page scrolls (SandboxSettings.levels; a level's enemies then come in waves, systems/waveDirector).
 */
export class SandboxForm {
  private settings?: SandboxSettings;
  /** The level being edited. */
  private selected = 0;
  /** The mode picker first, then the setup of the picked mode. */
  private step: 'mode' | 'setup' = 'mode';
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

  /** Shows the form from its start, the mode picker. */
  public open(settings: SandboxSettings): void {
    this.step = 'mode';
    this.page = 'levels';
    this.render(settings);
  }

  /** Back (the button or Esc): from the setup to the mode picker, from there out of the form. */
  public back(): void {
    if (this.step === 'setup' && this.settings) {
      this.step = 'mode';
      this.render(this.settings);
    } else {
      this.callbacks.back();
    }
  }

  public render(settings: SandboxSettings): void {
    this.settings = settings;
    this.selected = Math.min(this.selected, runLevelCount(settings) - 1);
    const back = '<button class="secondary-button small-button" data-sandbox-back>← Back</button>';
    if (this.step === 'mode') {
      renderPanel(this.root, `
        ${panelTop(back, 'Choose a mode', '', 'Sandbox')}
        <div class="panel-body">
          <div class="mode-cards">
            ${RUN_MODES.map((mode) => `<button type="button" class="mode-card" data-pick-mode="${mode}">
              ${mapThumbnail(BATTLEGROUNDS[battlegroundsFor(mode)[0]])}
              <strong>${RUN_MODE_LABELS[mode]}</strong>
              <span>${RUN_MODE_DESCRIPTIONS[mode]}</span>
            </button>`).join('')}
          </div>
        </div>`);
      return;
    }
    renderPanel(this.root, `
      ${panelTop(back, 'Battle setup', '<button class="primary-button" data-sandbox-start>Start battle</button>', RUN_MODE_LABELS[settings.mode])}
      <div class="sandbox-head">
        <div class="sandbox-pages" role="tablist" aria-label="Setup pages">
          ${PAGES.map(({ id, label }) => `<button type="button" class="sandbox-page${id === this.page ? ' active' : ''}" role="tab" aria-selected="${id === this.page}" data-page="${id}">${label}</button>`).join('')}
        </div>
      </div>
      <div class="panel-body">
        ${this.page === 'levels' ? this.levelsPage(settings) : this.page === 'rules' ? this.rulesPage(settings) : quiverPage(settings.loadout, this.selectedSlot, this.partner)}
      </div>`);
  }

  /** The run's rules, one per row: health, difficulty, banners (battle) and support (battle; survival never has it). */
  private rulesPage(settings: SandboxSettings): string {
    const survival = settings.mode === 'survival';
    const numberInput = (attribute: string, value: number, limits: { min: number; max: number; step: number }): string =>
      `<input type="number" ${attribute} value="${value}" min="${limits.min}" max="${limits.max}" step="${limits.step}">`;
    const choice = <T>(name: string, attribute: string, values: readonly T[], current: T, label: (value: T) => string, disabled = false): string =>
      `<div class="segmented" role="radiogroup" aria-label="${name}">
        ${values.map((value) => `<button type="button" class="chip-button${value === current ? ' active' : ''}" role="radio" aria-checked="${value === current}" ${attribute}="${value}"${disabled ? ' disabled' : ''}>${label(value)}</button>`).join('')}
      </div>`;
    const onOff = (on: boolean): string => (on ? 'On' : 'Off');
    // Only a number field's row is a <label>: a label round the chips would press the first one on any click in the row.
    const row = (label: string, hint: string, control: string, icon = ''): string => {
      const tag = control.startsWith('<input') ? 'label' : 'div';
      return `<${tag} class="option-row">${icon}<span><strong>${label}</strong><small>${hint}</small></span>${control}</${tag}>`;
    };
    return `<div class="rules-list">
      ${row('Bowman health', 'Each bowman starts the run with this; it carries over between levels', numberInput('data-bowman-health', settings.bowmanHealth, HEALTH_LIMITS.bowman), ICON_BOWMAN)}
      ${row('Keep health', 'Your keep falls and the run is lost when this runs out', numberInput('data-keep-health', settings.keepHealth, HEALTH_LIMITS.keep), ICON_KEEP)}
      ${row('Difficulty', 'How hard enemies hit and how well their archers aim', choice('Difficulty', 'data-difficulty', DIFFICULTY_LEVELS, settings.difficulty, (level) => DIFFICULTY_LABELS[level]))}
      ${survival ? '' : row('Banners', "Bring the enemy's banner to your keep to win a level; lose yours and the level is lost (solo only)", choice('Banners', 'data-banners', [false, true], settings.banners, onOff))}
      ${row('Support', survival ? 'Survival: you hold the night alone' : 'Summon squires, knights and medics to fight beside you (solo only)',
    choice('Support', 'data-support', [false, true], supportAllowed(settings), onOff, survival))}
    </div>`;
  }

  /** The selected level's map, enemies (battle: counts; survival: time and kinds, ui/survivalEditor.ts) and the level tabs. */
  private levelsPage(settings: SandboxSettings): string {
    const count = runLevelCount(settings);
    const battleground = runBattleground(settings, this.selected);
    const maps = battlegroundsFor(settings.mode);
    const level = settings.levels[this.selected];
    return `
      <div class="level-tabs" role="tablist" aria-label="Levels">
        ${Array.from({ length: count }, (_, index) => this.levelTab(settings, index)).join('')}
        ${count < MAX_LEVELS ? '<button type="button" class="level-add" data-level-add>+ Add level</button>' : ''}
      </div>
      <div class="level-editor">
        <div class="level-editor-head">
          <div class="sandbox-section-label">Level ${this.selected + 1} · Battleground</div>
          ${count > MIN_LEVELS ? '<button type="button" class="level-remove" data-level-remove>Remove level</button>' : ''}
        </div>
        <div class="map-cards" style="--maps: ${maps.length}">
          ${maps.map((id) => `<button type="button" class="map-card${id === battleground ? ' active' : ''}" data-map="${id}" aria-pressed="${id === battleground}">
            ${mapThumbnail(BATTLEGROUNDS[id])}<span>${BATTLEGROUNDS[id].name}</span></button>`).join('')}
        </div>
        ${settings.mode === 'survival' ? survivalEditor(settings.survival.levels[this.selected]) : `
        <div class="sandbox-section-label">Enemies <span data-level-total>${levelEnemyTotal(level.enemies)}</span></div>
        ${ENEMY_GROUP_IDS.map((group) => `<div class="enemy-group-label">${ENEMY_GROUPS[group].label}</div>
        <div class="enemy-cards">
          ${enemyTypesOf(group).map((type) => this.enemyCard(type, level.enemies[type])).join('')}
        </div>`).join('')}`}
      </div>`;
  }

  private levelTab(settings: SandboxSettings, index: number): string {
    const active = index === this.selected;
    const battleground = BATTLEGROUNDS[runBattleground(settings, index)];
    const total = levelEnemyTotal(settings.levels[index].enemies);
    const text = settings.mode === 'survival' ? survivalTabText(settings.survival.levels[index]) : `${total} ${total === 1 ? 'enemy' : 'enemies'}`;
    return `<button type="button" class="level-tab${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-level="${index}" title="${battleground.name}">
      ${mapThumbnail(battleground)}
      <span class="level-tab-text"><strong>Level ${index + 1}</strong><small data-tab-total="${index}">${text}</small></span>
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
    const pickMode = target.closest<HTMLElement>('[data-pick-mode]')?.dataset.pickMode as RunMode | undefined;
    const difficulty = target.closest<HTMLElement>('[data-difficulty]')?.dataset.difficulty;
    const kind = target.closest<HTMLButtonElement>('[data-survival-kind]');
    const minutes = target.closest<HTMLButtonElement>('[data-minutes]');
    const survival = settings.mode === 'survival';
    const count = runLevelCount(settings);
    // (The quiver's own clicks are editQuiverIn's.)
    if (pickMode && RUN_MODES.includes(pickMode)) {
      this.step = 'setup';
      this.update({ ...settings, mode: pickMode }, pickMode === settings.mode ? this.selected : 0);
    } else if (page) {
      this.page = page.dataset.page as SandboxPage;
      this.render(settings);
    } else if (tab) {
      this.selected = Number(tab.dataset.level);
      this.render(settings);
      this.emit();
    } else if (target.closest('[data-level-add]') && count < MAX_LEVELS) {
      // The new level is the next stored one (it keeps whatever it was last set up with).
      this.update(survival
        ? { ...settings, survival: { ...settings.survival, levelCount: count + 1 } }
        : { ...settings, levelCount: count + 1 }, count);
    } else if (target.closest('[data-level-remove]') && count > MIN_LEVELS) {
      // Later levels move up; the removed one goes to the end, out of the run.
      const removeSelected = <T>(list: readonly T[]): T[] => {
        const levels = [...list];
        levels.push(...levels.splice(this.selected, 1));
        return levels;
      };
      this.update(survival
        ? { ...settings, survival: { levels: removeSelected(settings.survival.levels), levelCount: count - 1 } }
        : { ...settings, levels: removeSelected(settings.levels), levelCount: count - 1 }, Math.max(0, this.selected - 1));
    } else if (kind && !kind.disabled) {
      const type = kind.dataset.survivalKind as EnemyType;
      const { kinds } = settings.survival.levels[this.selected];
      this.update(this.withSurvivalLevel(settings, { kinds: kinds.includes(type) ? kinds.filter((other) => other !== type) : [...kinds, type] }), this.selected);
    } else if (minutes && !minutes.disabled) {
      const level = settings.survival.levels[this.selected];
      const next = Math.max(SURVIVAL_MINUTES.min, Math.min(SURVIVAL_MINUTES.max, level.minutes + Number(minutes.dataset.minutes)));
      this.update(this.withSurvivalLevel(settings, { minutes: next }), this.selected);
    } else if (isDifficultyLevel(difficulty)) {
      this.update({ ...settings, difficulty }, this.selected);
    } else if (target.closest('[data-banners]')) {
      this.update({ ...settings, banners: target.closest<HTMLElement>('[data-banners]')!.dataset.banners === 'true' }, this.selected);
    } else if (target.closest('[data-support]') && !survival) {
      this.update({ ...settings, support: target.closest<HTMLElement>('[data-support]')!.dataset.support === 'true' }, this.selected);
    } else if (map) {
      const battleground = map.dataset.map as BattlegroundId;
      this.update(survival ? this.withSurvivalLevel(settings, { battleground }) : this.withLevel(settings, { battleground }), this.selected);
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
      this.back();
    }
  }

  private withLevel(settings: SandboxSettings, change: Partial<LevelSetup>): SandboxSettings {
    return { ...settings, levels: settings.levels.map((level, index) => (index === this.selected ? { ...level, ...change } : level)) };
  }

  private withSurvivalLevel(settings: SandboxSettings, change: Partial<SurvivalLevel>): SandboxSettings {
    const levels = settings.survival.levels.map((level, index) => (index === this.selected ? { ...level, ...change } : level));
    return { ...settings, survival: { ...settings.survival, levels } };
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

