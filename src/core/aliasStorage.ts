import { normalizeAlias } from '../data/playerAlias';

/** This browser's alias for online rooms (the lobby's "Your name" field), kept between visits. */
const STORAGE_KEY = 'towerGuard.alias';

export const loadAlias = (): string => {
  try {
    return normalizeAlias(localStorage.getItem(STORAGE_KEY) ?? '');
  } catch {
    return '';
  }
};

export const saveAlias = (alias: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeAlias(alias));
  } catch {
    // Not kept (private window, blocked storage): it holds for this visit.
  }
};
