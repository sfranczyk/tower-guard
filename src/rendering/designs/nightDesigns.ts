import type { Graphics } from 'pixi.js';
import { AURORA } from '../../config';
import { BATTLEGROUNDS, type BattlegroundId } from '../../data/battlegrounds';
import { nightSky, SUN_X } from '../../systems/nightCycle';
import { mixColor } from '../clouds';
import { drawAurora } from '../NightSky';
import type { DesignEntry } from './catalog';

/** The lab's night lasts this long (the game's lasts the survival level's time). */
const NIGHT_MS = 14000;
const HOLD_MS = 2000;
/** The tile's little landscape, in figure units: sky from TOP to the horizon, hills below. */
const LEFT = -70;
const WIDTH = 140;
const TOP = -55;
const HORIZON = 30;
const GROUND = 58;

/** The tile's scale against the game's sky (world y VIEW_TOP..GROUND_Y onto TOP..HORIZON). */
const SKY_SCALE = 0.16;

/** A night of `id` at `progress` (0..1) in miniature (`t`: ms, waves the aurora), as rendering/NightSky.ts lays it out in the game. */
const drawNight = (g: Graphics, id: BattlegroundId, progress: number, t = 0): void => {
  const map = BATTLEGROUNDS[id];
  const cycle = map.nightCycle!;
  const state = nightSky(progress);
  g.clear();
  const bandHeight = (HORIZON - TOP) / map.sky.length;
  map.sky.forEach((night, index) => {
    const dawn = mixColor(night, cycle.dawn[index], state.dawn);
    g.rect(LEFT, TOP + index * bandHeight, WIDTH, bandHeight + 0.5).fill({ color: mixColor(dawn, cycle.day[index], state.day) });
  });
  for (let index = 0; index < 24; index += 1) {
    g.circle(LEFT + ((index * 37) % WIDTH), TOP + ((index * 23) % 60), 0.6).fill({ color: 0xffffff, alpha: state.stars });
  }
  if (cycle.aurora) {
    drawAurora(g, cycle.aurora, LEFT, WIDTH, (t / 1000) * AURORA.speed, (footY) => TOP + 4 + footY * SKY_SCALE, AURORA.height * SKY_SCALE * 1.6, SKY_SCALE, AURORA.alpha * state.stars);
  }
  if (state.moon.visible) {
    g.circle(LEFT + state.moon.x * WIDTH, HORIZON - state.moon.height * (HORIZON - TOP - 10), 6).fill({ color: cycle.moon, alpha: 1 - 0.6 * state.dawn });
  }
  if (state.sunRise > -1) {
    g.circle(LEFT + SUN_X * WIDTH, HORIZON + 10 - (state.sunRise + 1) * 15, 10).fill({ color: cycle.sun });
  }
  if (map.hillShape === 'mountains') {
    g.poly([LEFT, HORIZON + 6, -50, HORIZON - 22, -28, HORIZON, -5, HORIZON - 30, 22, HORIZON - 2, 45, HORIZON - 24, LEFT + WIDTH, HORIZON + 4, LEFT + WIDTH, GROUND, LEFT, GROUND]);
  } else {
    g.moveTo(LEFT, HORIZON + 8).bezierCurveTo(-30, HORIZON - 12, 10, HORIZON + 6, 40, HORIZON - 4).lineTo(LEFT + WIDTH, HORIZON + 2)
      .lineTo(LEFT + WIDTH, GROUND).lineTo(LEFT, GROUND).closePath();
  }
  g.fill({ color: mixColor(mixColor(map.hills[0], cycle.dayHills[0], state.hillsLight), cycle.shade, 0.42 * state.shade) });
  g.rect(LEFT, GROUND - 8, WIDTH, 8).fill({ color: map.ground.fill });
};

const nightViews = (id: BattlegroundId): DesignEntry['views'] => [
  { label: 'One night (looped)', draw: (g, t) => drawNight(g, id, Math.min(1, (t % (NIGHT_MS + HOLD_MS)) / NIGHT_MS), t), scale: 1.2 },
  { label: 'Midnight', draw: (g, t) => drawNight(g, id, 0.35, t) },
  { label: 'Dawn', draw: (g, t) => drawNight(g, id, 0.88, t) },
  { label: 'Sunrise', draw: (g, t) => drawNight(g, id, 1, t) },
];

export const NIGHT_ENTRIES: DesignEntry[] = [{
  id: 'night-cycle',
  name: 'Moonlit Hollow',
  tagline: 'Survival: hold out until dawn',
  description: 'The survival map\'s night (systems/nightCycle.ts, rendering/NightSky.ts): the moon is up at nightfall and crosses the sky, setting at SURVIVAL.moonSetAt; dawn starts at SURVIVAL.dawnAt (stars fade, the horizon pinks, then day), the night shade lifts off the hills and the sun clears the horizon just as the time runs out. In the game it follows the level\'s time.',
  views: nightViews('moonlitHollow'),
}, {
  id: 'aurora-peaks',
  name: 'Aurora Peaks',
  tagline: 'Survival: Frostpeak Pass by night',
  description: 'The night of Frostpeak Pass (nightCycle.aurora, rendering/aurora.ts, drawn by rendering/NightSky.ts): northern lights in three curtains wave over the navy sky (feet bobbing, rays rising and falling, glow flickering along them, additive), fading with the stars as dawn pinks the peaks; then the pass\'s winter sky. Snow falls and the wind blows as on the pass. Tuning: AURORA (alpha, speed, height).',
  views: nightViews('auroraPeaks'),
}];
