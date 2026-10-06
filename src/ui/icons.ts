/** Small flat SVG icons for the HTML UI, drawn in the same style as the keeps and the landscape. */

export const ICON_KEEP = `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true">
  <rect x="7" y="9" width="14" height="16" rx="2" fill="#a79f92"/><rect x="16" y="9" width="5" height="16" rx="2" fill="#8c8478"/>
  <rect x="5" y="5" width="4" height="5" rx="1" fill="#bdb6aa"/><rect x="12" y="5" width="4" height="5" rx="1" fill="#bdb6aa"/>
  <rect x="19" y="5" width="4" height="5" rx="1" fill="#bdb6aa"/><path d="M11 25v-6a3 3 0 0 1 6 0v6z" fill="#6b4a2e"/></svg>`;

export const ICON_BOWMAN = `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true">
  <path d="M6 25c0-6 3-10 8-10s8 4 8 10z" fill="#3a4250"/><circle cx="14" cy="10" r="6" fill="#2b3038"/>
  <path d="M8.5 10a5.5 5.5 0 0 1 11 0z" fill="#4a5568"/>
  <path d="M21 4c4 5 4 13 0 18" fill="none" stroke="#8a6238" stroke-width="2" stroke-linecap="round"/></svg>`;

export const ICON_WAVE = `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true">
  <rect x="7" y="4" width="2.5" height="21" rx="1.2" fill="#5a3c23"/><path d="M9.5 5h12l-3 4 3 4h-12z" fill="#d8614f"/></svg>`;

export const ICON_GEAR = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor"
  d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 4.6.1-1.1-.1-1.1 2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.9-1.1L15.7 3h-4l-.4 2.7a8 8 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.6L7 12l.1 1.1-2 1.6 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.8h4l.4-2.8c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4z"/></svg>`;

/** An enemy pip in the wave progress: dark while alive, faded once defeated (via CSS). */
export const ICON_ENEMY_PIP = `<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="6" r="5"/>
  <circle cx="5" cy="6" r="1.2" class="pip-eye"/><circle cx="9" cy="6" r="1.2" class="pip-eye"/><rect x="5" y="10" width="4" height="3" rx="1"/></svg>`;

/** A weapon icon: the arrow drawn diagonally (pointing up-right) to fill a square slot, plus an optional badge. */
const weapon = (head: string, badge = '', shaft = '#5a3c23'): string => `<svg class="weapon-art" viewBox="0 0 40 40" aria-hidden="true">
  <g transform="rotate(-45 20 20)"><rect x="5" y="18.8" width="24" height="2.4" rx="1.2" fill="${shaft}"/>
  <path d="M2 15l6 5-6 5 2.5-5z" fill="#c9d3dc"/><path d="M5 15.5l5 4.5-5 4.5z" fill="#e3e8ec"/>${head}</g>${badge}</svg>`;

/** Explosion burst badge (bottom-right corner of the slot). */
const BURST = `<g transform="translate(29 29)"><path d="M0-9l2.6 5.2L8.4-6 5.6-.8 9.6 2.8 3.8 3.4 3 9.4-1 5-6 8.4-4.8 2.6-9.6-.6-4.4-3.2-6.4-8.4-1.2-5.2z" fill="#f08a3a"/>
  <circle r="3.2" fill="#ffe27a"/></g>`;
/** Piercing badge: a double chevron. */
const PIERCE = `<g transform="translate(29 29)"><circle r="8" fill="#3f6965"/>
  <path d="M-4.5-4 0 0l-4.5 4M0.5-4 5 0 0.5 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;

export const ICON_WEAPONS = {
  normal: weapon('<path d="M29 15.5l9 4.5-9 4.5z" fill="#8c96a0"/>'),
  explosive: weapon('<circle cx="32" cy="20" r="5" fill="#d8614f"/><circle cx="30.5" cy="18.5" r="1.6" fill="#f6c27a"/>', BURST),
  piercing: weapon('<path d="M28 17.5l11 2.5-11 2.5z" fill="#6c7a88"/>', PIERCE, '#7a5a38'),
} as const;
