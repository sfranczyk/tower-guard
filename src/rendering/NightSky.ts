import { Container, Graphics } from 'pixi.js';
import { AURORA, BACKDROP_WIDTH, GROUND_Y, MAX_VIEW_WIDTH, NIGHT_SCENERY, VIEW_TOP } from '../config';
import type { Battleground } from '../data/battlegrounds';
import { nearestValley, nightSky, sunCrescent, sunShowing, SUN_X } from '../systems/nightCycle';
import { AURORA_CURTAINS, auroraColumn } from './aurora';
import { mixColor } from './clouds';
import { MOUNTAIN_VALLEYS } from './landscape';

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

/** The northern lights (rendering/aurora.ts) in `colors` across `width` (view coordinates) at `seconds`. */
const drawAurora = (g: Graphics, colors: readonly number[], width: number, seconds: number): void => {
  const top = colors[colors.length - 1];
  AURORA_CURTAINS.forEach((curtain) => {
    const foot = colors[curtain.color % colors.length];
    const columns = Array.from({ length: AURORA_COLUMNS + 1 }, (_, index) => {
      const u = index / AURORA_COLUMNS;
      const column = auroraColumn(curtain, u, seconds);
      return { x: (curtain.from + (curtain.to - curtain.from) * u) * width, y: curtain.footY + column.foot, ...column };
    });
    AURORA_LAYERS.forEach((layer) => {
      const color = mixColor(foot, top, layer.tint);
      columns.slice(1).forEach((b, index) => {
        const a = columns[index];
        const alpha = layer.alpha * (a.glow + b.glow) / 2;
        if (alpha > 0.01) {
          const rise = (column: typeof a, share: number): number => column.y - share * column.height * AURORA.height;
          g.poly([a.x, rise(a, layer.to), b.x, rise(b, layer.to), b.x, rise(b, layer.from), a.x, rise(a, layer.from)]).fill({ color, alpha });
        }
      });
    });
  });
};

/**
 * Eclipse maps: the way the moon crosses the sun (from lower right to upper left: this is the side it leaves to), the
 * corona's streamers and the diamond ring's colour.
 */
const ECLIPSE_ANGLE = Math.atan2(-0.6, -0.8);
const CORONA_STREAMERS = 14;
const DIAMOND_COLOR = 0xfffbf0;

/** A small seeded random (the same stars every time). */
const seeded = (seed: number): (() => number) => () => {
  seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
  return (seed % 100000) / 100000;
};

/**
 * The survival sky of a `nightCycle` map (systems/nightCycle.ts says where everything is): dawn and day skies over the
 * night bands, stars (and northern lights, `nightCycle.aurora`), a moon crossing the view (or an eclipse, or a sun dim
 * behind dust, `nightCycle.kind`) and the rising sun, all behind the hills (`sky`), and a shade darkening hills
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
  /** Mountain maps: the valley the sun rises in (hills' own x), picked when it first shows and kept while it rises. */
  private readonly valleys?: readonly number[];
  private sunValley?: number;
  private viewWidth: number;
  private readonly moon = new Graphics();
  private readonly sun = new Graphics();
  /** Eclipse maps: the corona round the covered sun and the sun's crescent (the moon only hides it, never drawn). */
  private readonly corona = new Graphics();
  private readonly crescent = new Graphics();
  private readonly sunColor: number;
  private readonly kind: 'night' | 'eclipse' | 'dust';
  private readonly sunAt: { x: number; y: number };
  /** Eclipse maps: where the sun has drifted to as the time runs out (else it stays at `sunAt`). */
  private readonly sunTo: { x: number; y: number };
  private readonly starsAlpha: number;
  private readonly calms: boolean;
  /** How far the weather has died down (0..1) on maps whose storm calms (`nightCycle.calms`); 0 elsewhere. */
  public calm = 0;
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
    this.kind = cycle.kind ?? 'night';
    this.sunAt = cycle.sunAt ?? { x: SUN_X, y: VIEW_TOP + 120 };
    this.sunTo = cycle.sunTo ?? this.sunAt;
    this.starsAlpha = this.kind === 'dust' ? 0 : cycle.stars ?? 1;
    this.calms = !!cycle.calms;
    this.sunColor = cycle.sun;
    this.corona.visible = this.kind === 'eclipse';
    this.crescent.visible = this.kind === 'eclipse';
    this.sun.visible = this.kind !== 'eclipse';
    this.auroraColors = cycle.aurora;
    this.valleys = battleground.hillShape === 'mountains' ? MOUNTAIN_VALLEYS : undefined;
    this.aurora.blendMode = 'add';
    this.viewWidth = right - left;
    this.sky.addChild(this.dawn, this.day, this.stars, this.aurora, this.moon, this.corona, this.sun, this.crescent);
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
    drawAurora(this.aurora, this.auroraColors, this.viewWidth, this.seconds);
  }

  /** The sky `progress` (0..1) through the night, with moon and sun placed across the view at `viewLeft`. */
  public show(progress: number, viewLeft: number, viewWidth: number): void {
    const state = nightSky(progress, this.kind);
    this.dawn.alpha = state.dawn;
    this.day.alpha = state.day;
    this.stars.alpha = state.stars * this.starsAlpha;
    this.calm = this.calms ? state.calm : 0;
    this.stars.x = viewLeft;
    this.viewWidth = viewWidth;
    this.aurora.x = viewLeft;
    this.aurora.alpha = AURORA.alpha * state.stars;
    this.hills.x = viewLeft * (1 - NIGHT_SCENERY.hillsParallax);
    this.dayHills.alpha = state.hillsLight;
    this.moon.visible = this.kind === 'night' && state.moon.visible;
    this.moon.position.set(viewLeft + state.moon.x * viewWidth, HORIZON_Y - state.moon.height * (HORIZON_Y - MOON_TOP_Y));
    // The moon pales as the sky brightens.
    this.moon.alpha = 1 - 0.6 * state.dawn;
    if (this.kind === 'night') {
      this.sun.visible = state.sunRise > -1;
      this.sun.position.set(this.sunX(state.sunRise > -1, viewLeft, viewWidth), HORIZON_Y + SUN_RADIUS - (state.sunRise + 1) * SUN_RADIUS * 1.5);
    } else if (this.kind === 'dust') {
      // The sun stands still in the view, dim behind the dust and brightening as it clears.
      this.sun.position.set(viewLeft + this.sunAt.x * viewWidth, this.sunAt.y);
      this.sun.alpha = 0.25 + 0.75 * state.calm;
    } else {
      const p = Math.max(0, Math.min(1, progress));
      const x = this.sunAt.x + (this.sunTo.x - this.sunAt.x) * p;
      const y = this.sunAt.y + (this.sunTo.y - this.sunAt.y) * p;
      this.crescent.position.set(viewLeft + x * viewWidth, y);
      this.drawEclipse(state.eclipse, state.corona, state.diamond);
    }
    this.shade.alpha = SHADE_ALPHA * state.shade;
  }

  /**
   * The eclipse round the crescent's position: the sun's crescent left by the moon `offset` sun radii along its path
   * (positive before the total eclipse, on the side it comes from), its glow growing with it, the corona round the sun
   * at `corona`, fading first on the side the sun shows, and the diamond ring's bead on the rim at `diamond`.
   */
  private drawEclipse(offset: number, corona: number, diamond: number): void {
    const color = this.sunColor;
    const showing = sunShowing(Math.abs(offset));
    const moonAngle = offset >= 0 ? ECLIPSE_ANGLE + Math.PI : ECLIPSE_ANGLE;
    this.crescent.clear();
    if (showing > 0) {
      this.crescent.circle(0, 0, SUN_RADIUS * 1.9).fill({ color, alpha: 0.12 * showing });
      this.crescent.circle(0, 0, SUN_RADIUS * 1.3).fill({ color, alpha: 0.18 * showing });
    }
    const crescent = sunCrescent(Math.abs(offset), moonAngle);
    if (crescent.length > 0) {
      this.crescent.poly(crescent.map((value) => value * SUN_RADIUS)).fill({ color, alpha: 0.95 });
    }
    if (diamond > 0) {
      this.drawDiamond(moonAngle + Math.PI, diamond);
    }
    this.corona.clear();
    this.corona.position.copyFrom(this.crescent.position);
    if (corona <= 0) {
      return;
    }
    // A ring of pale glow (none inside the sun, where the sky shows behind the moon) and streamers round it.
    this.corona.circle(0, 0, SUN_RADIUS * 1.9).fill({ color: 0xfff4e0, alpha: 0.08 * corona });
    this.corona.circle(0, 0, SUN_RADIUS).cut();
    this.corona.circle(0, 0, SUN_RADIUS * 1.35).fill({ color: 0xfff4e0, alpha: 0.12 * corona });
    this.corona.circle(0, 0, SUN_RADIUS).cut();
    for (let index = 0; index < CORONA_STREAMERS; index += 1) {
      const angle = (index / CORONA_STREAMERS) * Math.PI * 2 + 0.2 * Math.sin(index * 2.3);
      // 1 on the moon's side, 0 where the sun comes out: that side goes first.
      const side = (1 + Math.cos(angle - moonAngle)) / 2;
      const alpha = 0.22 * Math.max(0, Math.min(1, corona * 2 - (1 - side)));
      if (alpha <= 0.01) {
        continue;
      }
      const reach = SUN_RADIUS * (index % 2 === 0 ? 2.3 : 1.6);
      this.corona.poly([
        Math.cos(angle - 0.12) * SUN_RADIUS, Math.sin(angle - 0.12) * SUN_RADIUS,
        Math.cos(angle) * reach, Math.sin(angle) * reach,
        Math.cos(angle + 0.12) * SUN_RADIUS, Math.sin(angle + 0.12) * SUN_RADIUS,
      ]).fill({ color: 0xfff4e0, alpha });
    }
  }

  /** The diamond ring: a bead of sun on the rim at `angle`, flaring into a glow and four rays, at `strength` (0..1). */
  private drawDiamond(angle: number, strength: number): void {
    const x = Math.cos(angle) * SUN_RADIUS;
    const y = Math.sin(angle) * SUN_RADIUS;
    this.crescent.circle(x, y, 34).fill({ color: DIAMOND_COLOR, alpha: 0.12 * strength });
    this.crescent.circle(x, y, 16).fill({ color: DIAMOND_COLOR, alpha: 0.3 * strength });
    this.crescent.circle(x, y, 5.5).fill({ color: DIAMOND_COLOR, alpha: strength });
    for (let index = 0; index < 4; index += 1) {
      const ray = angle + Math.PI / 4 + (index * Math.PI) / 2;
      const reach = (index % 2 === 0 ? 46 : 30) * strength;
      const side = ray + Math.PI / 2;
      this.crescent.poly([
        x + Math.cos(side) * 2, y + Math.sin(side) * 2,
        x + Math.cos(ray) * reach, y + Math.sin(ray) * reach,
        x - Math.cos(side) * 2, y - Math.sin(side) * 2,
      ]).fill({ color: DIAMOND_COLOR, alpha: 0.7 * strength });
    }
  }

  /**
   * Where the sun stands (world x): SUN_X across the view, or on mountain maps in the valley nearest it, which it then
   * keeps (moving with the hills' parallax) so it never rises behind a peak.
   */
  private sunX(visible: boolean, viewLeft: number, viewWidth: number): number {
    if (!this.valleys) {
      return viewLeft + SUN_X * viewWidth;
    }
    const valley = this.sunValley ?? nearestValley(viewLeft + SUN_X * viewWidth - this.hills.x, this.valleys, BACKDROP_WIDTH);
    this.sunValley = visible ? valley : undefined;
    return valley + this.hills.x;
  }
}
