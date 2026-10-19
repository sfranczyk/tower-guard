import { Container, Graphics } from 'pixi.js';
import { AURORA, GROUND_Y, MAX_VIEW_WIDTH, NIGHT_SCENERY, VIEW_TOP } from '../config';
import type { Battleground } from '../data/battlegrounds';
import { nightSky, SUN_X } from '../systems/nightCycle';
import { AURORA_CURTAINS, auroraColumn } from './aurora';
import { mixColor } from './clouds';

/** Where the sun's centre sits on the horizon (behind the hills) and how big moon and sun are, world px. */
const HORIZON_Y = 280;
const MOON_RADIUS = 30;
const SUN_RADIUS = 56;
/** The moon's highest point (world y). */
const MOON_TOP_Y = VIEW_TOP + 70;
const STAR_COUNT = 140;
/** How dark the night shade over the hills and trees gets at full night. */
const SHADE_ALPHA = 0.42;

/** Columns per aurora curtain, and its layers from the foot up: share of the ray height, brightness, tint towards the top colour. */
const AURORA_COLUMNS = 56;
const AURORA_LAYERS: ReadonlyArray<{ from: number; to: number; alpha: number; tint: number }> = [
  { from: -0.04, to: 0.16, alpha: 1, tint: 0 },
  { from: 0.16, to: 0.5, alpha: 0.5, tint: 0.35 },
  { from: 0.5, to: 1, alpha: 0.18, tint: 0.8 },
];

/**
 * The northern lights (rendering/aurora.ts) in `colors` across `width` from `left`, at `seconds`: `y(footY)` places a
 * curtain's foot, `height` is the full ray height, `scale` shrinks the waves with it (the design lab's miniature) and
 * `alpha` dims it all.
 */
export const drawAurora = (
  g: Graphics, colors: readonly number[], left: number, width: number, seconds: number,
  y: (footY: number) => number, height: number, scale = 1, alpha = 1,
): void => {
  const top = colors[colors.length - 1];
  AURORA_CURTAINS.forEach((curtain) => {
    const foot = colors[curtain.color % colors.length];
    const columns = Array.from({ length: AURORA_COLUMNS + 1 }, (_, index) => {
      const u = index / AURORA_COLUMNS;
      const column = auroraColumn(curtain, u, seconds);
      return { x: left + (curtain.from + (curtain.to - curtain.from) * u) * width, y: y(curtain.footY) + column.foot * scale, ...column };
    });
    AURORA_LAYERS.forEach((layer) => {
      const color = mixColor(foot, top, layer.tint);
      columns.slice(1).forEach((b, index) => {
        const a = columns[index];
        const shade = alpha * layer.alpha * (a.glow + b.glow) / 2;
        if (shade > 0.01) {
          const rise = (column: typeof a, share: number): number => column.y - share * column.height * height;
          g.poly([a.x, rise(a, layer.to), b.x, rise(b, layer.to), b.x, rise(b, layer.from), a.x, rise(a, layer.from)]).fill({ color, alpha: shade });
        }
      });
    });
  });
};

/** A small seeded random (the same stars every time). */
const seeded = (seed: number): (() => number) => () => {
  seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
  return (seed % 100000) / 100000;
};

/**
 * The night of a `nightCycle` map (systems/nightCycle.ts says where everything is): dawn and day skies over the night
 * bands, stars (and northern lights, `nightCycle.aurora`), a moon crossing the view and the rising sun, all behind the hills (`sky`), and a shade darkening hills
 * and trees (`shade`, laid over them). Moon, sun and stars are at infinity: they keep their place in the view while the
 * camera moves. Background adds both and hands the hills to `holdHills`; `show(progress, viewLeft, viewWidth)` and `update(deltaMs)` every frame.
 */
export class NightSky {
  public readonly sky = new Container();
  public readonly shade = new Graphics();
  private readonly dawn = new Graphics();
  private readonly day = new Graphics();
  private readonly stars = new Graphics();
  /** Northern lights (`nightCycle.aurora`), redrawn as they wave; in view coordinates like the stars. */
  private readonly aurora = new Graphics();
  private readonly auroraColors?: readonly number[];
  private seconds = 0;
  private viewWidth: number;
  private readonly moon = new Graphics();
  private readonly sun = new Graphics();
  /** The hills (night and day colours), shifted against the camera for a slight parallax. */
  private readonly hills = new Container();
  private readonly dayHills = new Container();

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
      // Across the widest view, in view coordinates (the layer follows the camera).
      const x = random() * MAX_VIEW_WIDTH;
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
    this.auroraColors = cycle.aurora;
    this.aurora.blendMode = 'add';
    this.viewWidth = right - left;
    this.sky.addChild(this.dawn, this.day, this.stars, this.aurora, this.moon, this.sun);
    this.shade.rect(left, VIEW_TOP, right - left, GROUND_Y - VIEW_TOP + 60).fill({ color: cycle.shade });
    this.show(0, 0, right - left);
  }

  /** Takes the hill tiles in night and day colours; the returned layer goes where the hills belong. */
  public holdHills(night: readonly Container[], day: readonly Container[]): Container {
    this.dayHills.addChild(...day);
    this.hills.addChild(...night, this.dayHills);
    return this.hills;
  }

  /** Moves the northern lights on (every frame, also behind menus). */
  public update(deltaMs: number): void {
    if (!this.auroraColors) {
      return;
    }
    this.seconds += (deltaMs / 1000) * AURORA.speed;
    this.aurora.clear();
    drawAurora(this.aurora, this.auroraColors, 0, this.viewWidth, this.seconds, (footY) => footY, AURORA.height);
  }

  /** The sky `progress` (0..1) through the night, with moon and sun placed across the view at `viewLeft`. */
  public show(progress: number, viewLeft: number, viewWidth: number): void {
    const state = nightSky(progress);
    this.dawn.alpha = state.dawn;
    this.day.alpha = state.day;
    this.stars.alpha = state.stars;
    this.stars.x = viewLeft;
    this.viewWidth = viewWidth;
    this.aurora.x = viewLeft;
    this.aurora.alpha = AURORA.alpha * state.stars;
    this.hills.x = viewLeft * (1 - NIGHT_SCENERY.hillsParallax);
    this.dayHills.alpha = state.hillsLight;
    this.moon.visible = state.moon.visible;
    this.moon.position.set(viewLeft + state.moon.x * viewWidth, HORIZON_Y - state.moon.height * (HORIZON_Y - MOON_TOP_Y));
    // The moon pales as the sky brightens.
    this.moon.alpha = 1 - 0.6 * state.dawn;
    this.sun.visible = state.sunRise > -1;
    this.sun.position.set(viewLeft + SUN_X * viewWidth, HORIZON_Y + SUN_RADIUS - (state.sunRise + 1) * SUN_RADIUS * 1.5);
    this.shade.alpha = SHADE_ALPHA * state.shade;
  }
}
