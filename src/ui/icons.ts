/** Small flat SVG icons for the HTML UI, drawn in the same style as the keeps and the landscape. */

export const ICON_KEEP = `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true">
  <rect x="7" y="9" width="14" height="16" rx="2" fill="#a79f92"/><rect x="16" y="9" width="5" height="16" rx="2" fill="#8c8478"/>
  <rect x="5" y="5" width="4" height="5" rx="1" fill="#bdb6aa"/><rect x="12" y="5" width="4" height="5" rx="1" fill="#bdb6aa"/>
  <rect x="19" y="5" width="4" height="5" rx="1" fill="#bdb6aa"/><path d="M11 25v-6a3 3 0 0 1 6 0v6z" fill="#6b4a2e"/></svg>`;

export const ICON_BOWMAN = `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true">
  <path d="M6 25c0-6 3-10 8-10s8 4 8 10z" fill="#3a4250"/><circle cx="14" cy="10" r="6" fill="#2b3038"/>
  <path d="M8.5 10a5.5 5.5 0 0 1 11 0z" fill="#4a5568"/>
  <path d="M21 4c4 5 4 13 0 18" fill="none" stroke="#8a6238" stroke-width="2" stroke-linecap="round"/></svg>`;

export const ICON_LEVEL = `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true">
  <rect x="7" y="4" width="2.5" height="21" rx="1.2" fill="#5a3c23"/><path d="M9.5 5h12l-3 4 3 4h-12z" fill="#d8614f"/></svg>`;

export const ICON_GEAR = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor"
  d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 4.6.1-1.1-.1-1.1 2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.9-1.1L15.7 3h-4l-.4 2.7a8 8 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.6L7 12l.1 1.1-2 1.6 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.8h4l.4-2.8c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4z"/></svg>`;

/** An enemy pip in the level progress: dark while alive, faded once defeated (via CSS). */
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

/** Pinning badge: a spike driven into the ground. */
const PIN = `<g transform="translate(29 29)"><circle r="8" fill="#8f3b2e"/>
  <path d="M0-5.5v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M-2.4 0.5 0 4l2.4-3.5z" fill="#fff"/>
  <path d="M-5 4.6h10" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></g>`;

/** Shrapnel badge: three small arrows fanning out. */
const SPLIT = `<g transform="translate(29 29)"><circle r="8" fill="#5f8f8b"/>
  <g stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M-4 3 4-5M-4 3 5-1M-4 3 1 5.5"/></g></g>`;

/** Flame badge. */
const FLAME = `<g transform="translate(29 29)"><circle r="8" fill="#c8452a"/>
  <path d="M0-5.5c2.5 2.5 4 4.5 4 6.5a4 4 0 0 1-8 0c0-1.5 1-2.5 2-3.5 0 1.5.5 2.5 1.5 2.5C-.5-1.5-1-3.5 0-5.5z" fill="#ffd35a"/></g>`;

/** Snowflake badge. */
const SNOWFLAKE = `<g transform="translate(29 29)"><circle r="8" fill="#3f7fb3"/>
  <g stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M0-5v10M-4.3-2.5l8.6 5M-4.3 2.5l8.6-5"/></g></g>`;

/** Swirl badge. */
const SWIRL = `<g transform="translate(29 29)"><circle r="8" fill="#6b44a8"/>
  <path d="M1 0a1.5 1.5 0 1 1-1.5-1.5c2.5 0 4 2 4 4 0 3-3 4.5-5.5 4M-1 0C-1-3 1.5-5 4-4.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>`;

export const ICON_WEAPONS = {
  normal: weapon('<path d="M29 15.5l9 4.5-9 4.5z" fill="#8c96a0"/>'),
  explosive: weapon('<circle cx="32" cy="20" r="5" fill="#d8614f"/><circle cx="30.5" cy="18.5" r="1.6" fill="#f6c27a"/>', BURST),
  piercing: weapon('<path d="M28 17.5l11 2.5-11 2.5z" fill="#6c7a88"/>', PIERCE, '#7a5a38'),
  shrapnel: weapon('<path d="M27 16.5h6l5 3.5-5 3.5h-6z" fill="#5f8f8b"/><path d="M30 16.8v6.4" stroke="#24333a" stroke-width="1"/>', SPLIT, '#6b7b80'),
  pinning: weapon('<path d="M27 17h5l7 3-7 3h-5z" fill="#5d6670"/><path d="M31 17l-2.5-2M31 23l-2.5 2" stroke="#23282e" stroke-width="1.4" stroke-linecap="round"/><path d="M24 17.5v5M26 17.5v5" stroke="#c9a46a" stroke-width="1.2"/>', PIN),
  fire: weapon('<path d="M26 20c1-5 6-6 8-3 1-2 4-2 4 1-1 4-8 7-12 2z" fill="#ff8a2e"/><path d="M28 20c1-2 3-2 5-1 1-1 2 0 2 1-2 2-5 3-7 0z" fill="#ffd35a"/><path d="M33 17.5l6 2.5-6 2.5z" fill="#d9dde2"/>', FLAME, '#a0522d'),
  frost: weapon('<path d="M28 20l3-3.5 8 3.5-8 3.5z" fill="#9fdcff"/><path d="M31 16.5l1.2 3.5-1.2 3.5" fill="none" stroke="#fff" stroke-width=".9"/>', SNOWFLAKE, '#8fb6d0'),
  vortex: weapon('<path d="M28 20l2.5-3.5h4l4 3.5-4 3.5h-4z" fill="#7a4fc0"/><circle cx="33" cy="20" r="1.4" fill="none" stroke="#e6d4ff" stroke-width=".9"/>', SWIRL, '#5b3f7a'),
} as const;

/** Enemy type icons (sandbox columns): flat stick figures in the HUD ink colour, each with its tell. */
const INK = '#2c3a38';
const figure = (body: string, ink = INK): string => `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true"
  fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** A club: a brown shaft thickening to a round head at (x2, y2). */
const club = (x1: number, y1: number, x2: number, y2: number, width = 2.2): string =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#8a5a32" stroke-width="${width}"/><circle cx="${x2}" cy="${y2}" r="${width * 0.95}" fill="#8a5a32" stroke="none"/>`;

/** A spark: a small star with a hot core, at (x, y). */
const spark = (x: number, y: number): string => `<g transform="translate(${x} ${y})" stroke="none">
  <path d="M0-3.4 .9-.9 3.4 0 .9.9 0 3.4-.9.9-3.4 0-.9-.9z" fill="#ff9a2e"/><circle r="1.1" fill="#ffe27a"/></g>`;

/**
 * A dragon in side view facing right: tail, raised bat wing behind its rider, body, neck and horned head, in
 * `hide` (body), `wing` (membrane) and `belly`; `rider` and `extra` are drawn over it (the rider sits at x 14).
 */
const dragon = (hide: string, wing: string, belly: string, rider: string, extra = ''): string => `<svg class="icon" viewBox="0 0 28 28" aria-hidden="true"
  stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 17.5Q2.5 18 2 22" fill="none" stroke="${hide}" stroke-width="2.2"/><path d="M0.6 22.6 2 20.4 3.4 22.8z" fill="${hide}"/>
  <path d="M9 15.5 3.5 2.5Q6.5 4.6 8.4 4.2 9.4 6.8 11.8 6.8 11.8 10.2 13.4 13.2z" fill="${wing}" stroke="${hide}" stroke-width="1.1"/>
  <path d="M9 15.5 8.4 4.2M10.6 14.8 11.8 6.8" stroke="${hide}" stroke-width=".8" fill="none"/>
  <path d="M10 20.5 9 24M15 20.5l1 3.5" stroke="${hide}" stroke-width="1.8" fill="none"/>
  <ellipse cx="12.5" cy="17.4" rx="7" ry="3.6" fill="${hide}"/><path d="M8 19.6Q12.5 21.6 17.5 19.2" fill="none" stroke="${belly}" stroke-width="1.3"/>
  <path d="M17.5 16.4Q21.2 14.4 21.8 10.6" fill="none" stroke="${hide}" stroke-width="3"/>
  <path d="M20 8.6 25.6 9.4 26 10.8 21 11.8z" fill="${hide}"/><path d="M21 8.8 19.4 6.2 22.4 8.4z" fill="${hide}"/>
  <circle cx="22.6" cy="9.7" r=".6" fill="#ffd35a"/>
  <g fill="none" stroke="#fffaf0" stroke-width="3"><circle cx="14.6" cy="8.6" r="1.8"/><path d="M14.4 10.4 13.8 14.4"/>${rider}</g>
  <g fill="none" stroke="${INK}" stroke-width="1.5"><circle cx="14.6" cy="8.6" r="1.8"/><path d="M14.4 10.4 13.8 14.4"/>${rider}</g>${extra}</svg>`;

export const ICON_ENEMIES = {
  // Raider: a club raised over the head.
  basic: figure(`<circle cx="11" cy="6" r="3"/><path d="M11 9v9M11 18l-4 7M11 18l4 7M11 12l-4 4M11 12l5-1"/>${club(16, 11, 19, 4)}`),
  // Goblin: running, leaning in, a dagger in front, speed lines behind.
  fast: figure(`<circle cx="16" cy="6.5" r="2.6"/><path d="M15 9l-3 7M12 16l-1.5 4.5-4.5 1.5M12 16l4 3v4.5M14 11l-4 3M14 11l4 2"/>
    <path d="M18 13l3.5-1.5" stroke="#9aa4ae" stroke-width="1.6"/><path d="M2 10h4M1 14h4.5M2.5 18h3" stroke="#66756f" stroke-width="1.5"/>`),
  // Ogre: big and thick-limbed, a long club in both hands.
  tank: figure(`<circle cx="10" cy="6" r="3.8" stroke-width="2.6"/><path d="M10 10v8M10 18l-5 7M10 18l5 7M10 12.5l6 1.5M10 12.5l4.5 4" stroke-width="3.4"/>
    ${club(15, 16, 23, 5, 3)}`),
  // Bandit archer: drawing the bow, an arrow on the string.
  archer: figure(`<circle cx="10" cy="6" r="3"/><path d="M10 9v9M10 18l-4 7M10 18l4 7M10 12l7.5 0M10 12.5l3.5 1"/>
    <path d="M18 4c4 4.5 4 11.5 0 16" stroke="#8a6238"/><path d="M18 4 13.5 13.5 18 20" stroke="#9aa4ae" stroke-width=".9"/>
    <path d="M13.5 13.5 25 13.5" stroke="#5a3c23" stroke-width="1.3"/><path d="M25 12v3l2-1.5z" fill="#8c96a0" stroke="none"/>`),
  // Sapper: running in with a bundle of dynamite strapped to the chest, the fuse lit.
  kamikaze: figure(`<circle cx="15.5" cy="5" r="2.8"/><path d="M14.5 8l-3 8M11.5 16l-1.5 4.5-4.5 1.5M11.5 16l4 3.5.5 4.5M13.5 10.5l-4.5 3M13.5 10.5l5 3"/>
    <g transform="rotate(22 13 12.5)" stroke="none"><rect x="10.2" y="9.6" width="1.8" height="6" rx=".6" fill="#c8452a"/>
    <rect x="12.2" y="9.2" width="1.8" height="6.4" rx=".6" fill="#d8614f"/><rect x="14.2" y="9.6" width="1.8" height="6" rx=".6" fill="#c8452a"/>
    <rect x="9.8" y="12" width="6.6" height="1.2" fill="#2c3a38"/></g>
    <path d="M14.4 9.6q.6-3.2 4.4-4.2" stroke="#c9b48a" stroke-width="1.1"/>${spark(19.8, 5)}`),
  // Rotting peasant: shuffling, head hung forward, both arms held out.
  zombie: figure(`<circle cx="11.5" cy="7" r="3"/><path d="M10 10l-.5 8M9.5 18l-4 7M9.5 18l3 7M10 12.5l11 .5M10 14l10.5 1.5"/>
    <path d="M21 13l2-.8M20.5 15.5l2 .4" stroke-width="1.4"/><circle cx="13.5" cy="20.5" r="1" fill="#72c43c" stroke="none"/>`, '#5f8a3e'),
  // Black knight: a closed helm with ember eyes, black plate, a sword raised.
  knight: figure(`<rect x="7.5" y="2.5" width="7.5" height="7.5" rx="2.2" fill="#2a2c33"/><path d="M10 6.2h4" stroke="#ff5a3c" stroke-width="1.3"/>
    <path d="M11 10.5v7.5M11 18l-4 7M11 18l4 7M11 12.5l-4 4M11 12.5l4.5-1.5" stroke-width="2.8"/>
    <path d="M16 11 22.5 2.5" stroke="#a9b0ba" stroke-width="1.9"/><path d="M14.2 9.3l3.6 3" stroke="#5c616c" stroke-width="1.7"/>`, '#2a2c33'),
  // Hammer knight: bigger, a horned helm, a war hammer in both hands.
  hammerKnight: figure(`<path d="M8 4.5Q5 3 5.5.8M15 4.5Q18 3 17.5.8" stroke="#c9c0ad" stroke-width="1.5"/>
    <rect x="7" y="3" width="9" height="8" rx="2.4" fill="#2a2c33"/><path d="M10 6.8h4.5" stroke="#ff5a3c" stroke-width="1.3"/>
    <path d="M11.5 11v7.5M11.5 18.5l-5 6.5M11.5 18.5l5 6.5M11.5 13l5.5 1M11.5 13l4 4" stroke-width="3.4"/>
    <path d="M14.5 19.5 22 5" stroke="#5a3a20" stroke-width="1.8"/><path d="M18.4 3.4l6.2 3.2-1.8 3.5-6.2-3.2z" fill="#3d4048" stroke="none"/>`, '#2a2c33'),
  // Dark priest: hooded, red eyes, a long robe, a scepter with a red orb; a red cross for its heals.
  priest: figure(`<path d="M11 2 6.8 6.8V11h8.4V6.8z" fill="#2b1d2e" stroke="none"/><circle cx="12.2" cy="7.6" r="1" fill="#ff2a2a" stroke="none"/>
    <path d="M7.5 11h7.5l3 14H4.5z" fill="#2b1d2e" stroke="none"/><path d="M11.5 11.5l1 13.5" stroke="#9b1f2a" stroke-width="1.4"/>
    <path d="M14 13.5l4.5-1.5" stroke="#2b1d2e" stroke-width="2.4"/><path d="M19 14.5V4.5" stroke="#3a2a20" stroke-width="1.6"/>
    <circle cx="19" cy="4" r="2.3" fill="#c4182a" stroke="none"/><path d="M24 9v5M21.5 11.5h5" stroke="#d8333f" stroke-width="1.7"/>`, '#2b1d2e'),
  // Dragon archer: a dark dragon, its rider aiming a bow ahead.
  dragon: dragon('#3b2a22', '#6a5242', '#9a8068', `<path d="M14.2 11.6 17.4 10.6"/><path d="M17 6.6Q19.6 10.2 17 13.8" stroke="#8a6238" stroke-width="1.2"/>`),
  // Fire dragon: red, breathing a flame; its rider holds the reins with both hands.
  fireDragon: dragon('#b5473a', '#d9785e', '#f0c38a', `<path d="M14.2 11.6 18 13.4"/>`,
    `<path d="M25.6 10.6Q28.4 11.6 27.8 15.6 26.8 14 25.6 14.4 26.6 12.8 25 11.6z" fill="#ff9a2e"/><path d="M25.8 11Q27.2 12 27 13.8 26.4 12.8 25.6 12.6z" fill="#ffd35a"/>`),
} as const;
