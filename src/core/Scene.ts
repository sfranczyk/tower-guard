import type { Application, Container, Texture } from 'pixi.js';
import { enemyKeepHealth } from '../data/difficulty';
import type { Loadout } from '../data/loadout';
import type { Team } from '../data/moba';
import type { SandboxSettings } from '../data/sandbox';
import type { ProjectileType } from '../types';
import type { SoundManager } from '../audio/SoundManager';
import type { DomUi } from '../ui/DomUi';
import type { RoomLink } from '../net/Transport';

export type SceneName = 'menu' | 'coop' | 'sandbox' | 'animationLab' | 'soundLab' | 'designLab' | 'game';

/** Co-op online: this browser's role, the room and the links to the other browsers (net/coopLink.ts). */
export interface NetLink {
  role: 'host' | 'guest';
  code: string;
  transport: RoomLink;
  /** This browser's player: the host 0, a guest the seat the host gave them (1–3). */
  localIndex: number;
  /** Who is in the room, by player index (the host first); a seat left mid-run stays empty until the lobby. */
  present: boolean[];
  /** Host: a battle is on (seats keep their numbers until it's back in the lobby or the setup). */
  inBattle: boolean;
  /** Guest: the wind of the level the host started (the host rolls it). */
  wind: number;
  /**
   * Each player's quiver, by player index (0 the host): each picks their own (the host on the battle setup's Quiver
   * page, a guest in the lobby); the host passes them all round in the roster; undefined until picked.
   */
  loadouts: Array<Loadout | undefined>;
}

export interface GameTextures {
  /** One texture per projectile type. */
  arrows: Record<ProjectileType, Texture>;
}

/** A sandbox run in progress: which level is next and the health carried between levels. */
export interface RunState {
  levelIndex: number;
  /** One per player; a bowman at 0 stays fallen for the rest of the run. */
  bowmanHealths: number[];
  keepHealth: number;
  enemyKeepHealth: number;
}

/** A fresh run: level 1, every bowman and both keeps at full health (the enemy's by the difficulty, `enemyKeepHealth`). */
export const newRun = (sandbox: SandboxSettings, playerCount: number): RunState => ({
  levelIndex: 0,
  bowmanHealths: Array.from({ length: playerCount }, () => sandbox.bowmanHealth),
  keepHealth: sandbox.keepHealth,
  enemyKeepHealth: enemyKeepHealth(sandbox.difficulty, sandbox.keepHealth),
});

/** Whether the session is played by more than one bowman (online co-op, or the local `?coop` test). */
export const isMultiplayer = (session: Pick<GameSession, 'net' | 'playerCount'>): boolean =>
  session.net !== undefined || session.playerCount > 1;

/** State that survives between scenes. */
export interface GameSession {
  /** Setup from the sandbox screen (remembered in localStorage). */
  sandbox: SandboxSettings;
  run: RunState;
  /** Bowmen in the battle: 1, or 2 in co-op (online, or `?coop` for a local test with player 2 driven from the console). */
  playerCount: number;
  /** Set while playing co-op online. */
  net?: NetLink;
  /** MOBA mode (`?moba`, dev only for now): battles are two keeps sending lane minions at each other (scenes/BattleLanes.ts). */
  moba?: boolean;
  /** MOBA: each player's team, by player index (the lobby's pick; none: alternating, data/moba `mobaTeamOf`). */
  teams?: Team[];
  /** MOBA: each player's quiver, the normal arrow and the ones bought (it replaces the battle setup's). */
  mobaLoadouts?: Loadout[];
  /** Shown once in the co-op lobby (e.g. "The host left"). */
  coopNotice?: string;
  /** Draw the predicted arrow path while aiming (settings drawer, off by default). */
  showTrajectory: boolean;
  /** Draw the aim circles at the drag start too, not just at the bow (settings drawer, on by default). */
  showCursorCircle: boolean;
  /** Hit visibility: damage numbers over an enemy's head on an arrow hit (settings drawer, on by default). */
  showDamageNumbers: boolean;
  /** Banners: their state in the HUD and markers at the view's edge for a carried one out of view (settings drawer, on). */
  bannerMarkers: boolean;
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
