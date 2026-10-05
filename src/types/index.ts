export type EnemyType = 'basic' | 'fast' | 'tank' | 'archer';
export type ProjectileType = 'normal' | 'explosive' | 'piercing';

export interface IPushStrength {
  readonly value: number;
  readonly max: number;
  readonly distance: number;
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
