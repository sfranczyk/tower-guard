import type { ProjectileType } from '../../types';

/**
 * Proposals for smaller arrows (design lab, tab Arrows): every arrow in five styles, built as SVG like the
 * game's own (src/assets/arrow*.svg), so a chosen one can be saved over its asset as it is. Each type keeps
 * its colours and its head; a style sets the length, the shaft, the head's size and the fletching.
 */

export type ArrowLook = Exclude<ProjectileType, 'fragment'>;

export interface ArrowStyle {
  id: string;
  name: string;
  /** Nock to tip, SVG units (the game draws them at half size; today's arrows are ~64). */
  length: number;
  /** Shaft: dark outline and the wood inside it. */
  shaft: { outline: number; core: number };
  /** The head at this share of today's size. */
  head: number;
  fletch: { shape: 'classic' | 'swept' | 'shield'; length: number; halfHeight: number; stripes: boolean };
}

export const ARROW_STYLES: readonly ArrowStyle[] = [
  {
    id: 'trim', name: 'Trim', length: 62, shaft: { outline: 3.2, core: 1.4 }, head: 0.7,
    fletch: { shape: 'classic', length: 13, halfHeight: 3.4, stripes: true },
  },
  {
    id: 'slim', name: 'Slim', length: 66, shaft: { outline: 2.6, core: 1.1 }, head: 0.6,
    fletch: { shape: 'swept', length: 15, halfHeight: 3, stripes: true },
  },
  {
    id: 'compact', name: 'Compact', length: 54, shaft: { outline: 3.2, core: 1.4 }, head: 0.65,
    fletch: { shape: 'shield', length: 11, halfHeight: 3.4, stripes: true },
  },
  {
    id: 'needle', name: 'Needle', length: 64, shaft: { outline: 2.4, core: 1 }, head: 0.5,
    fletch: { shape: 'swept', length: 12, halfHeight: 2.6, stripes: false },
  },
  {
    id: 'tail', name: 'Bright tail', length: 60, shaft: { outline: 3, core: 1.3 }, head: 0.45,
    fletch: { shape: 'classic', length: 15, halfHeight: 4, stripes: true },
  },
];

interface ArrowKind {
  name: string;
  shaft: string;
  /** Thicker or thinner shaft than the style's. */
  shaftScale?: number;
  fletch: { fill: string; edge: string; stripe: string };
  /** How far the head reaches back from the tip at today's size, and its drawing (tip at 0,0, pointing +x). */
  headLength: number;
  head: string;
}

const OUTLINE = '#27354e';
/** Strokes keep their width when a head or the fletching is scaled. */
const NS = 'vector-effect="non-scaling-stroke"';

/** Today's heads, cut out of the assets and moved so the tip is at the origin. */
export const ARROW_KINDS: Record<ArrowLook, ArrowKind> = {
  normal: {
    name: 'Arrow', shaft: '#d9a84f', fletch: { fill: '#f4d78c', edge: '#4b3a4e', stripe: '#b9863b' }, headLength: 14,
    head: `<path d="M-14 -4L0 0 -14 4 -11 0z" fill="#f4d78c" stroke="#4b3a4e" stroke-width="1.5" stroke-linejoin="round" ${NS}/>`,
  },
  piercing: {
    name: 'Piercing', shaft: '#b8c7d6', shaftScale: 0.86, fletch: { fill: '#a9e4f5', edge: '#3b4a5e', stripe: '#5f9fb5' }, headLength: 19,
    head: `<path d="M-19 -1.8L0 0 -19 1.8 -17 0z" fill="#f2fbff" stroke="#1f2b38" stroke-width="1.3" stroke-linejoin="round" ${NS}/>`
      + `<path d="M-16.5 0h13" stroke="#7aa6bb" stroke-width=".7" ${NS}/>`,
  },
  explosive: {
    name: 'Explosive', shaft: '#c98a3c', fletch: { fill: '#ffb066', edge: '#4b2a1e', stripe: '#b8642a' }, headLength: 10.4,
    head: `<circle cx="-5.2" cy="0" r="5.2" fill="#e2702a" stroke="#4b2a1e" stroke-width="1.4" ${NS}/>`
      + '<circle cx="-3.6" cy="-1.7" r="1.6" fill="#ffc27a"/>'
      + `<path d="M-9.8 -3v6" stroke="#3b3a40" stroke-width="1.6" ${NS}/>`,
  },
  shrapnel: {
    name: 'Shrapnel', shaft: '#8fa2a8', fletch: { fill: '#9cc8c2', edge: '#24333a', stripe: '#5f8f8b' }, headLength: 17,
    head: `<path d="M-17 -3.5h10l7 3.5-7 3.5h-10z" fill="#5f8f8b" stroke="#24333a" stroke-width="1.3" stroke-linejoin="round" ${NS}/>`
      + `<path d="M-13 -3.2v6.4M-9 -3.2v6.4" stroke="#24333a" stroke-width="1.2" ${NS}/>`
      + '<path d="M-7 -2l5 2-5 2" fill="#cfe3df"/>',
  },
  pinning: {
    name: 'Pinning', shaft: '#7a5a38', shaftScale: 1.15, fletch: { fill: '#8f3b2e', edge: '#2c1b18', stripe: '#d8735f' }, headLength: 27,
    head: `<path d="M-27 -2.5v5M-24 -2.5v5M-21 -2.5v5" stroke="#c9a46a" stroke-width="1.6" stroke-linecap="round" ${NS}/>`
      + `<path d="M-18 -2.8h8l10 2.8-10 2.8h-8z" fill="#5d6670" stroke="#23282e" stroke-width="1.2" stroke-linejoin="round" ${NS}/>`
      + `<path d="M-10 -2.8l-4 -2.7M-10 2.8l-4 2.7" stroke="#23282e" stroke-width="1.6" stroke-linecap="round" ${NS}/>`
      + '<path d="M-8 -1.4l6 1.4-6 1.4" fill="#aab4be"/>',
  },
  fire: {
    name: 'Fire', shaft: '#a0522d', fletch: { fill: '#e8613a', edge: '#4b2a1e', stripe: '#a83a1e' }, headLength: 24,
    head: '<path d="M-24 0c2-6 7-6 9-3 1-3 5-3 6 1-2 5-11 9-15 2z" fill="#ff8a2e"/>'
      + '<path d="M-21 0c1-3 4-3 6-1 1-2 3-1 3 1-2 3-7 4-9 0z" fill="#ffd35a"/>'
      + `<rect x="-21" y="-2" width="8" height="4" rx="1.5" fill="#5a3a22" stroke="#2b1c10" stroke-width="1" ${NS}/>`
      + `<path d="M-13 -4l13 4-13 4 3-4z" fill="#d9dde2" stroke="#4b3a4e" stroke-width="1.4" stroke-linejoin="round" ${NS}/>`,
  },
  frost: {
    name: 'Frost', shaft: '#cfe6f5', fletch: { fill: '#e8f6ff', edge: '#2f5d84', stripe: '#6fa9d6' }, headLength: 18,
    head: `<path d="M-18 0l5-5 13 5-13 5z" fill="#9fdcff" stroke="#2f5d84" stroke-width="1.3" stroke-linejoin="round" ${NS}/>`
      + `<path d="M-13 -5l2 5-2 5M-11 0h10" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" ${NS}/>`,
  },
  vortex: {
    name: 'Vortex', shaft: '#5b3f7a', fletch: { fill: '#b48ef0', edge: '#2c1a4a', stripe: '#6b44a8' }, headLength: 16,
    head: `<path d="M-16 0l4-5.5h6l6 5.5-6 5.5h-6z" fill="#7a4fc0" stroke="#2c1a4a" stroke-width="1.4" stroke-linejoin="round" ${NS}/>`
      + `<path d="M-8.5 0a2 2 0 1 1 2 2c-2.5 0-4-2-4-3.5 0-2.5 3-4 5.5-2.5" fill="none" stroke="#e6d4ff" stroke-width="1.2" stroke-linecap="round" ${NS}/>`,
  },
};

export const ARROW_LOOKS = Object.keys(ARROW_KINDS) as ArrowLook[];

/** Vanes in a 16 × 8 box (nock at x 0, centred on y 0), scaled to the style's size. */
const VANES: Record<ArrowStyle['fletch']['shape'], string> = {
  classic: 'M0 -4c5 1 10 1 16 2L12 0l4 2c-6 1-11 1-16 2l4-4z',
  swept: 'M0 -4L16 -1.2 13 0 16 1.2 0 4 4 0z',
  shield: 'M0 -4Q8 -4.6 14 -1.6L11 0 14 1.6Q8 4.6 0 4L3 0z',
};
const STRIPES = 'M4 -2.5L7 0 4 2.5M9 -2L12 0 9 2';

/** Room around the arrow inside the image: behind the nock and above and below the shaft. */
const MARGIN = 2;
export const ARROW_SVG_HEIGHT = 12;

const round = (value: number): number => Math.round(value * 100) / 100;

/** One arrow in one style, as a standalone SVG (width = its length + margins, the shaft along the middle). */
export const arrowSvg = (look: ArrowLook, style: ArrowStyle): string => {
  const kind = ARROW_KINDS[look];
  const width = style.length + 2 * MARGIN;
  const cy = ARROW_SVG_HEIGHT / 2;
  const nock = MARGIN;
  const tip = MARGIN + style.length;
  const shaftStart = nock + 1;
  // Under the head as far as the head is solid, so nothing shows through around it.
  const shaftEnd = tip - kind.headLength * style.head * 0.6;
  const outline = round(style.shaft.outline * (kind.shaftScale ?? 1));
  const core = round(style.shaft.core * (kind.shaftScale ?? 1));
  const { fletch } = style;
  const vanes = `translate(${nock} ${cy}) scale(${round(fletch.length / 16)} ${round(fletch.halfHeight / 4)})`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ARROW_SVG_HEIGHT}" viewBox="0 0 ${width} ${ARROW_SVG_HEIGHT}">`,
    `<path d="M${shaftStart} ${cy}H${round(shaftEnd)}" stroke="${OUTLINE}" stroke-width="${outline}" stroke-linecap="round"/>`,
    `<path d="M${shaftStart} ${cy}H${round(shaftEnd)}" stroke="${kind.shaft}" stroke-width="${core}" stroke-linecap="round"/>`,
    `<g transform="translate(${tip} ${cy}) scale(${style.head})">${kind.head}</g>`,
    `<g transform="${vanes}">`,
    `<path d="${VANES[fletch.shape]}" fill="${kind.fletch.fill}" stroke="${kind.fletch.edge}" stroke-width="1.1" stroke-linejoin="round" ${NS}/>`,
    fletch.stripes ? `<path d="${STRIPES}" fill="none" stroke="${kind.fletch.stripe}" stroke-width="0.9" stroke-linecap="round" ${NS}/>` : '',
    '</g>',
    '</svg>',
  ].join('');
};
