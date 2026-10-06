export type EnemyType = 'basic' | 'fast' | 'tank' | 'archer';
/** 'fragment' is one of the small arrows a shrapnel arrow bursts into (not selectable). */
export type ProjectileType = 'normal' | 'explosive' | 'piercing' | 'shrapnel' | 'fragment';

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
