import type { Application, Container, Texture } from 'pixi.js';
import type { SandboxSettings } from '../data/sandbox';
import type { ProjectileType } from '../types';
import type { SoundManager } from '../audio/SoundManager';
import type { DomUi } from '../ui/DomUi';
import type { Transport } from '../net/Transport';

export type SceneName = 'menu' | 'coop' | 'sandbox' | 'animationLab' | 'soundLab' | 'designLab' | 'game';

/** Co-op online: this browser's role, the room and the link to the other browser. */
export interface NetLink {
  role: 'host' | 'guest';
  code: string;
  transport: Transport;
  /** Guest: the wind of the wave the host started (the host rolls it). */
  wind: number;
}

export interface GameTextures {
  /** One texture per projectile type. */
  arrows: Record<ProjectileType, Texture>;
}

/** A sandbox run in progress: which wave is next and the health carried between waves. */
export interface RunState {
  waveIndex: number;
  /** One per player; a bowman at 0 stays fallen for the rest of the run. */
  bowmanHealths: number[];
  keepHealth: number;
  enemyKeepHealth: number;
}

/** A fresh run: wave 1, every bowman and both keeps at full health. */
export const newRun = (sandbox: SandboxSettings, playerCount: number, enemyKeepHealth: number): RunState => ({
  waveIndex: 0,
  bowmanHealths: Array.from({ length: playerCount }, () => sandbox.bowmanHealth),
  keepHealth: sandbox.keepHealth,
  enemyKeepHealth,
});

/** State that survives between scenes. */
export interface GameSession {
  /** Setup from the sandbox screen (remembered in localStorage). */
  sandbox: SandboxSettings;
  run: RunState;
  /** Bowmen in the battle: 1, or 2 in co-op (online, or `?coop` for a local test with player 2 driven from the console). */
  playerCount: number;
  /** Set while playing co-op online. */
  net?: NetLink;
  /** Shown once in the co-op lobby (e.g. "The host left"). */
  coopNotice?: string;
  /** Draw the predicted arrow path while aiming (settings drawer, off by default). */
  showTrajectory: boolean;
  /** How many of the latest shots keep their trail (settings drawer, 0 = none, up to MAX_ARROW_TRAILS). */
  arrowTrails: number;
}

export interface GameContext {
  readonly app: Application;
  /** Stage container owned by the active scene; emptied on every scene change. */
  readonly root: Container;
  readonly ui: DomUi;
  readonly textures: GameTextures;
  readonly sound: SoundManager;
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
