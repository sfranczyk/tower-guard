import type { SoundId } from '../audio/SoundManager';
import type { RunState } from '../core/Scene';
import type { Loadout } from '../data/loadout';
import type { SandboxSettings } from '../data/sandbox';
import type { AimInput } from '../managers/InputManager';
import type { HitInfo, RiderOff, ThrowNet } from '../objects/enemy/Enemy';
import type { FallKind } from '../rendering/stickmanFall';
import type { AttackStyle } from '../rendering/attackSwing';
import type { ProjectileType, UnitType } from '../types';
import type { Team } from '../data/moba';
import type { UpgradeLevels } from '../data/upgrades';
import type { AfflictionNet } from '../objects/AfflictionLayer';
import type { BowmanNet } from '../objects/bowman/Bowman';
import type { EffectKind } from '../systems/EffectsSystem';
import type { WireSnapshot } from './snapCodec';

/**
 * Co-op messages (host-authoritative): the host runs the battle and sends, 20 times a second, the events since the
 * last time (`events`, reliable) and a snapshot of the world (`state`, lossy: a lost one is simply superseded); the
 * guest sends its held controls as lossy `input` and its one-off actions in a reliable one. Plain JSON over the
 * transport (PeerJS data channels, or BroadcastChannel between two tabs).
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

/**
 * Guest → host: held controls (`n` counts up: an older one arriving late is ignored), plus, only in the reliable
 * ones, the one-off actions since the last message.
 */
export interface InputMessage {
  t: 'input';
  n: number;
  direction: number;
  sprint: boolean;
  aim?: NetAim;
  jump?: true;
  /** Leave the keep (S). */
  exit?: true;
  shots?: NetAim[];
  burst?: true;
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
  /** Friendly fire: frost, a vortex, a throw, a pin (Bowman.getNetState). */
  net?: BowmanNet;
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
  /** Burning, chilled, frozen or held by a vortex (fire, frost and vortex arrows). */
  af?: AfflictionNet;
  /** Thrown through the air by a vortex. */
  th?: ThrowNet;
  /** The priest's mana. */
  mana?: number;
  /** The priest ran dry (no casting until it refills; its bar greys). */
  drained?: true;
  /** A shaman's lasting spell: [index in LASTING_BUFFS, ms left]. */
  bf?: [number, number];
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
  /** Which side of its target it hovers on (1: right, facing left); the guest plays the turn itself. */
  side: 1 | -1;
  af?: AfflictionNet;
  /** The flight look (wings held spread 0..1, nose-down pitch, wing beat speed). */
  fl?: [number, number, number];
}

export interface Snapshot {
  bowmen: BowmanSnap[];
  enemies: EnemySnap[];
  dragons: DragonSnap[];
  keep: number;
  enemyKeep: number;
  /** Survival: ms left on the level's clock. */
  clock?: number;
}

export type { EffectKind };

/**
 * Where an enemy appears when it doesn't walk in: a mounted knight's rider leaving the saddle at `x` (thrown away from
 * `thrownFrom`, or lifted out by a vortex), with the health he has left (Enemy's RiderOff).
 */
export interface SpawnPlace extends RiderOff {
  x: number;
}

/** Things that happen once, in order. */
export type GameEvent =
  /** A new enemy; `place` when it doesn't walk in (a mounted knight's rider, thrown off where his horse stood). */
  | { e: 'spawn'; id: number; type: UnitType; place?: SpawnPlace; m?: MinionSpawn }
  /** A vortex pulled a mounted knight's rider out of the saddle: his horse bolts (the rider comes as a `spawn`). */
  | { e: 'unseat'; id: number }
  /** An enemy takes damage (the guest runs the same takeDamage, so the same reaction plays). */
  | { e: 'hit'; id: number; amount: number; hit: HitInfo; push?: number }
  /** A swing (`style`: which of its swings). */
  | { e: 'attack'; id: number; style?: AttackStyle }
  /** A priest casts its heal (`cast`), and an enemy gets health back (`heal`). */
  | { e: 'cast'; id: number }
  | { e: 'heal'; id: number; amount: number }
  /** The enemies won: all of them cheer. */
  | { e: 'cheer' }
  | { e: 'arrow'; id: number; owner: number; type: ProjectileType; x: number; y: number; angle: number; speed: number; hostile: boolean; shooter?: UnitType }
  /** An arrow stuck into an enemy (at a world point) or the ground. */
  | { e: 'stick'; id: number; enemy?: number; x: number; y: number }
  | { e: 'gone'; id: number }
  /** A fire arrow put out in flight by the rain (systems/weatherArrows.ts): it flies on as a plain one. */
  | { e: 'douse'; id: number }
  | { e: 'fx'; kind: EffectKind; x: number; y: number; scale?: number }
  /** `by`: only that player hears `id` (an ally curse), the others `soundFor`'s stand-in. */
  | { e: 'sound'; id: SoundId; x: number; y: number; by?: number }
  | { e: 'knock'; player: number; fromX: number; strength: number }
  | { e: 'ignite'; player: number; gen?: number }
  /** A bowman falls: in this fall (stickmanFall), hit from `fromX`. */
  | { e: 'die'; player: number; kind: FallKind; fromX: number }
  /** A status line message for one player. */
  | { e: 'status'; player: number; text: string }
  /** The wind changed mid-level (systems/windShift.ts). */
  | { e: 'wind'; wind: number }
  /** MOBA: the purses, vaults and upgrade levels changed (sent whole: they are small). */
  | ({ e: 'moba' } & MobaNet)
  /** MOBA: a last hit paid `player` (or cost him) `delta` gold, shown at (x, y) to him. */
  | { e: 'gold'; player: number; x: number; y: number; delta: number }
  /** MOBA: a fallen player is back at his keep. */
  | { e: 'revive'; player: number; x: number }
  /** MOBA: the sky's seed and the match time (ms) its clock is at (scenes/MobaSky.ts, every few seconds). */
  | { e: 'sky'; seed: number; t: number }
  /** MOBA: eclipse `n`'s comet was struck (it bursts). */
  | { e: 'comet'; n: number };

/** MOBA: a lane minion's side and level (its health, damage and stars). */
export interface MinionSpawn {
  team: Team;
  lv: number;
}

/** MOBA's economy as the guests see it. */
export interface MobaNet {
  gold: number[];
  vault: Record<Team, number>;
  /** Each player's upgrade levels, by player index. */
  lv: UpgradeLevels[];
  /** Each team's. */
  tlv: Record<Team, UpgradeLevels>;
  /** The players healing now (their HUD shows the regeneration icon). */
  rg: number[];
}

/** What the guest's end screen shows (the host decides what comes next). */
export interface EndInfo {
  title: string;
  outcome: 'win' | 'loss';
  copy: string;
  stats: Array<{ label: string; value: string }>;
  /** MOBA: the team that won (each guest's screen says it from its own team's side). */
  winner?: Team;
}

export type NetMessage =
  /** Guest → host on connecting. */
  | { t: 'hello' }
  /**
   * Host → each guest, on joining and on every change in the room: the guest's player index (`you`), who is in
   * (`present`, by player index, the host first), everyone's quiver (null until picked) and alias (null: none).
   */
  | { t: 'roster'; you: number; present: boolean[]; loadouts: Array<Loadout | null>; teams?: Array<Team | null>; aliases?: Array<string | null> }
  /** Guest → host, MOBA lobby: the team this player wants (handled by net/coopLink). */
  | { t: 'team'; team: Team }
  /** Guest → host, MOBA: buy the next level of upgrade `buy`, or move `step` vault gold (`deposit`: in, else out). */
  | { t: 'shop'; buy?: string; deposit?: boolean; step?: number }
  /** Host → a guest who knocked on a full room (then the link closes). */
  | { t: 'full' }
  /** Host → guest: a level starts with this setup (the guest builds the same battlefield). */
  | { t: 'start'; sandbox: SandboxSettings; run: RunState; wind: number; moba?: boolean; teams?: Team[] }
  /** Host → guest, reliable: what happened since the last `events`. */
  | { t: 'events'; events: GameEvent[] }
  /** Host → guest, lossy: the world (`n` counts up, `ht` is the host's performance.now()). */
  | { t: 'state'; n: number; ht: number; snap: WireSnapshot }
  /** Either way, lossy: how long the round trip takes (the other side answers `pong` with the same `at`). */
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  | { t: 'end'; info: EndInfo }
  /** Host → guest: the host went back to the battle setup. */
  | { t: 'lobby' }
  /** Guest → host: the guest's own quiver (sent on joining and on every change; handled by net/coopLink). */
  | { t: 'loadout'; loadout: Loadout }
  /** Guest → host: the guest's alias (sent on joining and on every change; handled by net/coopLink). */
  | { t: 'alias'; alias: string }
  /** Guest → host: Esc asks to pause or resume; host → guest: the battle is paused or resumed (both screens). */
  | { t: 'pause'; paused: boolean }
  | InputMessage;
