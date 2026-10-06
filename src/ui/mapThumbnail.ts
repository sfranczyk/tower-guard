import type { Battleground } from '../data/battlegrounds';

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * A tiny flat landscape (48×36 SVG) drawn from a battleground's palette, for map pickers: sky bands,
 * the sun, a cloud (or a storm cloud with a bolt), hills or dunes, a tree or cactus and the ground.
 */
export const mapThumbnail = (battleground: Battleground): string => {
  const { sky, sun, weather, cloudColor, hills, hillShape, trees, ground } = battleground;
  const parts: string[] = [];
  const band = 27 / sky.length;
  sky.forEach((color, index) => parts.push(`<rect x="0" y="${index * band}" width="48" height="${band + 0.5}" fill="${hex(color)}"/>`));
  if (sun) {
    parts.push(`<circle cx="${sun.x < 600 ? 13 : 36}" cy="${sun.y > 200 ? 20 : 9}" r="5" fill="${hex(sun.color)}"/>`);
  }
  if (weather === 'fair') {
    parts.push(`<g fill="${hex(cloudColor)}" opacity=".9"><circle cx="22" cy="9" r="3.2"/><circle cx="26" cy="8" r="4"/><circle cx="30" cy="9.5" r="3"/><rect x="19" y="9" width="14" height="3.4" rx="1.7"/></g>`);
  }
  if (weather === 'storm') {
    parts.push(`<path d="M0 0h48v8c-6 3-10 0-15 2s-9-1-14 1-10-1-19 1z" fill="${hex(cloudColor)}"/>`);
    parts.push('<path d="M27 9l-4 7h3l-3 7 7-9h-3l3-5z" fill="#e8f0ff"/>');
  }
  const [far, near] = hills.map(hex);
  if (hillShape === 'dunes') {
    parts.push(`<path d="M0 22c8-3 14-2 20 0s14-3 28-1v15H0z" fill="${far}"/><path d="M0 26c9-2 16-1 22 1s14-2 26-1v10H0z" fill="${near}"/>`);
  } else {
    parts.push(`<path d="M0 22c7-8 13-3 19-6s12-6 29-2v22H0z" fill="${far}"/><path d="M0 26c8-6 15-1 22-4s13-4 26 0v14H0z" fill="${near}"/>`);
  }
  const [main, light] = trees.colors.map(hex);
  if (trees.style === 'cactus') {
    parts.push(`<g fill="${main}"><rect x="36" y="20" width="3" height="9" rx="1.5"/><rect x="33" y="22" width="2" height="4" rx="1"/><rect x="40" y="21" width="2" height="4" rx="1"/></g>`);
  } else if (trees.style === 'pine') {
    parts.push(`<path d="M8 28l4-9 4 9z" fill="${main}"/><path d="M36 28l3.5-8 3.5 8z" fill="${light}"/>`);
  } else {
    parts.push(`<rect x="11.2" y="23" width="1.6" height="5" fill="${hex(trees.trunk)}"/><circle cx="12" cy="22" r="3.4" fill="${main}"/>`);
    parts.push(`<rect x="38.2" y="23" width="1.6" height="5" fill="${hex(trees.trunk)}"/><circle cx="39" cy="22" r="3" fill="${light}"/>`);
  }
  parts.push(`<rect x="0" y="28" width="48" height="8" fill="${hex(ground.fill)}"/><rect x="0" y="27.4" width="48" height="1.6" fill="${hex(ground.edge)}"/>`);
  return `<svg class="map-thumb" viewBox="0 0 48 36" aria-hidden="true">${parts.join('')}</svg>`;
};
