import { FIRE_PATCH, WEATHER_ARROWS } from '../config';
import type { Weather } from '../data/battlegrounds';
import type { ProjectileType } from '../types';

/** What the weather does to an arrow in flight: an explosive one goes off, a fire one goes out. */
export type ArrowMishapKind = 'blast' | 'douse';
export interface ArrowMishap {
  kind: ArrowMishapKind;
  /** When, in ms after the shot (it lands first: nothing happens). */
  atMs: number;
}

/**
 * Rolled once as the arrow is loosed: an explosive arrow in a sandstorm (static in the dust) or a fire arrow in the rain
 * may be struck at a random moment of its flight (WEATHER_ARROWS). Each arrow rolls its own, so a volley never goes at once.
 */
export function rollArrowMishap(weather: Weather, type: ProjectileType, rand: () => number = Math.random): ArrowMishap | undefined {
  const kind: ArrowMishapKind | undefined = weather === 'sandstorm' && type === 'explosive' ? 'blast'
    : weather === 'storm' && type === 'fire' ? 'douse' : undefined;
  if (!kind) {
    return undefined;
  }
  const chance = kind === 'blast' ? WEATHER_ARROWS.sandstormBlastChance : WEATHER_ARROWS.rainDouseChance;
  if (rand() >= chance) {
    return undefined;
  }
  const { minMs, maxMs } = WEATHER_ARROWS;
  return { kind, atMs: minMs + rand() * Math.max(0, maxMs - minMs) };
}

/** How likely a fire arrow in the ground sets it burning: wet in the rain, never in the snow. */
export function groundFireChance(weather: Weather): number {
  if (weather === 'snow') {
    return 0;
  }
  return weather === 'storm' ? WEATHER_ARROWS.rainGroundFire : FIRE_PATCH.chance;
}

/** On snow a frost arrow freezes what it hits at once (as a headshot does elsewhere). */
export const frostFreezesAtOnce = (weather: Weather): boolean => weather === 'snow';

/** The status line at a level's start on a map whose weather changes the arrows. */
export function weatherArrowNote(weather: Weather): string | undefined {
  switch (weather) {
    case 'sandstorm': return 'Sandstorm: explosive arrows may go off in flight';
    case 'storm': return 'Rain: fire arrows may go out in flight';
    case 'snow': return 'Snow: frost arrows freeze at once';
    default: return undefined;
  }
}

/** The status line for the shooter whose arrow the weather got. */
export const mishapStatus = (kind: ArrowMishapKind): string => (kind === 'blast' ? 'The sandstorm set off your arrow!' : 'The rain put out your arrow!');
