import { tunable } from '../core/tuning';
/** Scenery and weather: wind, mist, meadow layout, lightning, rain, snow. */
/**
 * Windy maps (`Battleground.wind`, systems/windShift.ts): every `everyMs` the wind (in steps: 3, 2, 1 leftwards, calm,
 * 1, 2, 3 rightwards) changes by one step at `stepChance`, by two at `bigChance`, wildly (three or more) at
 * `wildChance`; otherwise it stays.
 */
export const WIND_SHIFT = tunable('WIND_SHIFT', 'Wind shifts', {
  everyMs: 45000,
  stepChance: 0.5,
  bigChance: 0.1,
  wildChance: 0.05,
}, { meta: { stepChance: { max: 1 }, bigChance: { max: 1 }, wildChance: { max: 1 } } });
/**
 * Valley mist of the mountain maps (rendering/landscape.ts): clear at `*Top`, thickening down to `*Alpha` at `*Bottom`
 * (world y), once over the far peaks' feet (the near slopes cover its lower end) and once over the near slopes'
 * feet behind the pines. Read when a level's background is drawn (start the level again to see a change).
 */
export const MOUNTAIN_MIST = tunable('MOUNTAIN_MIST', 'Mountain mist', {
  farTop: 220,
  farBottom: 380,
  farAlpha: 0.55,
  nearTop: 395,
  nearBottom: 480,
  nearAlpha: 0.4,
}, { meta: { farAlpha: { max: 1 }, nearAlpha: { max: 1 } } });

/**
 * Night maps (rendering/NightSky.ts): the hills follow the camera by `hillsParallax` of its movement (0 = stand still
 * like the sky, 1 = move with the battlefield), so they look far away.
 */
export const NIGHT_SCENERY = tunable('NIGHT_SCENERY', 'Night scenery', {
  hillsParallax: 0.08,
}, { meta: { hillsParallax: { max: 1 } } });

/**
 * Northern lights on night maps with `nightCycle.aurora` (rendering/aurora.ts): how bright the curtains glow at full
 * night (`alpha`), how fast they wave (`speed`, 1 = normal) and how tall their rays rise (`height`, px).
 */
export const AURORA = tunable('AURORA', 'Aurora', {
  alpha: 0.6,
  speed: 1,
  height: 95,
}, { meta: { alpha: { max: 1 }, speed: { max: 4 }, height: { max: 250 } } });

/**
 * Sandstorm weather (rendering/Sand.ts): `grains` streaks of sand per GAME_WIDTH blowing at `speed` px/s (the way the
 * wind blows), a `haze` of dust over the whole field thickening by `farHaze` from world x `hazeFrom` to the enemy keep
 * (enemies come out of the dust). All of it dies down as the storm calms.
 */
export const SANDSTORM = tunable('SANDSTORM', 'Sandstorm', {
  grains: 170,
  speed: 360,
  haze: 0.1,
  farHaze: 0.42,
  hazeFrom: 800,
}, { meta: { haze: { max: 1 }, farHaze: { max: 1 }, hazeFrom: { max: 2400 } } });

/**
 * How often each Green Meadow tree (design lab, tab Trees) stands in the row: relative weights, 0 = never. Read when a
 * level's background is drawn.
 */
export const MEADOW_TREES = tunable('MEADOW_TREES', 'Meadow trees', {
  current: 4,
  forked: 1,
  undergrowth: 1,
  clump: 1,
});

/**
 * Lightning (storm battlegrounds): a strike every LIGHTNING_INTERVAL_MS (random in the range); only
 * LIGHTNING_GROUND_CHANCE of them reach the ground, after a LIGHTNING_WARNING_MS crackle at the spot.
 * A ground strike hurts everyone within LIGHTNING_RADIUS (the bowman is safe inside the keep).
 */
export const LIGHTNING_INTERVAL_MS: readonly [number, number] = [5000, 11000];
export const LIGHTNING_FIRST_DELAY_MS = 4000;
export const LIGHTNING_GROUND_CHANCE = 0.4;
export const LIGHTNING_WARNING_MS = 700;
export const LIGHTNING_DAMAGE = 30;
export const LIGHTNING_RADIUS = 38;

/** Light rain during storms: number of streaks, fall speed range (px/s), sideways drift per px fallen, opacity. */
export const RAIN_DROPS = 90;
export const RAIN_SPEED: readonly [number, number] = [620, 820];
export const RAIN_SLANT = 0.22;
export const RAIN_ALPHA = 0.28;

/** Snowfall: number of flakes, fall speed range (px/s), and how much of the wind (px/s²) becomes drift (px/s). */
export const SNOW_FLAKES = 110;
export const SNOW_SPEED: readonly [number, number] = [40, 85];
export const SNOW_WIND_DRIFT = 0.35;
