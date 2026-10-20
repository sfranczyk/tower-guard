import type { Container } from 'pixi.js';
import { SNOW_WIND_DRIFT } from '../config';
import type { Battleground } from '../data/battlegrounds';
import type { Background } from '../rendering/Background';
import { Sand } from '../rendering/Sand';
import { Snow } from '../rendering/Snow';
import { WeatherSystem, type WeatherEvents } from '../systems/WeatherSystem';

/**
 * The level's weather over the field (by the battleground's `weather`): the storm's rain and lightning
 * (WeatherSystem; strikes and thunder go to `events`), snow drifting with the wind, or the sandstorm, which calms at dawn.
 */
export class BattleWeather {
  private readonly storm?: WeatherSystem;
  private readonly snow?: Snow;
  private readonly sand?: Sand;

  public constructor(
    battleground: Battleground,
    world: Container,
    screen: Container,
    private readonly background: Background,
    wind: number,
    events: WeatherEvents,
  ) {
    if (battleground.weather === 'storm') {
      this.storm = new WeatherSystem(world, screen, background, events);
    }
    if (battleground.weather === 'snow') {
      this.snow = new Snow(screen, wind * SNOW_WIND_DRIFT);
    }
    if (battleground.weather === 'sandstorm') {
      this.sand = new Sand(screen, wind < 0 ? -1 : 1);
    }
  }

  /** The wind changed mid-level: the snow drifts and the sand blows with it. */
  public setWind(wind: number): void {
    if (this.snow) {
      this.snow.drift = wind * SNOW_WIND_DRIFT;
    }
    if (this.sand) {
      this.sand.direction = wind < 0 ? -1 : 1;
    }
  }

  public update(deltaMs: number, cameraX: number): void {
    this.storm?.update(deltaMs, cameraX);
    this.snow?.update(deltaMs, cameraX);
    if (this.sand) {
      this.sand.intensity = 1 - (this.background.night?.calm ?? 0);
      this.sand.update(deltaMs, cameraX);
    }
  }
}
