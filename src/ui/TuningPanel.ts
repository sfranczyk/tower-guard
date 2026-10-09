import {
  changedCount, formatChanges, formatNumber, isChanged, loadTuning, onTuningChange, rangeOf, resetTuned, saveTuning, setTuned, tuningGroups,
  type TuningGroup,
} from '../core/tuning';

const SAVE_DELAY_MS = 250;

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

interface Row {
  group: TuningGroup;
  key: string;
  element: HTMLElement;
  slider: HTMLInputElement;
  number: HTMLInputElement;
}

/**
 * The dev tuning panel (`?tune`, menu → Dev tools): a collapsible side panel over the canvas's right edge with every
 * `tunable` group (core/tuning.ts), a slider and number per value, reset per value and group, changed marks, and
 * "Copy changes". Changes apply live and are saved in localStorage.
 */
export class TuningPanel {
  public readonly element: HTMLElement;
  private readonly body: HTMLElement;
  private readonly output: HTMLTextAreaElement;
  private readonly rows: Row[] = [];
  private readonly groupCounts = new Map<string, HTMLElement>();
  private saveTimer = 0;

  public constructor() {
    this.element = document.createElement('aside');
    this.element.className = 'tuning-panel';
    this.element.hidden = true;
    this.element.innerHTML = `
      <button class="tuning-tab" data-tune-expand aria-label="Expand tuning panel">‹ Tune</button>
      <div class="tuning-header">
        <h2>Tuning</h2>
        <button class="round-button" data-tune-close aria-label="Collapse tuning panel" title="Collapse">›</button>
      </div>
      <p class="tuning-note">Local only. In co-op the host's values drive the game.</p>
      <div class="tuning-actions">
        <button class="secondary-button small-button" data-tune-copy>Copy changes</button>
        <button class="secondary-button small-button" data-tune-reset-all>Reset all</button>
      </div>
      <textarea class="tuning-output" data-tune-output readonly hidden></textarea>
      <div class="tuning-body" data-tune-body></div>`;
    this.body = this.element.querySelector<HTMLElement>('[data-tune-body]')!;
    this.output = this.element.querySelector<HTMLTextAreaElement>('[data-tune-output]')!;
    this.element.querySelector('[data-tune-close]')!.addEventListener('click', () => this.element.classList.add('collapsed'));
    this.element.querySelector('[data-tune-expand]')!.addEventListener('click', () => this.element.classList.remove('collapsed'));
    this.element.querySelector('[data-tune-copy]')!.addEventListener('click', () => void this.copyChanges());
    this.element.querySelector('[data-tune-reset-all]')!.addEventListener('click', () => resetTuned());
    // Typing into a field mustn't move, shoot or switch weapons.
    ['keydown', 'keyup'].forEach((type) => this.element.addEventListener(type, (event) => event.stopPropagation()));
    // The saved changes apply at boot (DomUi builds the panel before any scene starts), open or not.
    loadTuning(storage());
    tuningGroups().forEach((group) => this.addGroup(group));
    onTuningChange(() => this.refresh());
  }

  public get isOpen(): boolean {
    return !this.element.hidden;
  }

  /** Shows (expanded) or removes the panel; its own button only collapses it to a tab. */
  public setOpen(open: boolean): void {
    this.element.hidden = !open;
    this.element.classList.remove('collapsed');
    if (open) {
      this.refresh();
    }
  }

  private addGroup(group: TuningGroup): void {
    const section = document.createElement('details');
    section.className = 'tuning-group';
    section.innerHTML = `<summary><span>${escapeHtml(group.title)}</span><span class="tuning-count" data-count></span>
      <button class="chip-button" data-group-reset title="Reset ${escapeHtml(group.title)}">Reset</button></summary>`;
    this.groupCounts.set(group.name, section.querySelector<HTMLElement>('[data-count]')!);
    section.querySelector('[data-group-reset]')!.addEventListener('click', (event) => {
      event.preventDefault();
      resetTuned(group.name);
    });
    Object.keys(group.values).forEach((key) => section.append(this.createRow(group, key)));
    this.body.append(section);
  }

  private createRow(group: TuningGroup, key: string): HTMLElement {
    const { min, max, step } = rangeOf(group, key);
    const element = document.createElement('div');
    element.className = 'tuning-row';
    element.innerHTML = `
      <span class="tuning-dot" aria-hidden="true"></span>
      <label class="tuning-label" title="${escapeHtml(`${group.name}.${key}`)}">${escapeHtml(key)}</label>
      <input type="range" min="${min}" max="${max}" step="${step}" data-slider aria-label="${escapeHtml(key)}">
      <input type="number" step="${step}" data-number aria-label="${escapeHtml(key)} value">
      <button class="tuning-reset" data-reset title="Reset to ${formatNumber(group.defaults[key])}" aria-label="Reset ${escapeHtml(key)}">↺</button>`;
    const slider = element.querySelector<HTMLInputElement>('[data-slider]')!;
    const number = element.querySelector<HTMLInputElement>('[data-number]')!;
    slider.addEventListener('input', () => this.change(group, key, slider.valueAsNumber));
    number.addEventListener('change', () => this.change(group, key, number.valueAsNumber));
    element.querySelector('[data-reset]')!.addEventListener('click', () => resetTuned(group.name, key));
    this.rows.push({ group, key, element, slider, number });
    return element;
  }

  private change(group: TuningGroup, key: string, value: number): void {
    if (Number.isFinite(value)) {
      setTuned(group.name, key, value);
    }
  }

  private refresh(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => saveTuning(storage()), SAVE_DELAY_MS);
    if (this.element.hidden) {
      return;
    }
    this.rows.forEach(({ group, key, element, slider, number }) => {
      const value = group.values[key];
      element.classList.toggle('changed', isChanged(group, key));
      if (slider.valueAsNumber !== value) {
        slider.value = String(value);
      }
      if (document.activeElement !== number) {
        number.value = formatNumber(value);
      }
    });
    tuningGroups().forEach((group) => {
      const count = changedCount(group);
      const label = this.groupCounts.get(group.name);
      if (label) {
        label.textContent = count > 0 ? `${count} changed` : '';
      }
    });
  }

  private async copyChanges(): Promise<void> {
    const text = formatChanges() || '// No changes: every value is at its default.';
    this.output.value = text;
    this.output.hidden = false;
    this.output.select();
    try {
      await navigator.clipboard.writeText(text);
      this.output.title = 'Copied to the clipboard';
    } catch {
      this.output.title = 'Select and copy';
    }
  }
}
