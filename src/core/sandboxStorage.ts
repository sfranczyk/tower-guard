import { normalizeSandbox, type SandboxSettings } from '../data/sandbox';

/** The last sandbox setup is remembered per browser; storage may be unavailable (private mode). */
const STORAGE_KEY = 'tower-guard.sandbox';

export const loadSandbox = (): SandboxSettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeSandbox(raw ? (JSON.parse(raw) as Partial<SandboxSettings>) : undefined);
  } catch {
    return normalizeSandbox(undefined);
  }
};

export const saveSandbox = (settings: SandboxSettings): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not critical: the setup just won't be remembered.
  }
};
