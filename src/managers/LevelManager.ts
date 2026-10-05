import {
  type IEnemy,
  type ILevelData,
  type ISpawnMetadata,
  type ISpawnPoint,
  type IWave,
} from '../types';
import { WORLD_WIDTH } from '../config';

const MVP_SPAWN_POINT: ISpawnPoint = { x: WORLD_WIDTH - 50, y: 458 };
const MVP_ENEMY: IEnemy = {
  x: MVP_SPAWN_POINT.x,
  y: MVP_SPAWN_POINT.y,
  health: 30,
  speed: 50,
  type: 'basic',
};

const makeSpawn = (enemyType: ISpawnMetadata['enemyType'], count: number, interval = 520): ISpawnMetadata => ({
  enemyType,
  count,
  interval,
  spawnPoint: MVP_SPAWN_POINT,
});

const LEVEL_ONE_SPAWNINGS: readonly ISpawnMetadata[] = [
  {
    enemyType: 'basic',
    count: 3,
    interval: 500,
    spawnPoint: MVP_SPAWN_POINT,
  },
  {
    enemyType: 'basic',
    count: 3,
    interval: 500,
    spawnPoint: MVP_SPAWN_POINT,
  },
  {
    enemyType: 'basic',
    count: 4,
    interval: 500,
    spawnPoint: MVP_SPAWN_POINT,
  },
];

const LEVEL_TWO_SPAWNINGS: readonly ISpawnMetadata[] = [
  makeSpawn('basic', 4), makeSpawn('fast', 4, 400), makeSpawn('tank', 2, 900),
];
const LEVEL_THREE_SPAWNINGS: readonly ISpawnMetadata[] = [
  makeSpawn('fast', 5, 360), makeSpawn('tank', 4, 700), makeSpawn('basic', 6, 330),
];

const LEVEL_ONE_WAVES: readonly IWave[] = [
  {
    delay: 0,
    count: 3,
    enemyType: 'basic',
    spawn: LEVEL_ONE_SPAWNINGS[0],
  },
  {
    delay: 5_000,
    count: 3,
    enemyType: 'basic',
    spawn: LEVEL_ONE_SPAWNINGS[1],
  },
  {
    delay: 10_000,
    count: 4,
    enemyType: 'basic',
    spawn: LEVEL_ONE_SPAWNINGS[2],
  },
];

const wavesFor = (spawns: readonly ISpawnMetadata[], delays: number[]): readonly IWave[] =>
  spawns.map((spawn, index) => ({
    delay: delays[index],
    count: spawn.count,
    enemyType: spawn.enemyType,
    spawn,
  }));

const LEVEL_DATA: Readonly<Record<number, ILevelData>> = {
  1: {
    id: 1,
    name: 'The First Wave',
    enemies: Array.from({ length: 10 }, () => ({ ...MVP_ENEMY })),
    waves: LEVEL_ONE_WAVES,
    spawnings: LEVEL_ONE_SPAWNINGS,
    enemyDifficulty: 1,
    goldReward: 100,
    towerHealth: 570,
  },
  2: {
    id: 2,
    name: 'The Red Pass',
    enemies: [],
    waves: wavesFor(LEVEL_TWO_SPAWNINGS, [0, 6_000, 13_000]),
    spawnings: LEVEL_TWO_SPAWNINGS,
    enemyDifficulty: 1.35,
    goldReward: 180,
    towerHealth: 650,
  },
  3: {
    id: 3,
    name: 'The Last Stand',
    enemies: [],
    waves: wavesFor(LEVEL_THREE_SPAWNINGS, [0, 6_500, 14_000]),
    spawnings: LEVEL_THREE_SPAWNINGS,
    enemyDifficulty: 1.7,
    goldReward: 300,
    towerHealth: 760,
  },
};

/** Total number of enemies spawned over the whole level. */
export const getLevelEnemyTotal = (level: ILevelData): number =>
  level.spawnings.reduce((sum, spawn) => sum + spawn.count, 0);

export class LevelManager {
  private currentLevel: ILevelData | undefined;
  private nextWaveIndex = 0;

  public loadLevel(levelId: number): ILevelData {
    const level = LEVEL_DATA[levelId];

    if (level === undefined) {
      throw new Error(`Unknown level: ${levelId}`);
    }

    this.currentLevel = level;
    this.nextWaveIndex = 0;
    return level;
  }

  public getNextWave(): IWave | undefined {
    const wave = this.currentLevel?.waves[this.nextWaveIndex];

    if (wave !== undefined) {
      this.nextWaveIndex += 1;
    }

    return wave;
  }

  public isLevelComplete(activeEnemyCount = 0): boolean {
    return (
      this.currentLevel !== undefined &&
      this.nextWaveIndex >= this.currentLevel.waves.length &&
      activeEnemyCount === 0
    );
  }
}
