import { Container, Graphics } from 'pixi.js';
import { GROUND_Y, MAX_VIEW_WIDTH, VIEW_TOP } from '../config';
import { moonLit, moonLitOutline, type DaySkyState } from '../systems/dayCycle';
import { mixColor } from './clouds';
import { drawEclipse } from './eclipseArt';

/** Where the sun's and moon's centres sit on the horizon (behind the hills), their highest points, and their sizes. */
const HORIZON_Y = 280;
const SUN_TOP_Y = VIEW_TOP + 95;
const MOON_TOP_Y = VIEW_TOP + 80;
const SUN_RADIUS = 56;
const MOON_RADIUS = 30;
const STAR_COUNT = 140;

/** Green Meadow round the clock: its sky by day, Moonlit Hollow's by night, and the sunrise and sunset skies. */
const SKIES = {
  night: [0x0a1024, 0x111a38, 0x19264c, 0x22335f, 0x2d4270],
  day: [0x6fa9cc, 0x80b8d1, 0x92c3d6, 0xa9cfd8],
  dawn: [0x2b3a6e, 0x4f4f86, 0x8a6390, 0xd88a84, 0xf4b98a],
  redDusk: [0x2b2450, 0x55305e, 0x93384e, 0xd2543a, 0xf28a46],
  darkDusk: [0x161c3a, 0x222a50, 0x323c66, 0x46527c, 0x5c6a8e],
};
const SUN_COLOR = 0xf8dc9b;
const MOON_COLOR = 0xeef1e4;
/** What the land and the clouds turn to at full night (a multiply tint), and through a red or dark sunset. */
const NIGHT_TINT = 0x5c6c96;
const NIGHT_CLOUD_TINT = 0x3a4262;
const RED_DUSK_TINT = 0xffb488;
const DARK_DUSK_TINT = 0x8c8ca8;
const RED_DUSK_CLOUD_TINT = 0xff9a80;

/** A small seeded random (the same stars every time). */
const seeded = (seed: number): (() => number) => () => {
  seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
  return (seed % 100000) / 100000;
};

/**
 * MOBA's sky (systems/dayCycle.ts says where everything is): night bands under the day sky and the sunrise and
 * sunset skies (red or dark), stars, the moon in its phase crossing the night, the sun crossing the day (eclipsed
 * when there is one, rendering/eclipseArt.ts), all behind the hills (`sky`), and the land and clouds tinted by the light
 * (`tint`: the hills, trees, grass and clouds Background hands it). Sun, moon and stars keep their place in the view
 * while the camera moves. `show(state, viewLeft, viewWidth)` every frame.
 */
export class DaySky {
  public readonly sky = new Container();
  private readonly day = new Graphics();
  private readonly dawn = new Graphics();
  private readonly redDusk = new Graphics();
  private readonly darkDusk = new Graphics();
  private readonly stars = new Graphics();
  private readonly moon = new Container();
  private readonly moonDark = new Graphics();
  private readonly moonLit = new Graphics();
  private readonly moonGlow = new Graphics();
  private readonly craters = new Graphics();
  /** The lit part again, as the craters' mask (a mask is not drawn itself). */
  private readonly moonMask = new Graphics();
  private readonly sun = new Graphics();
  private readonly corona = new Graphics();
  private readonly crescent = new Graphics();
  /** The moon's phase as last drawn (redrawn when it moves on a little). */
  private drawnPhase = -1;
  private land: readonly Container[] = [];
  private clouds: readonly Container[] = [];
  /**
   * The clouds are cached as textures on their first render, with the tint they inherit then baked in (and tinted again
   * on top): they are tinted only from the second frame, so the cache is baked untinted.
   */
  private cloudsBaked = false;

  public constructor(left: number, right: number) {
    const bands = (graphics: Graphics, colors: readonly number[]): Graphics => {
      const height = (GROUND_Y - VIEW_TOP) / colors.length;
      colors.forEach((color, index) => graphics.rect(left, VIEW_TOP + index * height, right - left, height + 1).fill({ color }));
      return graphics;
    };
    const night = bands(new Graphics(), SKIES.night);
    bands(this.day, SKIES.day);
    bands(this.dawn, SKIES.dawn);
    bands(this.redDusk, SKIES.redDusk);
    bands(this.darkDusk, SKIES.darkDusk);
    const random = seeded(7919);
    for (let index = 0; index < STAR_COUNT; index += 1) {
      // Across the widest view, in view coordinates (the layer follows the camera).
      const x = random() * MAX_VIEW_WIDTH;
      const y = VIEW_TOP + random() * (HORIZON_Y - VIEW_TOP - 40);
      this.stars.circle(x, y, 0.6 + random() * 1.3).fill({ color: 0xf4f1ff, alpha: 0.45 + random() * 0.55 });
    }
    this.moonDark.circle(0, 0, MOON_RADIUS).fill({ color: 0x1c2644, alpha: 0.55 });
    [[-9, -8, 7], [10, 4, 5], [-4, 12, 4], [8, -13, 3]].forEach(([x, y, radius]) =>
      this.craters.circle(x, y, radius).fill({ color: 0xc9cdc0, alpha: 0.55 }));
    this.craters.mask = this.moonMask;
    this.moon.addChild(this.moonGlow, this.moonDark, this.moonLit, this.moonMask, this.craters);
    this.sun.circle(0, 0, SUN_RADIUS * 1.9).fill({ color: SUN_COLOR, alpha: 0.12 });
    this.sun.circle(0, 0, SUN_RADIUS * 1.3).fill({ color: SUN_COLOR, alpha: 0.18 });
    this.sun.circle(0, 0, SUN_RADIUS).fill({ color: SUN_COLOR, alpha: 0.95 });
    this.sky.addChild(night, this.day, this.dawn, this.redDusk, this.darkDusk, this.stars, this.moon, this.corona, this.sun, this.crescent);
  }

  /** The hills, trees and grass, and the clouds, to darken at night (a tint on each). */
  public tint(land: readonly Container[], clouds: readonly Container[]): void {
    this.land = land;
    this.clouds = clouds;
  }

  /** The sky as `state` says, with sun, moon and stars placed across the view at `viewLeft`. */
  public show(state: DaySkyState, viewLeft: number, viewWidth: number): void {
    this.day.alpha = state.day;
    this.dawn.alpha = state.dawn;
    this.redDusk.alpha = state.redDusk ? state.dusk : 0;
    this.darkDusk.alpha = state.redDusk ? 0 : state.dusk;
    this.stars.alpha = state.stars;
    this.stars.x = viewLeft;
    this.showMoon(state, viewLeft, viewWidth);
    const sunY = HORIZON_Y + SUN_RADIUS - Math.sin(Math.PI * state.sun.arc) * (HORIZON_Y + SUN_RADIUS - SUN_TOP_Y);
    const sunX = viewLeft + state.sun.x * viewWidth;
    const { eclipse } = state;
    this.sun.visible = state.sun.visible && !eclipse;
    this.sun.position.set(sunX, sunY);
    this.crescent.visible = state.sun.visible && !!eclipse;
    this.corona.visible = this.crescent.visible;
    if (eclipse && state.sun.visible) {
      this.crescent.position.set(sunX, sunY);
      this.corona.position.set(sunX, sunY);
      drawEclipse(this.crescent, this.corona, eclipse, SUN_RADIUS, SUN_COLOR);
    }
    // Through a sunrise or sunset the land warms (red sunset) or only greys (dark one) on its way to or from night.
    const glow = Math.max(state.dawn, state.dusk);
    const warm = state.dusk > 0 && !state.redDusk ? DARK_DUSK_TINT : RED_DUSK_TINT;
    const land = mixColor(mixColor(NIGHT_TINT, 0xffffff, state.light), warm, 0.35 * glow);
    const cloud = mixColor(mixColor(NIGHT_CLOUD_TINT, 0xffffff, state.light), warm === RED_DUSK_TINT ? RED_DUSK_CLOUD_TINT : DARK_DUSK_TINT, 0.5 * glow);
    this.land.forEach((layer) => {
      layer.tint = land;
    });
    if (this.cloudsBaked) {
      this.clouds.forEach((layer) => {
        layer.tint = cloud;
      });
    }
    this.cloudsBaked = true;
  }

  private showMoon(state: DaySkyState, viewLeft: number, viewWidth: number): void {
    const { moon } = state;
    this.moon.visible = moon.visible;
    if (!moon.visible) {
      return;
    }
    // From the horizon at nightfall, highest at midnight, down again by sunrise.
    this.moon.position.set(viewLeft + moon.x * viewWidth, HORIZON_Y + MOON_RADIUS - Math.sin(Math.PI * moon.arc) * (HORIZON_Y + MOON_RADIUS - MOON_TOP_Y));
    if (Math.abs(moon.phase - this.drawnPhase) < 0.002) {
      return;
    }
    this.drawnPhase = moon.phase;
    const lit = moonLit(moon.phase);
    this.moonGlow.clear();
    this.moonGlow.circle(0, 0, MOON_RADIUS * 2.2).fill({ color: MOON_COLOR, alpha: 0.06 * lit });
    this.moonGlow.circle(0, 0, MOON_RADIUS * 1.45).fill({ color: MOON_COLOR, alpha: 0.12 * lit });
    this.moonLit.clear();
    this.moonMask.clear();
    const outline = moonLitOutline(moon.phase).map((value) => value * MOON_RADIUS);
    if (outline.length > 0) {
      this.moonLit.poly(outline).fill({ color: MOON_COLOR });
      this.moonMask.poly(outline).fill({ color: 0xffffff });
    }
    this.craters.visible = outline.length > 0;
  }
}
