import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS, isDifficultyLevel } from '../data/difficulty';
import { BATTLEGROUNDS, type BattlegroundId } from '../data/battlegrounds';
import { ENEMY_GROUPS, ENEMY_GROUP_IDS, enemyTypesOf } from '../data/enemyKinds';
import {
  ENEMY_TYPE_LABELS,
  HEALTH_LIMITS,
  MAX_ENEMIES_PER_TYPE,
  MIN_LEVELS,
  RUN_MODES,
  RUN_MODE_DESCRIPTIONS,
  RUN_MODE_LABELS,
  SURVIVAL_MINUTES,
  battlegroundsFor,
  friendlyFireOn,
  levelEnemyTotal,
  maxLevelsFor,
  runBattleground,
  runLevelCount,
  supportAllowed,
  type RunMode,
  type SandboxSettings,
  type LevelSetup,
  type SurvivalLevel,
  withFriendlyFire,
} from '../data/sandbox';
import type { EnemyType } from '../types';
import { ICON_BANNERS, ICON_BOWMAN, ICON_DIFFICULTY, ICON_ENEMIES, ICON_FRIENDLY_FIRE, ICON_KEEP, ICON_SUPPORT, ICON_TRASH } from './icons';
import { mapThumbnail, splitThumbnail, squareThumbnail } from './mapThumbnail';
import { modeCards } from './modeCards';
import { numberInput, optionRow } from './optionRows';
import { panelTop, renderPanel } from './panelLayout';
import { editQuiverIn } from './quiverEditing';
import { quiverPage, type PartnerQuiver } from './quiverPage';
import { survivalEditor, survivalTabText } from './survivalEditor';

/** The form's pages: the rules (health, difficulty, friendly fire, banners, support), the levels (maps and enemies) and the quiver. */
type SandboxPage = 'levels' | 'rules' | 'quiver';
const PAGES: ReadonlyArray<{ id: SandboxPage; label: string }> = [
  { id: 'rules', label: 'Rules' },
  { id: 'levels', label: 'Levels' },
  { id: 'quiver', label: 'Quiver' },
];
/** The top bar's primary button walks the pages in order (Rules → Levels → Quiver); on the last it starts the battle. */
const NEXT_PAGE: Partial<Record<SandboxPage, { page: SandboxPage; label: string }>> = {
  rules: { page: 'levels', label: 'Level setup' },
  levels: { page: 'quiver', label: 'Quiver setup' },
};

export interface SandboxFormCallbacks {
  /** `level` is the level being edited (its battleground is previewed behind the form). */
  change(settings: SandboxSettings, level: number): void;
  start(): void;
  back(): void;
  /** The mode picker's third card: a MOBA match alone (single player only). */
  mobaPractice(): void;
}

const MOBA_PRACTICE_TEXT = 'Blue against red on one lane, you alone with your minions against the red ones and their keep. Gold buys upgrades by your keep (press I); day turns to night.';

/**
 * The sandbox setup form. It opens on the mode picker (Battle, Survival or MOBA practice, three big cards; a co-op host
 * picked the mode with the room and skips it); then three pages. Rules:
 * health, difficulty, friendly fire, banners, support, one per row. Levels: the run is a row of levels (tabs, each with its map and enemy
 * count, plus add and remove); below, the selected level's battleground (map cards) and enemies (a card per type
 * with − / +). Quiver: which arrow goes in each weapon slot
 * (`quiverPage`). Back (to the mode picker) and the next-page button (Start on the last page) sit in the top bar, the pages under it; only the page scrolls (SandboxSettings.levels; a level's enemies then come in waves, systems/waveDirector).
 */
export class SandboxForm {
  private settings?: SandboxSettings;
  /** The level being edited. */
  private selected = 0;
  /** The mode picker first, then the setup of the picked mode ("more": the Additional modes list, from the picker). */
  private step: 'mode' | 'more' | 'setup' = 'mode';
  private page: SandboxPage = 'rules';
  /** Played by more than one bowman: friendly fire is the co-op setting (`friendlyFireOn`). */
  private multiplayer = false;
  /** The level whose removal waits for the player's confirmation (the dialog over the form). */
  private confirmRemove?: number;
  /** The quiver slot the next picked arrow goes into. */
  private selectedSlot = 0;
  /** Co-op: the other players' quivers, shown (not editable) on the Quiver page. */
  private partners?: PartnerQuiver[];

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

  /** Co-op: the other players' quivers to show next to the player's own (undefined alone); redraws if it's open. */
  public setPartners(partners: PartnerQuiver[] | undefined): void {
    this.partners = partners;
    if (this.settings && this.page === 'quiver') {
      this.render(this.settings);
    }
  }

  /** Shows the form from its start: the mode picker, or for a co-op host (who picked the mode with the room) the setup. */
  public open(settings: SandboxSettings, multiplayer: boolean): void {
    this.step = multiplayer ? 'setup' : 'mode';
    this.confirmRemove = undefined;
    this.page = 'rules';
    this.multiplayer = multiplayer;
    this.render(settings);
  }

  /** Back (the button or Esc): from the setup to the mode picker, from there out of the form. */
  public back(): void {
    if (this.confirmRemove !== undefined && this.settings) {
      this.confirmRemove = undefined;
      this.render(this.settings);
    } else if ((this.step === 'setup' && !this.multiplayer || this.step === 'more') && this.settings) {
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
          ${modeCards(RUN_MODES.map((mode) => ({
            attribute: `data-pick-mode="${mode}"`,
            thumbnail: squareThumbnail(BATTLEGROUNDS[battlegroundsFor(mode)[0]]),
            label: RUN_MODE_LABELS[mode],
            text: RUN_MODE_DESCRIPTIONS[mode],
          })), '<div class="mode-footer"><button type="button" class="secondary-button" data-more-modes>Additional modes</button></div>')}
        </div>`);
      return;
    }
    if (this.step === 'more') {
      renderPanel(this.root, `
        ${panelTop(back, 'Additional modes', '', 'Sandbox')}
        <div class="panel-body">
          <div class="mode-list">
            <button type="button" class="mode-list-item" data-pick-moba>
              ${splitThumbnail(BATTLEGROUNDS[battlegroundsFor('battle')[0]], BATTLEGROUNDS[battlegroundsFor('survival')[0]])}
              <span><strong>MOBA Practice Mode</strong><span>${MOBA_PRACTICE_TEXT}</span></span>
            </button>
          </div>
        </div>`);
      return;
    }
    const next = NEXT_PAGE[this.page];
    const primary = next
      ? `<button class="primary-button" data-page="${next.page}">${next.label}</button>`
      : '<button class="primary-button" data-sandbox-start>Start battle</button>';
    renderPanel(this.root, `
      ${panelTop(back, 'Battle setup', primary, RUN_MODE_LABELS[settings.mode])}
      <div class="sandbox-head">
        <div class="sandbox-pages" role="tablist" aria-label="Setup pages">
          ${PAGES.map(({ id, label }) => `<button type="button" class="sandbox-page${id === this.page ? ' active' : ''}" role="tab" aria-selected="${id === this.page}" data-page="${id}">${label}</button>`).join('')}
        </div>
      </div>
      <div class="panel-body">
        ${this.page === 'levels' ? this.levelsPage(settings) : this.page === 'rules' ? this.rulesPage(settings) : quiverPage(settings.loadout, this.selectedSlot, this.partners)}
      </div>
      ${this.confirmRemove !== undefined ? this.removeDialog(settings, this.confirmRemove) : ''}`);
  }

  /** "Remove level N?" with what goes with it (its map and enemies or night), over the form. */
  private removeDialog(settings: SandboxSettings, index: number): string {
    const map = BATTLEGROUNDS[runBattleground(settings, index)].name;
    const survival = settings.mode === 'survival';
    const total = levelEnemyTotal(settings.levels[index].enemies);
    const what = survival ? `${map}, ${survivalTabText(settings.survival.levels[index])}` : `${map}, ${total} ${total === 1 ? 'enemy' : 'enemies'}`;
    return `<div class="confirm-overlay" data-remove-backdrop>
      <div class="confirm-card" role="alertdialog" aria-labelledby="remove-title">
        <h3 id="remove-title">Remove level ${index + 1}?</h3>
        <p>Its setup (${what}) will be lost; the levels after it move up.</p>
        <div class="confirm-actions">
          <button type="button" class="secondary-button" data-remove-cancel>Cancel</button>
          <button type="button" class="primary-button danger-button" data-remove-confirm>${ICON_TRASH} Remove</button>
        </div>
      </div>
    </div>`;
  }

  /** The run's rules, one per row: health, difficulty, friendly fire, banners (battle) and support (battle; survival never has it). */
  private rulesPage(settings: SandboxSettings): string {
    const survival = settings.mode === 'survival';
    const choice = <T>(name: string, attribute: string, values: readonly T[], current: T, label: (value: T) => string, disabled = false): string =>
      `<div class="segmented" role="radiogroup" aria-label="${name}">
        ${values.map((value) => `<button type="button" class="chip-button${value === current ? ' active' : ''}" role="radio" aria-checked="${value === current}" ${attribute}="${value}"${disabled ? ' disabled' : ''}>${label(value)}</button>`).join('')}
      </div>`;
    const onOff = (on: boolean): string => (on ? 'On' : 'Off');
    const row = optionRow;
    return `<div class="rules-list">
      ${row('Bowman health', 'Each bowman starts the run with this; it carries over between levels', numberInput('data-bowman-health', settings.bowmanHealth, HEALTH_LIMITS.bowman), ICON_BOWMAN)}
      ${row('Keep health', 'Your keep falls and the run is lost when this runs out', numberInput('data-keep-health', settings.keepHealth, HEALTH_LIMITS.keep), ICON_KEEP)}
      ${row('Difficulty', 'How hard enemies hit and how well their archers aim', choice('Difficulty', 'data-difficulty', DIFFICULTY_LEVELS, settings.difficulty, (level) => DIFFICULTY_LABELS[level]), ICON_DIFFICULTY)}
      ${row('Friendly fire', 'Your arrows and what they do (blasts, fire, frost, vortices, pins) hit your own side too',
    choice('Friendly fire', 'data-friendly-fire', [false, true], friendlyFireOn(settings, this.multiplayer), onOff), ICON_FRIENDLY_FIRE)}
      ${survival ? '' : row('Banners', "Bring the enemy's banner to your keep to win a level; lose yours and the level is lost (solo only)", choice('Banners', 'data-banners', [false, true], settings.banners, onOff), ICON_BANNERS.player)}
      ${row('Support', survival ? 'Survival: you hold the night alone' : 'Summon squires, knights and medics to fight beside you (solo only)',
    choice('Support', 'data-support', [false, true], supportAllowed(settings), onOff, survival), ICON_SUPPORT)}
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
        ${count < maxLevelsFor(settings.mode) ? '<button type="button" class="level-add" data-level-add>+ Add level</button>' : ''}
      </div>
      <div class="level-editor">
        <div class="level-editor-head">
          <div class="sandbox-section-label">Level ${this.selected + 1} · Battleground</div>
          ${count > MIN_LEVELS ? `<button type="button" class="level-remove" data-level-remove="${this.selected}">Remove level ${this.selected + 1}</button>` : ''}
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
    if (target.closest('[data-pick-moba]')) {
      this.callbacks.mobaPractice();
      return;
    }
    if (target.closest('[data-more-modes]')) {
      this.step = 'more';
      this.render(settings);
      return;
    }
    // (The quiver's own clicks are editQuiverIn's.)
    const removeAsk = target.closest<HTMLElement>('[data-level-remove]');
    if (this.confirmRemove !== undefined) {
      // The dialog is open: only its buttons (and the backdrop, as Cancel) do anything.
      const index = this.confirmRemove;
      if (target.closest('[data-remove-confirm]')) {
        this.confirmRemove = undefined;
        this.removeLevel(settings, index);
      } else if (target.closest('[data-remove-cancel]') || target.matches('[data-remove-backdrop]')) {
        this.confirmRemove = undefined;
        this.render(settings);
      }
      return;
    }
    if (removeAsk && count > MIN_LEVELS) {
      this.confirmRemove = Number(removeAsk.dataset.levelRemove);
      this.render(settings);
    } else if (pickMode && RUN_MODES.includes(pickMode)) {
      this.step = 'setup';
      this.update({ ...settings, mode: pickMode }, pickMode === settings.mode ? this.selected : 0);
    } else if (page) {
      this.page = page.dataset.page as SandboxPage;
      this.render(settings);
    } else if (tab) {
      this.selected = Number(tab.dataset.level);
      this.render(settings);
      this.emit();
    } else if (target.closest('[data-level-add]') && count < maxLevelsFor(settings.mode)) {
      // The new level is the next stored one (it keeps whatever it was last set up with).
      this.update(survival
        ? { ...settings, survival: { ...settings.survival, levelCount: count + 1 } }
        : { ...settings, levelCount: count + 1 }, count);
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
    } else if (target.closest('[data-friendly-fire]')) {
      this.update(withFriendlyFire(settings, this.multiplayer, target.closest<HTMLElement>('[data-friendly-fire]')!.dataset.friendlyFire === 'true'), this.selected);
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

  /** Later levels move up; the removed one goes to the end, out of the run (it keeps its setup if added back). */
  private removeLevel(settings: SandboxSettings, index: number): void {
    const count = runLevelCount(settings);
    if (count <= MIN_LEVELS) {
      return;
    }
    const removeAt = <T>(list: readonly T[]): T[] => {
      const levels = [...list];
      levels.push(...levels.splice(index, 1));
      return levels;
    };
    const selected = index < this.selected || this.selected === count - 1 ? Math.max(0, this.selected - 1) : this.selected;
    this.update(settings.mode === 'survival'
      ? { ...settings, survival: { levels: removeAt(settings.survival.levels), levelCount: count - 1 } }
      : { ...settings, levels: removeAt(settings.levels), levelCount: count - 1 }, selected);
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

