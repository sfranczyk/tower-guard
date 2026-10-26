import { MOBA_SKY } from '../config';
import type { Vec2 } from '../types';
import { createRandom } from '../utils/math';
import { eclipsePhase, smoothstep } from './nightCycle';

/**
 * MOBA's sky clock (pure, tested; config MOBA_SKY): days and nights, the moon's phase and the eclipses with their
 * comets, all from the match time (ms since it started) and a seed the host picks (and sends: scenes/MobaSky.ts).
 * A day starts with its sunrise and ends with its sunset; the night follows. rendering/DaySky.ts draws `daySky`.
 */
export type DayPart = 'sunrise' | 'day' | 'sunset' | 'night';

/** One day and its night. */
export const cycleMs = (): number => MOBA_SKY.dayMs + MOBA_SKY.nightMs;

export interface DayTime {
  /** Which day (0 = the first). */
  index: number;
  part: DayPart;
  /** Ms since this day's sunrise began. */
  at: number;
  /** Match time of this day's sunrise. */
  start: number;
}

export const dayTime = (timeMs: number): DayTime => {
  const t = Math.max(0, timeMs);
  const index = Math.floor(t / cycleMs());
  const start = index * cycleMs();
  const at = t - start;
  const { dayMs, twilightMs } = MOBA_SKY;
  const part: DayPart = at < twilightMs ? 'sunrise' : at < dayMs - twilightMs ? 'day' : at < dayMs ? 'sunset' : 'night';
  return { index, part, at, start };
};

/** Whether day `index`'s sunset turns red (else the sky only darkens). */
export const redSunset = (seed: number, index: number): boolean =>
  createRandom((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0)() < MOBA_SKY.redSunsetChance;

/**
 * The moon's phase on `timeMs`: 0 full (the match starts at a full moon), 0.5 new, back to full at 1. It wanes over
 * MOBA_SKY.moonDays days, then waxes over as many.
 */
export const moonPhase = (timeMs: number): number => {
  const lunation = 2 * Math.max(1, MOBA_SKY.moonDays) * cycleMs();
  return (((Math.max(0, timeMs) / lunation) % 1) + 1) % 1;
};

/** Share of the moon's disc lit at `phase` (1 full .. 0 new). */
export const moonLit = (phase: number): number => (1 + Math.cos(2 * Math.PI * phase)) / 2;

/**
 * The lit part of the moon at `phase` as a polygon (radius 1, centred on 0, 0; y down): the lit rim on one side (the
 * left while it wanes, the right while it waxes), back along the terminator, a half ellipse. Empty at new moon.
 */
export const moonLitOutline = (phase: number, steps = 32): number[] => {
  const k = Math.cos(2 * Math.PI * phase);
  if (k <= -0.999) {
    return [];
  }
  const side = phase % 1 < 0.5 ? -1 : 1;
  const points: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const a = -Math.PI / 2 + (index / steps) * Math.PI;
    points.push(side * Math.cos(a), Math.sin(a));
  }
  for (let index = steps - 1; index > 0; index -= 1) {
    const a = -Math.PI / 2 + (index / steps) * Math.PI;
    points.push(-side * k * Math.cos(a), Math.sin(a));
  }
  return points;
};

export interface Eclipse {
  /** Which eclipse (0 = the first). */
  index: number;
  /** Match time the moon touches the sun, and the time it's over (it left the sun, or the sun has set). */
  start: number;
  end: number;
  /** Match time the comet comes in, and whether it flies left to right. */
  comet: number;
  cometRight: boolean;
}

/** The first moment of the full day at or after `timeMs` (after a sunrise, before a sunset). */
const inDaylight = (timeMs: number): number => {
  const { part, start, index } = dayTime(timeMs);
  if (part === 'day') {
    return timeMs;
  }
  return (part === 'sunrise' ? start : (index + 1) * cycleMs()) + MOBA_SKY.twilightMs;
};

/**
 * The eclipses that have begun by `untilMs`: each MOBA_SKY.eclipseMinMs..eclipseMaxMs after the previous one's start
 * (the first after the match's), moved to the next full day if it falls outside one; over after MOBA_SKY.eclipseMs or
 * once the sun has set. Its comet's flight lies inside it (at its start if the eclipse is too short for it).
 */
export const eclipsesUntil = (seed: number, untilMs: number): Eclipse[] => {
  const random = createRandom((seed ^ 0x5bd1e995) >>> 0);
  const { eclipseMinMs, eclipseMaxMs, eclipseMs, cometMs, dayMs } = MOBA_SKY;
  const eclipses: Eclipse[] = [];
  let drawn = 0;
  for (let index = 0; index < 1000; index += 1) {
    drawn += Math.max(1000, eclipseMinMs + random() * Math.max(0, eclipseMaxMs - eclipseMinMs));
    const start = inDaylight(drawn);
    const cometShare = random();
    const cometRight = random() < 0.5;
    if (start > untilMs) {
      break;
    }
    const end = Math.min(start + eclipseMs, dayTime(start).start + dayMs);
    eclipses.push({ index, start, end, comet: start + cometShare * Math.max(0, end - start - cometMs), cometRight });
    drawn = start;
  }
  return eclipses;
};

/** The eclipse going on at `timeMs`, if any. */
export const eclipseAt = (seed: number, timeMs: number): Eclipse | undefined => {
  const last = eclipsesUntil(seed, timeMs).pop();
  return last && timeMs < last.end ? last : undefined;
};

export interface DaySkyState {
  part: DayPart;
  /** How lit the land is (0 night .. 1 full day; an eclipse dims it). */
  light: number;
  /** Weights of the day sky (as `light`: an eclipse darkens it too), and of the sunrise and sunset skies laid over it (0..1). */
  day: number;
  dawn: number;
  dusk: number;
  /** Today's sunset is red (else only darker). */
  redDusk: boolean;
  stars: number;
  /** How red the sun has turned on its way down (0 .. MOBA_SKY.sunsetRed; half that on a dark sunset). */
  sunRed: number;
  /**
   * Along its path (1 its rising point over the enemy keep .. 0 its setting point over ours) and how far along its arc
   * (0 rising, 0.5 highest, 1 set; a little past either end while it sinks, MOBA_SKY.sinkMs); hidden once it has sunk.
   * The path is a half ellipse (`pathX` with the height sin(π·arc)): straight up out of the hills and straight down.
   */
  sun: { x: number; arc: number; visible: boolean };
  moon: { x: number; arc: number; visible: boolean; phase: number };
  /** Which day it is (1 = the first). */
  dayNumber: number;
  /** The day's title on its way up from behind the hills (0 rising .. 1 gone out of the top), at the day's start only. */
  title?: number;
  /** "Eclipse!" on its way up as the day's title (MOBA_SKY.dayTitleMs from the eclipse's start). */
  eclipseTitle?: number;
  /** The eclipse going on: what it looks like (systems/nightCycle.ts eclipsePhase). */
  eclipse?: { offset: number; corona: number; diamond: number; moonRadius: number };
}

/** How far a title is on its way up `sinceMs` after it set off (undefined: gone). */
const titleRise = (sinceMs: number): number | undefined =>
  sinceMs >= 0 && sinceMs < MOBA_SKY.dayTitleMs ? sinceMs / Math.max(1, MOBA_SKY.dayTitleMs) : undefined;

/** Across the path at `arc` along it: a half ellipse, so the sun and moon rise and set upright, not at a slant. */
export const pathX = (arc: number): number => (1 + Math.cos(Math.PI * arc)) / 2;

/** The sky at `timeMs` of a match with `seed`. */
export const daySky = (seed: number, timeMs: number): DaySkyState => {
  const { dayMs, nightMs, twilightMs } = MOBA_SKY;
  const time = dayTime(timeMs);
  const { part, at } = time;
  // Rises over the enemy's side (right), sets over ours; the sun from its last sunk moments before sunrise.
  const cycle = cycleMs();
  const sinkMs = Math.max(0, MOBA_SKY.sinkMs);
  const sunAt = at >= cycle - sinkMs ? at - cycle : at;
  const sunArc = sunAt / dayMs;
  // The first day has no night before it to bring a moon.
  const moonAt = at < sinkMs && time.index > 0 ? at + cycle : at;
  const moonArc = (moonAt - dayMs) / Math.max(1, nightMs);
  // The light follows the sun: the sky starts to brighten as it comes up from behind the hills and is full night
  // only once it has sunk behind them (twilightMs of its time in the sky plus sinkMs behind the hills).
  const twilight = Math.max(1, twilightMs);
  const span = twilight + sinkMs;
  const rising = Math.min(1, Math.max(0, (sunAt + sinkMs) / span));
  const setting = Math.min(1, Math.max(0, (sunAt - (dayMs - twilight)) / span));
  let light = smoothstep(0, 1, rising) * (1 - smoothstep(0, 1, setting));
  const fade = Math.max(1, MOBA_SKY.starFadeMs);
  // Out once the sun has sunk out of sight, gone before it shows again.
  const dark = Math.min(smoothstep(0, 1, (at - dayMs - sinkMs) / fade), 1 - smoothstep(0, 1, (at - (cycle - sinkMs - fade)) / fade));
  const going = eclipseAt(seed, timeMs);
  let eclipse: DaySkyState['eclipse'];
  if (going) {
    const phase = eclipsePhase((timeMs - going.start) / MOBA_SKY.eclipseMs, MOBA_SKY.eclipseTotal, MOBA_SKY.eclipseDiamond);
    eclipse = { offset: phase.eclipse, corona: phase.corona, diamond: phase.diamond, moonRadius: phase.moonRadius };
    light *= phase.light;
  }
  const redDusk = redSunset(seed, time.index);
  return {
    part,
    dayNumber: time.index + 1,
    title: titleRise(at),
    eclipseTitle: going ? titleRise(timeMs - going.start) : undefined,
    light,
    day: light,
    dawn: rising > 0 && rising < 1 ? Math.sin(Math.PI * rising) : 0,
    dusk: setting > 0 && setting < 1 ? Math.sin(Math.PI * setting) : 0,
    redDusk,
    sunRed: smoothstep(0, 1, setting) * MOBA_SKY.sunsetRed * (redDusk ? 1 : 0.5),
    // Never with the sun up, but in an eclipse.
    stars: eclipse ? Math.max(dark, 1 - smoothstep(0, 0.6, light)) : dark,
    sun: { x: pathX(sunArc), arc: sunArc, visible: sunAt < dayMs + sinkMs },
    moon: { x: pathX(moonArc), arc: moonArc, visible: moonAt >= dayMs - sinkMs && moonAt < cycle + sinkMs, phase: moonPhase(timeMs) },
    eclipse,
  };
};

/** Where the comet of `eclipse` is at `timeMs` on a field `width` wide (world px), while it flies. */
export const cometAt = (eclipse: Eclipse, timeMs: number, width: number): { x: number; y: number; heading: number } | undefined => {
  const q = (timeMs - eclipse.comet) / Math.max(1, MOBA_SKY.cometMs);
  if (q < 0 || q > 1) {
    return undefined;
  }
  const margin = 200;
  const from = eclipse.cometRight ? -margin : width + margin;
  const to = eclipse.cometRight ? width + margin : -margin;
  const { cometHighY, cometLowY } = MOBA_SKY;
  return {
    x: from + (to - from) * q,
    y: cometHighY + (cometLowY - cometHighY) * q,
    heading: Math.atan2(cometLowY - cometHighY, to - from),
  };
};

/** Whether a segment (an arrow's travel this frame) passes within `radius` of `centre`. */
export const segmentNear = (start: Vec2, end: Vec2, centre: Vec2, radius: number): boolean => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((centre.x - start.x) * dx + (centre.y - start.y) * dy) / length)) : 0;
  return Math.hypot(start.x + dx * t - centre.x, start.y + dy * t - centre.y) <= radius;
};

/**
 * Whether an arrow that moved `start` → `end` passed within `radius` of a comet that moved `from` → `to` meanwhile
 * (the arrow's path as seen from the comet: fast arrows and a moving comet never slip past each other between frames).
 */
export const sweptNear = (start: Vec2, end: Vec2, from: Vec2, to: Vec2, radius: number): boolean =>
  segmentNear({ x: start.x - from.x, y: start.y - from.y }, { x: end.x - to.x, y: end.y - to.y }, { x: 0, y: 0 }, radius);

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd. */
export const ordinal = (n: number): string => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
};

const ORDINAL_UNITS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TENTHS = ['', '', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth', 'eightieth', 'ninetieth'];

/** first, second … twentieth, twenty-first … ninety-ninth; from 100 in figures (100th). */
export const ordinalWord = (n: number): string => {
  if (n < 1 || n > 99 || !Number.isInteger(n)) {
    return ordinal(n);
  }
  if (n < 20) {
    return ORDINAL_UNITS[n]!;
  }
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  return unit === 0 ? TENTHS[tens]! : `${TENS[tens]}-${ORDINAL_UNITS[unit]}`;
};

/** What rises at the start of day `dayNumber`: "The second day of battle". */
export const dayTitle = (dayNumber: number): string => `The ${ordinalWord(dayNumber)} day of battle`;

/** What rises as an eclipse begins. */
export const ECLIPSE_TITLE = 'Eclipse!';
