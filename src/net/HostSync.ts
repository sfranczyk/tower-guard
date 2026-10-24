import type { SoundId } from '../audio/SoundManager';
import type { ManualInput } from '../input/PlayerInput';
import type Arrow from '../objects/Arrow';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Tower from '../objects/Tower';
import type { Player } from '../scenes/PlayerControl';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { Foe } from '../systems/CombatSystem';
import type { ProjectileType, UnitType, Vec2 } from '../types';
import { fromNetAim, type EndInfo, type GameEvent, type InputMessage, type MinionSpawn, type NetMessage, type Snapshot, type SpawnPlace } from './protocol';
import { encodeSnapshot } from './snapCodec';
import type { RoomLink } from './Transport';

/** Frames (snapshot + events) go to the guests this often. */
export const FRAME_MS = 50;
/** A guest whose controls stop coming this long lets go of them (else a stalled link keeps him walking). */
const INPUT_STALE_MS = 400;
/** Each side measures the round trip this often (the ?debug readout). */
export const PING_MS = 1000;

/** What the host's battle exposes to the sync. */
export interface HostWorld {
  readonly players: readonly Player[];
  readonly enemies: readonly Foe[];
  /** MOBA: the blue minions (soldiers and dragons), sent like the enemies. */
  readonly allies?: () => readonly Foe[];
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  /** Survival: the time left on the level's clock. */
  readonly clock?: () => number;
}

/** A launched arrow, as the guest needs it to fly the same arrow. */
export interface ArrowLaunch {
  owner: number;
  type: ProjectileType;
  from: Vec2;
  angle: number;
  speed: number;
  hostile: boolean;
  shooter?: UnitType;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * Co-op host side: gives every enemy and arrow an id, listens to them (and to the bowmen and effects) for
 * events, and sends every guest a frame with the world's state 20 times a second. Each guest's controls arrive
 * as `input` messages and drive their own player (a ManualInput).
 */
export class HostSync {
  private events: GameEvent[] = [];
  private sinceFrameMs = 0;
  private readonly enemyIds = new Map<Foe, number>();
  private nextEnemyId = 1;
  private nextArrowId = 1;
  private stateSeq = 0;
  private sincePingMs = 0;
  /** By player: the newest held controls applied, when any input last came, the round trip (ms). */
  private readonly inputSeq: number[] = [];
  private readonly inputAt: Array<number | undefined> = [];
  private readonly rtt: number[] = [];
  /** A guest pressed Esc (the host decides and answers with `sendPause`). */
  public onPauseRequest?: (paused: boolean, from: number) => void;
  /** MOBA: a guest buys in the shop or moves vault gold (the host decides). */
  public onShop?: (message: Extract<NetMessage, { t: 'shop' }>, from: number) => void;

  public constructor(
    private readonly transport: RoomLink,
    private readonly world: HostWorld,
  ) {
    transport.onMessage((message, from) => {
      const guest = from > 0 ? world.players[from] : undefined;
      if (message.t === 'input') {
        // A guest who joined mid-level has no bowman until the next one.
        if (guest) {
          this.applyInput(from, guest.input as ManualInput, message);
        }
      } else if (message.t === 'ping') {
        transport.sendTo(from, { t: 'pong', at: message.at });
      } else if (message.t === 'pong') {
        const sample = performance.now() - message.at;
        this.rtt[from] = this.rtt[from] === undefined ? sample : this.rtt[from] + (sample - this.rtt[from]) * 0.3;
      } else if (message.t === 'pause') {
        this.onPauseRequest?.(message.paused, from);
      } else if (message.t === 'shop' && guest) {
        this.onShop?.(message, from);
      }
    });
  }

  private applyInput(from: number, input: ManualInput, message: InputMessage): void {
    this.inputAt[from] = performance.now();
    // Held controls come lossy and unordered: only newer ones count (the one-off actions always do).
    if (message.n > (this.inputSeq[from] ?? -1)) {
      this.inputSeq[from] = message.n;
      input.set({ direction: message.direction, sprint: message.sprint, aim: message.aim ? fromNetAim(message.aim) : undefined });
    }
    if (message.jump) {
      input.pressJump();
    }
    if (message.exit) {
      input.pressExit();
    }
    message.shots?.forEach((shot) => input.shoot(fromNetAim(shot)));
    if (message.burst) {
      input.pressBurst();
    }
    if (message.projectile) {
      input.pickProjectile(message.projectile);
    }
  }

  /** Pauses or resumes the guests' battles along with the host's. */
  public sendPause(paused: boolean): void {
    this.transport.send({ t: 'pause', paused });
  }

  public push(event: GameEvent): void {
    this.events.push(event);
  }

  /** Effects and the bowmen's knockdowns, fires and so on are replayed on the guest. */
  public watch(effects: EffectsSystem): void {
    effects.onEffect = (kind, point, scale) => this.push({ e: 'fx', kind, x: round(point.x), y: round(point.y), scale });
    this.world.players.forEach(({ bowman, index }) => {
      bowman.netHooks = {
        knockedBack: (fromX, strength) => this.push({ e: 'knock', player: index, fromX, strength }),
        ignited: (gen) => this.push({ e: 'ignite', player: index, gen: gen || undefined }),
      };
    });
  }

  /** A new enemy (MOBA: or a lane minion of either side, `minion`): the guest spawns it too, and replays its hits and swings. */
  public trackEnemy(enemy: Foe, type: UnitType, place?: SpawnPlace, minion?: MinionSpawn): void {
    const id = this.nextEnemyId;
    this.nextEnemyId += 1;
    this.enemyIds.set(enemy, id);
    this.push({ e: 'spawn', id, type, place, m: minion });
    if (enemy instanceof DragonEnemy) {
      enemy.netHooks = { damaged: (amount, hit) => this.push({ e: 'hit', id, amount, hit: hit ?? { cause: 'arrow', fromX: enemy.x } }) };
    } else {
      enemy.netHooks = {
        damaged: (amount, hit) => this.push({ e: 'hit', id, amount, hit }),
        attacked: (style) => this.push({ e: 'attack', id, style }),
        healed: (amount) => this.push({ e: 'heal', id, amount }),
        cast: () => this.push({ e: 'cast', id }),
        unseated: () => this.push({ e: 'unseat', id }),
      };
    }
  }

  /** A new arrow: the guest launches the same one, and hears where it sticks or that it's gone. */
  public trackArrow(arrow: Arrow, launch: ArrowLaunch): void {
    const id = this.nextArrowId;
    this.nextArrowId += 1;
    this.push({
      e: 'arrow', id, owner: launch.owner, type: launch.type, x: launch.from.x, y: launch.from.y,
      angle: launch.angle, speed: launch.speed, hostile: launch.hostile, shooter: launch.shooter,
    });
    arrow.netHooks = {
      stuck: (target, point) => {
        const enemy = target ? this.enemyIds.get(target as Foe) : undefined;
        this.push({ e: 'stick', id, enemy, x: point.x, y: point.y });
      },
      gone: () => this.push({ e: 'gone', id }),
      doused: () => this.push({ e: 'douse', id }),
    };
  }

  public sound(id: SoundId, at: Vec2): void {
    this.push({ e: 'sound', id, x: round(at.x), y: round(at.y) });
  }

  public update(deltaMs: number): void {
    this.sinceFrameMs += deltaMs;
    if (this.sinceFrameMs >= FRAME_MS) {
      // Keep the 20 Hz pace on hosts running at 30 or 50 fps (but don't catch up after a stall).
      this.sinceFrameMs = Math.min(this.sinceFrameMs - FRAME_MS, FRAME_MS);
      this.flush();
    }
    this.sincePingMs += deltaMs;
    if (this.sincePingMs >= PING_MS) {
      this.sincePingMs = 0;
      this.transport.send({ t: 'ping', at: performance.now() });
    }
    this.releaseStaleInputs();
  }

  /** The round trip to each guest (ms, by player index; the ?debug readout). */
  public roundTrips(): readonly number[] {
    return this.rtt;
  }

  private releaseStaleInputs(): void {
    const now = performance.now();
    this.world.players.forEach(({ input, index }) => {
      const at = this.inputAt[index];
      if (index > 0 && at !== undefined && now - at > INPUT_STALE_MS) {
        (input as ManualInput).set({ direction: 0, sprint: false, aim: undefined });
        this.inputAt[index] = undefined;
      }
    });
  }

  /** The level is over: the last frame, then what the guest's end screen shows. */
  public sendEnd(info: EndInfo): void {
    this.sinceFrameMs = 0;
    this.flush();
    this.transport.send({ t: 'end', info });
  }

  /** Events reliably (when there are any), then the world, lossy. */
  private flush(): void {
    if (this.events.length > 0) {
      this.transport.send({ t: 'events', events: this.events });
      this.events = [];
    }
    this.transport.sendState({ t: 'state', n: this.stateSeq, ht: performance.now(), snap: encodeSnapshot(this.snapshot()) });
    this.stateSeq += 1;
  }

  private snapshot(): Snapshot {
    const { players, enemies, playerTower, enemyTower } = this.world;
    const living = [...enemies, ...(this.world.allies?.() ?? [])].filter((enemy) => enemy.isAlive() && this.enemyIds.has(enemy));
    return {
      bowmen: players.map(({ bowman, health }) => {
        const aim = bowman.getAim();
        const net = bowman.getNetState();
        return {
          x: round(bowman.x), y: round(bowman.y), vx: round(bowman.velocityX),
          ax: aim.direction.x, ay: aim.direction.y, power: aim.power,
          inTower: bowman.isInTower, health,
          net: net.af || net.th || net.pin ? net : undefined,
        };
      }),
      enemies: living.filter((enemy) => !(enemy instanceof DragonEnemy)).map((enemy) => ({
        id: this.enemyIds.get(enemy)!,
        x: round(enemy.x),
        y: round(enemy.y),
        ...(enemy as Exclude<Foe, DragonEnemy>).getNetState(),
      })),
      dragons: living.filter((enemy): enemy is DragonEnemy => enemy instanceof DragonEnemy).map((dragon) => ({
        id: this.enemyIds.get(dragon)!,
        x: round(dragon.x),
        y: round(dragon.y),
        ...dragon.getNetState(),
      })),
      keep: playerTower.getHealth(),
      enemyKeep: enemyTower.getHealth(),
      clock: this.world.clock ? Math.round(this.world.clock()) : undefined,
    };
  }
}
