import type { Application, Container, Texture } from 'pixi.js';
import type { SandboxSettings } from '../data/sandbox';
import type { ProjectileType } from '../types';
import type { DomUi } from '../ui/DomUi';

export type SceneName = 'menu' | 'sandbox' | 'animationLab' | 'game';

export interface GameTextures {
  tower: Texture;
  towerEnemy: Texture;
  /** One texture per projectile type. */
  arrows: Record<ProjectileType, Texture>;
}

/** A sandbox run in progress: which wave is next and the health carried between waves. */
export interface RunState {
  waveIndex: number;
  bowmanHealth: number;
  keepHealth: number;
  enemyKeepHealth: number;
}

/** State that survives between scenes. */
export interface GameSession {
  /** Setup from the sandbox screen (remembered in localStorage). */
  sandbox: SandboxSettings;
  run: RunState;
  /** Draw the predicted arrow path while aiming (settings drawer). */
  showTrajectory: boolean;
}

export interface GameContext {
  readonly app: Application;
  /** Stage container owned by the active scene; emptied on every scene change. */
  readonly root: Container;
  readonly ui: DomUi;
  readonly textures: GameTextures;
  readonly session: GameSession;
  goTo(scene: SceneName): void;
}

/** Base class for scenes: tracks listeners and other teardown so exit() cleans up automatically. */
export abstract class Scene {
  private disposers: Array<() => void> = [];

  public constructor(protected readonly ctx: GameContext) {}

  public abstract enter(): void;

  public update(_deltaMs: number): void {}

  public exit(): void {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
  }

  protected onExit(dispose: () => void): void {
    this.disposers.push(dispose);
  }

  protected listenWindow<K extends keyof WindowEventMap>(type: K, handler: (event: WindowEventMap[K]) => void): void {
    window.addEventListener(type, handler);
    this.onExit(() => window.removeEventListener(type, handler));
  }
}
