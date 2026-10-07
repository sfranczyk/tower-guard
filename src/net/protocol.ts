import type { SoundId } from '../audio/SoundManager';
import type { RunState } from '../core/Scene';
import type { SandboxSettings } from '../data/sandbox';
import type { AimInput } from '../managers/InputManager';
import type { HitInfo } from '../objects/Enemy';
import type { EnemyType, ProjectileType } from '../types';

/**
 * Co-op messages (host-authoritative): the host runs the battle and sends `frame`s (a snapshot of the world
 * plus the events since the last frame); the guest sends its controls as `input`. Plain JSON over the
 * transport (PeerJS data channel, or BroadcastChannel between two tabs).
 */

/** A drawn bow on the wire: direction, power, and the drag's start and current points (for the aim overlay). */
export interface NetAim {
  dx: number;
  dy: number;
  power: number;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
}

export const toNetAim = (aim: AimInput): NetAim => ({
  dx: aim.direction.x,
  dy: aim.direction.y,
  power: aim.power,
  sx: aim.start.x,
  sy: aim.start.y,
  cx: aim.current.x,
  cy: aim.current.y,
});

export const fromNetAim = (aim: NetAim): AimInput => ({
  direction: { x: aim.dx, y: aim.dy },
  power: aim.power,
  strength: { value: aim.power, max: 1, distance: aim.power },
  start: { x: aim.sx, y: aim.sy },
  current: { x: aim.cx, y: aim.cy },
});

/** Guest → host: held controls, plus the one-off actions since the last message. */
export interface InputMessage {
  t: 'input';
  direction: number;
  sprint: boolean;
  aim?: NetAim;
  jump: boolean;
  shots: NetAim[];
  burst: boolean;
  projectile?: ProjectileType;
}

export interface BowmanSnap {
  x: number;
  y: number;
  /** Aim direction and draw power (the bow follows them). */
  ax: number;
  ay: number;
  power: number;
  /** Horizontal speed (drives the walk/run animation). */
  vx: number;
  inTower: boolean;
  health: number;
}

/** A ground enemy: position and walking speed; archers also their bow (world aim angle, draw and raise 0..1). */
export interface EnemySnap {
  id: number;
  x: number;
  y: number;
  vx: number;
  aim?: number;
  tension?: number;
  ready?: number;
  /** Time left pinned to the ground (ms). */
  pinned?: number;
}

/** A dragon: position, the archer rider's bow, and the fire dragon's breath (ms into it) and aim. */
export interface DragonSnap {
  id: number;
  x: number;
  y: number;
  aim: number;
  tension: number;
  breathMs?: number;
  fireAim: number;
}

export interface Snapshot {
  bowmen: BowmanSnap[];
  enemies: EnemySnap[];
  dragons: DragonSnap[];
  keep: number;
  enemyKeep: number;
}

export type EffectKind = 'blood' | 'greenBlood' | 'impact' | 'explosion' | 'lightning';

/** Things that happen once, in order. */
export type GameEvent =
  | { e: 'spawn'; id: number; type: EnemyType }
  /** An enemy takes damage (the guest runs the same takeDamage, so the same reaction plays). */
  | { e: 'hit'; id: number; amount: number; hit: HitInfo; push?: number }
  | { e: 'attack'; id: number }
  /** The enemies won: all of them cheer. */
  | { e: 'cheer' }
  | { e: 'arrow'; id: number; owner: number; type: ProjectileType; x: number; y: number; angle: number; speed: number; hostile: boolean; shooter?: EnemyType }
  /** An arrow stuck into an enemy (at a world point) or the ground. */
  | { e: 'stick'; id: number; enemy?: number; x: number; y: number }
  | { e: 'gone'; id: number }
  | { e: 'fx'; kind: EffectKind; x: number; y: number }
  | { e: 'sound'; id: SoundId; x: number; y: number }
  | { e: 'knock'; player: number; fromX: number; strength: number }
  | { e: 'ignite'; player: number }
  | { e: 'die'; player: number }
  /** A status line message for one player. */
  | { e: 'status'; player: number; text: string };

/** What the guest's end screen shows (the host decides what comes next). */
export interface EndInfo {
  title: string;
  outcome: 'win' | 'loss';
  copy: string;
  stats: Array<{ label: string; value: string }>;
}

export type NetMessage =
  /** Guest → host on connecting. */
  | { t: 'hello' }
  /** Host → guest: connected, waiting in the lobby. */
  | { t: 'welcome' }
  /** Host → guest: a wave starts with this setup (the guest builds the same battlefield). */
  | { t: 'start'; sandbox: SandboxSettings; run: RunState; wind: number }
  | { t: 'frame'; snap: Snapshot; events: GameEvent[] }
  | { t: 'end'; info: EndInfo }
  /** Host → guest: the host went back to the battle setup. */
  | { t: 'lobby' }
  | InputMessage;
