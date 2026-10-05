export type EnemyType = 'basic' | 'fast' | 'tank' | 'archer';
export type ProjectileType = 'normal' | 'explosive' | 'piercing';

export interface IPushStrength {
  readonly value: number;
  readonly max: number;
  readonly distance: number;
}

export interface IEnemy {
  readonly x: number;
  readonly y: number;
  readonly health: number;
  readonly speed: number;
  readonly type?: EnemyType;
}

export interface ISpawnPoint {
  readonly x: number;
  readonly y: number;
}

export interface ISpawnMetadata {
  readonly enemyType: EnemyType;
  readonly count: number;
  readonly interval: number;
  readonly spawnPoint: ISpawnPoint;
}

export interface IWave {
  readonly delay: number;
  readonly count: number;
  readonly enemyType: EnemyType;
  readonly spawn: ISpawnMetadata;
}

export interface ILevelData {
  readonly id: number;
  readonly name: string;
  readonly enemies: readonly IEnemy[];
  readonly waves: readonly IWave[];
  readonly spawnings: readonly ISpawnMetadata[];
  readonly enemyDifficulty: number;
  readonly goldReward: number;
  readonly towerHealth: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds extends Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
