/**
 * Live tuning (the `?tune` panel, ui/TuningPanel.ts). A constant becomes tunable by living in a group made with
 * `tunable(...)`: a plain object the game reads at use time (`WAVES.spawnIntervalMs`), so a change in the panel takes
 * effect at once. The registry keeps every group's defaults for the reset buttons, the changed marks, the saved
 * changes and "Copy changes". Pure (no DOM): the storage is passed in.
 */

/** Slider range of one value (missing parts derived from the default, `rangeFor`). */
export interface TuneRange {
  min: number;
  max: number;
  step: number;
}

export interface TuningOptions<K extends string> {
  /** Slider ranges where the derived one doesn't fit. */
  meta?: Partial<Record<K, Partial<TuneRange>>>;
  /** File that declares the group (for "Copy changes"; default src/config.ts). */
  file?: string;
  /**
   * The defaults are built from data elsewhere (e.g. ENEMY_KINDS), so "Copy changes" lists the changed values as
   * comments for that place instead of a declaration to paste.
   */
  derivedFrom?: string;
}

export interface TuningGroup {
  /** The export name in the source (`WAVES`). */
  readonly name: string;
  /** Shown in the panel (`Waves`). */
  readonly title: string;
  readonly values: Record<string, number>;
  readonly defaults: Readonly<Record<string, number>>;
  readonly options: TuningOptions<string>;
}

const groups = new Map<string, TuningGroup>();
const listeners = new Set<() => void>();

/** Registers a group of tunable numbers and returns the live object to read them from. */
export const tunable = <T extends Record<string, number>>(name: string, title: string, values: T, options: TuningOptions<Extract<keyof T, string>> = {}): Readonly<T> => {
  const live = { ...values };
  // Re-registering (hot reload) keeps the values tuned so far.
  const previous = groups.get(name);
  if (previous) {
    Object.keys(live).forEach((key) => {
      if (key in previous.values && previous.values[key] !== previous.defaults[key]) {
        (live as Record<string, number>)[key] = previous.values[key];
      }
    });
  }
  groups.set(name, { name, title, values: live, defaults: Object.freeze({ ...values }), options: options as TuningOptions<string> });
  return live;
};

export const tuningGroups = (): readonly TuningGroup[] => [...groups.values()];

const groupOf = (name: string): TuningGroup | undefined => groups.get(name);

/** The largest 1, 2 or 5 × 10ⁿ not above `x`. */
const niceStep = (x: number): number => {
  const power = 10 ** Math.floor(Math.log10(x) + 1e-9);
  const mantissa = x / power;
  return Number(((mantissa >= 5 - 1e-9 ? 5 : mantissa >= 2 - 1e-9 ? 2 : 1) * power).toPrecision(12));
};

/** A slider range for a default value: 0 to 3× it (from −2× for negatives), steps of about a hundredth of it. */
export const rangeFor = (value: number, given: Partial<TuneRange> = {}): TuneRange => {
  const size = Math.abs(value);
  let range: TuneRange;
  if (size === 0) {
    range = { min: 0, max: 1, step: 0.01 };
  } else if (Number.isInteger(value) && size < 10) {
    range = { min: Math.min(0, value * 3), max: Math.max(value * 3, value + 5), step: 1 };
  } else {
    const step = Number.isInteger(value) ? Math.max(1, niceStep(size / 100)) : niceStep(size / 100);
    range = value < 0 ? { min: value * 3, max: size * 2, step } : { min: 0, max: Number((value * 3).toPrecision(12)), step };
  }
  return { ...range, ...given };
};

export const rangeOf = (group: TuningGroup, key: string): TuneRange => rangeFor(group.defaults[key], group.options.meta?.[key]);

export const isChanged = (group: TuningGroup, key: string): boolean => group.values[key] !== group.defaults[key];

export const changedCount = (group: TuningGroup): number => Object.keys(group.values).filter((key) => isChanged(group, key)).length;

const notify = (): void => listeners.forEach((listener) => listener());

/** Called after every change (set, reset, load). Returns the unsubscribe. */
export const onTuningChange = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setTuned = (name: string, key: string, value: number): void => {
  const group = groupOf(name);
  if (!group || !(key in group.values) || !Number.isFinite(value)) {
    return;
  }
  group.values[key] = value;
  notify();
};

/** Back to the default: one value, a whole group, or (no name) everything. */
export const resetTuned = (name?: string, key?: string): void => {
  const targets = name === undefined ? [...groups.values()] : [groupOf(name)].filter((group): group is TuningGroup => !!group);
  targets.forEach((group) => {
    Object.keys(group.values).forEach((k) => {
      if (key === undefined || k === key) {
        group.values[k] = group.defaults[k];
      }
    });
  });
  notify();
};

/** Changed values only, `{ group: { key: value } }`. */
export const tuningChanges = (): Record<string, Record<string, number>> => {
  const changes: Record<string, Record<string, number>> = {};
  groups.forEach((group) => {
    Object.keys(group.values).filter((key) => isChanged(group, key)).forEach((key) => {
      changes[group.name] = { ...changes[group.name], [key]: group.values[key] };
    });
  });
  return changes;
};

export const TUNING_STORAGE_KEY = 'towerGuard.tuning';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Applies the saved changes (unknown groups, keys and broken entries are skipped). */
export const loadTuning = (storage: KeyValueStorage | undefined): void => {
  try {
    const raw = storage?.getItem(TUNING_STORAGE_KEY);
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== 'object') {
      return;
    }
    Object.entries(saved as Record<string, unknown>).forEach(([name, values]) => {
      const group = groupOf(name);
      if (!group || !values || typeof values !== 'object') {
        return;
      }
      Object.entries(values as Record<string, unknown>).forEach(([key, value]) => {
        if (key in group.values && typeof value === 'number' && Number.isFinite(value)) {
          group.values[key] = value;
        }
      });
    });
    notify();
  } catch {
    // Storage blocked or the entry unreadable: run on the defaults.
  }
};

export const saveTuning = (storage: KeyValueStorage | undefined): void => {
  try {
    const changes = tuningChanges();
    if (Object.keys(changes).length === 0) {
      storage?.removeItem(TUNING_STORAGE_KEY);
    } else {
      storage?.setItem(TUNING_STORAGE_KEY, JSON.stringify(changes));
    }
  } catch {
    // Storage blocked: the changes last until the page is reloaded.
  }
};

/** A number as source: no float noise (0.1 + 0.2), integers as they are. */
export const formatNumber = (value: number): string => String(Number(value.toPrecision(10)));

const formatRange = (range: Partial<TuneRange>): string =>
  `{ ${Object.entries(range).map(([key, value]) => `${key}: ${formatNumber(value as number)}`).join(', ')} }`;

const formatGroup = (group: TuningGroup): string => {
  const file = group.options.file ?? 'src/config.ts';
  const keys = Object.keys(group.values);
  if (group.options.derivedFrom) {
    const lines = keys.filter((key) => isChanged(group, key))
      .map((key) => `//   ${key}: ${formatNumber(group.defaults[key])} → ${formatNumber(group.values[key])}`);
    return [`// ${group.title} (${group.name}, ${file}): set these in ${group.options.derivedFrom}`, ...lines].join('\n');
  }
  const lines = keys.map((key) => {
    const line = `  ${key}: ${formatNumber(group.values[key])},`;
    return isChanged(group, key) ? `${line} // was ${formatNumber(group.defaults[key])}` : line;
  });
  const { meta } = group.options;
  const metaEntries = meta ? Object.entries(meta).filter((entry): entry is [string, Partial<TuneRange>] => !!entry[1]) : [];
  const parts = [
    ...(metaEntries.length > 0 ? [`meta: { ${metaEntries.map(([key, range]) => `${key}: ${formatRange(range)}`).join(', ')} }`] : []),
    ...(group.options.file ? [`file: '${group.options.file}'`] : []),
  ];
  const options = parts.length > 0 ? `, { ${parts.join(', ')} }` : '';
  return [`// ${file}`, `export const ${group.name} = tunable('${group.name}', '${group.title}', {`, ...lines, `}${options});`].join('\n');
};

/** "Copy changes": each changed group as ready-to-paste source (the whole declaration, changed values marked). */
export const formatChanges = (): string =>
  [...groups.values()].filter((group) => changedCount(group) > 0).map(formatGroup).join('\n\n');
