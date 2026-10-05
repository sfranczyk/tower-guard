/** Small helpers for state kept in the URL query (survives refresh, can be shared as a link). */

export const getUrlParam = (name: string): string | null => new URLSearchParams(window.location.search).get(name);

/** Sets (or removes, with null) a query parameter without reloading or adding a history entry. */
export const setUrlParam = (name: string, value: string | null): void => {
  const url = new URL(window.location.href);
  if (value === null) {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  window.history.replaceState(null, '', url);
};

/** Query parameter holding the animation lab state: present = lab open, value = zoomed animation id. */
export const LAB_PARAM = 'lab';

/** Query parameter that opens the sound test panel (?sounds). */
export const SOUND_LAB_PARAM = 'sounds';
