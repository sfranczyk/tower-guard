import { Container, Graphics } from 'pixi.js';
import { GROUND_Y, VIEW_TOP } from '../config';
import type { Battleground } from '../data/battlegrounds';
import { nightSky, SUN_X } from '../systems/nightCycle';

/** Where the sun's centre sits on the horizon (behind the hills) and how big moon and sun are, world px. */
const HORIZON_Y = 280;
const MOON_RADIUS = 30;
const SUN_RADIUS = 56;
/** The moon's highest point (world y). */
const MOON_TOP_Y = VIEW_TOP + 70;
const STAR_COUNT = 140;
/** How dark the night shade over the hills and trees gets at full night. */
const SHADE_ALPHA = 0.42;

/** A small seeded random (the same stars every time). */
const seeded = (seed: number): (() => number) => () => {
  seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
  return (seed % 100000) / 100000;
};

/**
 * The night of a `nightCycle` map (systems/nightCycle.ts says where everything is): dawn and day skies over the night
 * bands, stars, a moon crossing the view and the rising sun, all behind the hills (`sky`), and a shade darkening hills
 * and trees (`shade`, laid over them). Background adds both; `show(progress, viewLeft, viewWidth)` every frame.
 */
export class NightSky {
  public readonly sky = new Container();
  public readonly shade = new Graphics();
  private readonly dawn = new Graphics();
  private readonly day = new Graphics();
  private readonly stars = new Graphics();
  private readonly moon = new Graphics();
  private readonly sun = new Graphics();

  public constructor(battleground: Battleground, left: number, right: number) {
    const cycle = battleground.nightCycle!;
    const bands = (graphics: Graphics, colors: readonly number[]): void => {
      const height = (GROUND_Y - VIEW_TOP) / colors.length;
      colors.forEach((color, index) => graphics.rect(left, VIEW_TOP + index * height, right - left, height + 1).fill({ color }));
    };
    bands(this.dawn, cycle.dawn);
    bands(this.day, cycle.day);
    const random = seeded(7919);
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const x = left + random() * (right - left);
      const y = VIEW_TOP + random() * (HORIZON_Y - VIEW_TOP - 20);
      this.stars.circle(x, y, 0.6 + random() * 1.3).fill({ color: 0xf4f1ff, alpha: 0.45 + random() * 0.55 });
    }
    this.moon.circle(0, 0, MOON_RADIUS * 2.2).fill({ color: cycle.moon, alpha: 0.06 });
    this.moon.circle(0, 0, MOON_RADIUS * 1.45).fill({ color: cycle.moon, alpha: 0.12 });
    this.moon.circle(0, 0, MOON_RADIUS).fill({ color: cycle.moon });
    [[-9, -8, 7], [10, 4, 5], [-4, 12, 4], [8, -13, 3]].forEach(([x, y, radius]) =>
      this.moon.circle(x, y, radius).fill({ color: 0xc9cdc0, alpha: 0.55 }));
    this.sun.circle(0, 0, SUN_RADIUS * 1.9).fill({ color: cycle.sun, alpha: 0.12 });
    this.sun.circle(0, 0, SUN_RADIUS * 1.3).fill({ color: cycle.sun, alpha: 0.18 });
    this.sun.circle(0, 0, SUN_RADIUS).fill({ color: cycle.sun, alpha: 0.95 });
    this.sky.addChild(this.dawn, this.day, this.stars, this.moon, this.sun);
    this.shade.rect(left, VIEW_TOP, right - left, GROUND_Y - VIEW_TOP + 60).fill({ color: cycle.shade });
    this.show(0, 0, right - left);
  }

  /** The sky `progress` (0..1) through the night, with moon and sun placed across the view at `viewLeft`. */
  public show(progress: number, viewLeft: number, viewWidth: number): void {
    const state = nightSky(progress);
    this.dawn.alpha = state.dawn;
    this.day.alpha = state.day;
    this.stars.alpha = state.stars;
    this.moon.visible = state.moon.visible;
    this.moon.position.set(viewLeft + state.moon.x * viewWidth, HORIZON_Y - state.moon.height * (HORIZON_Y - MOON_TOP_Y));
    // The moon pales as the sky brightens.
    this.moon.alpha = 1 - 0.6 * state.dawn;
    this.sun.visible = state.sunRise > -1;
    this.sun.position.set(viewLeft + SUN_X * viewWidth, HORIZON_Y + SUN_RADIUS - (state.sunRise + 1) * SUN_RADIUS * 1.5);
    this.shade.alpha = SHADE_ALPHA * state.shade;
  }
}
