import type { Battleground } from '../data/battlegrounds';

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * The picture is 48×36 with this much more sky above it, cut off (`slice`, bottom-aligned) in a 4:3 box: a taller box
 * (a mode card stretched to its window) shows more sky instead of cropping the sides.
 */
const SKY_ABOVE = 36;

/** MOBA's look (the online room's mode card): a dimmer sky, the sun eclipsed to a thin crescent (the diamond ring), a comet. */
export interface ThumbnailOptions {
  eclipse?: boolean;
  /** Where the sun or moon stands instead of its usual place, and its radius (the split picture's disc on the cut). */
  orb?: { x: number; y: number; r: number };
  /** Moves the fair-weather cloud this far right (negative: left). */
  cloudShift?: number;
}

/** A square picture (a mode card): the same scene with only the top 12 units of sky, so the sun and the sky's bands stay. */
export const squareThumbnail = (battleground: Battleground, options: ThumbnailOptions = {}): string =>
  `<svg class="map-thumb map-thumb-square" viewBox="0 -12 48 48" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${thumbnailArt(battleground, options)}</svg>`;

/**
 * A tiny flat landscape (48×36 SVG) drawn from a battleground's palette, for map pickers: sky bands,
 * the sun, a cloud (or a storm cloud with a bolt), hills or dunes, a tree or cactus and the ground.
 */
export const mapThumbnail = (battleground: Battleground, options: ThumbnailOptions = {}): string =>
  `<svg class="map-thumb" viewBox="0 ${-SKY_ABOVE} 48 ${36 + SKY_ABOVE}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${thumbnailArt(battleground, options)}</svg>`;

/**
 * Two battlegrounds in one picture, split on a diagonal (top right to bottom left): `left`'s upper left, `right`'s
 * lower right (MOBA practice: day and night at once), one disc on the cut (half sun, half moon), the cloud moved left.
 */
export const splitThumbnail = (left: Battleground, right: Battleground): string => `<svg class="map-thumb" viewBox="0 ${-SKY_ABOVE} 48 ${36 + SKY_ABOVE}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><clipPath id="split-thumb-night"><path d="M${SPLIT_TOP} ${-SKY_ABOVE}H64V36H${SPLIT_FOOT}Z"/></clipPath></defs>
  ${thumbnailArt(left, { orb: SPLIT_ORB, cloudShift: -14 })}
  <g clip-path="url(#split-thumb-night)">${thumbnailArt(right, { orb: SPLIT_ORB })}</g>
  <path d="M${SPLIT_TOP} ${-SKY_ABOVE}L${SPLIT_FOOT} 36" stroke="#fffdf6" stroke-width=".8" opacity=".7"/>
</svg>`;

/** Where the split's diagonal meets the picture's top and foot: it runs through the middle of the scene (24, 18). */
const SPLIT_FOOT = 12;
const SPLIT_TOP = 24 + ((24 - SPLIT_FOOT) * (18 + SKY_ABOVE)) / 18;
/** One disc on the cut, high in the sky: the sun on the day side, the moon on the night side. */
const SPLIT_ORB = { x: SPLIT_TOP - ((SPLIT_TOP - SPLIT_FOOT) * (SKY_ABOVE + 8)) / (SKY_ABOVE + 36), y: 8, r: 5.5 };

const thumbnailArt = (battleground: Battleground, { eclipse = false, orb, cloudShift = 0 }: ThumbnailOptions): string => {
  const { sky, sun, weather, cloudColor, hills, hillShape, trees, ground, nightCycle } = battleground;
  const parts: string[] = [];
  const band = 27 / sky.length;
  parts.push(`<rect x="0" y="${-SKY_ABOVE}" width="48" height="${SKY_ABOVE + 0.5}" fill="${hex(sky[0])}"/>`);
  sky.forEach((color, index) => parts.push(`<rect x="0" y="${index * band}" width="48" height="${band + 0.5}" fill="${hex(color)}"/>`));
  if (nightCycle && nightCycle.kind !== 'eclipse' && nightCycle.kind !== 'dust') {
    parts.push('<g fill="#fff"><circle cx="8" cy="-20" r=".5"/><circle cx="27" cy="-9" r=".5"/><circle cx="41" cy="-26" r=".4"/><circle cx="18" cy="-31" r=".4"/></g>');
  }
  if (sun) {
    const cx = orb?.x ?? (sun.x < 600 ? 13 : 36);
    const cy = orb?.y ?? (sun.y > 200 ? 20 : 9);
    if (eclipse) {
      // Just before totality, the diamond ring, high in the sky and larger: the moon (unseen, the sky shows through it)
      // leaves only a thin crescent of the sun, a soft corona round it and one bright bead with a glint on the crescent.
      const [x, y, r] = [cx, -1, 7];
      const bead = { x: x - 0.84 * r, y: y + 0.48 * r };
      parts.push(`<defs><mask id="moba-thumb-eclipse"><circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + 0.12 * r}" cy="${y - 0.07 * r}" r="${0.98 * r}" fill="#000"/></mask></defs>`
        + `<circle cx="${x}" cy="${y}" r="${1.7 * r}" fill="#fff4e0" opacity=".1"/><circle cx="${x}" cy="${y}" r="${1.3 * r}" fill="#fff4e0" opacity=".14"/>`
        + `<circle cx="${x}" cy="${y}" r="${r}" fill="#fffbe8" mask="url(#moba-thumb-eclipse)"/>`
        + `<circle cx="${bead.x}" cy="${bead.y}" r="2.8" fill="#fffbe8" opacity=".4"/><circle cx="${bead.x}" cy="${bead.y}" r="1.3" fill="#fff"/>`
        + `<path d="M${bead.x - 4.5} ${bead.y}H${bead.x + 4.5}M${bead.x} ${bead.y - 4.5}V${bead.y + 4.5}" stroke="#fff" stroke-width=".45" stroke-linecap="round" opacity=".9"/>`);
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${orb?.r ?? 5}" fill="${hex(sun.color)}"/>`);
    }
  }
  if (eclipse) {
    // Still day, a little darker than usual.
    parts.push(`<rect x="0" y="${-SKY_ABOVE}" width="48" height="${SKY_ABOVE + 28}" fill="#1d2440" opacity=".2"/>`);
    // A comet across the other side of the sky, its tail behind it.
    const left = !sun || sun.x >= 600;
    const [x0, x1] = left ? [3, 15] : [45, 33];
    parts.push(`<path d="M${x0} 3L${x1} 9.5" stroke="#fffdf6" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`
      + `<path d="M${(x0 + x1 * 2) / 3} 7.3L${x1} 9.5" stroke="#fffdf6" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`
      + `<circle cx="${x1}" cy="9.5" r="1.3" fill="#fff"/>`);
  }
  if (nightCycle?.kind === 'eclipse') {
    parts.push(`<circle cx="34" cy="9" r="6.5" fill="#fff4e0" opacity=".35"/><circle cx="34" cy="9" r="4.6" fill="${hex(nightCycle.moon)}"/>`);
  } else if (nightCycle?.kind === 'dust') {
    parts.push(`<circle cx="13" cy="9" r="4.5" fill="${hex(nightCycle.sun)}" opacity=".45"/>`);
  } else if (nightCycle) {
    parts.push(`<circle cx="${orb?.x ?? 13}" cy="${orb?.y ?? 8}" r="${orb?.r ?? 3.6}" fill="${hex(nightCycle.moon)}"/><g fill="#fff"><circle cx="30" cy="5" r=".5"/><circle cx="40" cy="10" r=".5"/><circle cx="22" cy="12" r=".4"/></g>`);
  }
  if (nightCycle?.aurora) {
    parts.push(`<path d="M18 13c6-6 12-1 18-6s8-1 12-3" stroke="${hex(nightCycle.aurora[0])}" stroke-width="2.4" fill="none" opacity=".6"/>`);
  }
  if (weather === 'sandstorm') {
    parts.push(`<g stroke="${hex(cloudColor)}" stroke-width="1.6" opacity=".8"><path d="M4 15h14M24 12h18M10 19h20"/></g>`);
  }
  if (weather === 'fair') {
    parts.push(`<g fill="${hex(cloudColor)}" opacity=".9" transform="translate(${cloudShift} 0)"><circle cx="22" cy="9" r="3.2"/><circle cx="26" cy="8" r="4"/><circle cx="30" cy="9.5" r="3"/><rect x="19" y="9" width="14" height="3.4" rx="1.7"/></g>`);
  }
  if (weather === 'snow') {
    parts.push(`<g fill="${hex(cloudColor)}" opacity=".9"><rect x="4" y="4" width="22" height="3.4" rx="1.7"/><rect x="24" y="8" width="18" height="3" rx="1.5"/></g>`);
  }
  if (weather === 'storm') {
    parts.push(`<path d="M0 0h48v8c-6 3-10 0-15 2s-9-1-14 1-10-1-19 1z" fill="${hex(cloudColor)}"/>`);
    parts.push('<path d="M27 9l-4 7h3l-3 7 7-9h-3l3-5z" fill="#e8f0ff"/>');
  }
  const [far, near] = hills.map(hex);
  if (hillShape === 'mountains') {
    parts.push(`<path d="M0 22l8-9 6 5 9-12 8 9 6-5 11 10v16H0z" fill="${far}"/>`);
    parts.push('<path d="M14 18l9-12 3.5 4-2 1.5-2-1-2 2zM2 20l6-7 2.5 3-2 .5-1.5-1z" fill="#f2f5f8"/>');
    parts.push(`<path d="M0 27c8-4 15-2 22-3s13-3 26 0v12H0z" fill="${near}"/>`);
  } else if (hillShape === 'dunes') {
    parts.push(`<path d="M0 22c8-3 14-2 20 0s14-3 28-1v15H0z" fill="${far}"/><path d="M0 26c9-2 16-1 22 1s14-2 26-1v10H0z" fill="${near}"/>`);
  } else {
    parts.push(`<path d="M0 22c7-8 13-3 19-6s12-6 29-2v22H0z" fill="${far}"/><path d="M0 26c8-6 15-1 22-4s13-4 26 0v14H0z" fill="${near}"/>`);
  }
  const [main, light] = trees.colors.map(hex);
  if (trees.style === 'cactus') {
    parts.push(`<g fill="${main}"><rect x="36" y="20" width="3" height="9" rx="1.5"/><rect x="33" y="22" width="2" height="4" rx="1"/><rect x="40" y="21" width="2" height="4" rx="1"/></g>`);
  } else if (trees.style === 'snowPine') {
    parts.push(`<path d="M8 28l4-9 4 9z" fill="${main}"/><path d="M36 28l3.5-8 3.5 8z" fill="${light}"/><path d="M10.5 22l1.5-3 1.5 3zM38 23l1.5-3 1.5 3z" fill="#f2f5f8"/>`);
  } else if (trees.style === 'pine') {
    parts.push(`<path d="M8 28l4-9 4 9z" fill="${main}"/><path d="M36 28l3.5-8 3.5 8z" fill="${light}"/>`);
  } else {
    parts.push(`<rect x="11.2" y="23" width="1.6" height="5" fill="${hex(trees.trunk)}"/><circle cx="12" cy="22" r="3.4" fill="${main}"/>`);
    parts.push(`<rect x="38.2" y="23" width="1.6" height="5" fill="${hex(trees.trunk)}"/><circle cx="39" cy="22" r="3" fill="${light}"/>`);
  }
  if (weather === 'snow') {
    parts.push('<g fill="#fff"><circle cx="6" cy="14" r=".8"/><circle cx="18" cy="20" r=".7"/><circle cx="30" cy="15" r=".8"/><circle cx="42" cy="19" r=".7"/></g>');
  }
  parts.push(`<rect x="0" y="28" width="48" height="8" fill="${hex(ground.fill)}"/><rect x="0" y="27.4" width="48" height="1.6" fill="${hex(ground.edge)}"/>`);
  return parts.join('');
};
