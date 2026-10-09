import type { SoundId } from '../audio/SoundManager';
import type { ManualInput } from '../input/PlayerInput';
import type Arrow from '../objects/Arrow';
import DragonEnemy from '../objects/DragonEnemy';
import type Tower from '../objects/Tower';
import type { Player } from '../scenes/PlayerControl';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { Foe } from '../systems/CombatSystem';
import type { EnemyType, ProjectileType, Vec2 } from '../types';
import { fromNetAim, type EndInfo, type GameEvent, type InputMessage, type Snapshot } from './protocol';
import type { Transport } from './Transport';

/** Frames (snapshot + events) go to the guest this often. */
const FRAME_MS = 50;

/** What the host's battle exposes to the sync. */
export interface HostWorld {
  readonly players: readonly Player[];
  readonly enemies: readonly Foe[];
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
}

/** A launched arrow, as the guest needs it to fly the same arrow. */
export interface ArrowLaunch {
  owner: number;
  type: ProjectileType;
  from: Vec2;
  angle: number;
  speed: number;
  hostile: boolean;
  shooter?: EnemyType;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * Co-op host side: gives every enemy and arrow an id, listens to them (and to the bowmen and effects) for
 * events, and sends a frame with the world's state 20 times a second. The guest's controls arrive as
 * `input` messages and drive player 2 (a ManualInput).
 */
export class HostSync {
  private events: GameEvent[] = [];
  private sinceFrameMs = 0;
  private readonly enemyIds = new Map<Foe, number>();
  private nextEnemyId = 1;
  private nextArrowId = 1;

  public constructor(
    private readonly transport: Transport,
    private readonly world: HostWorld,
    guestInput: ManualInput,
  ) {
    transport.onMessage((message) => {
      if (message.t === 'input') {
        HostSync.applyInput(guestInput, message);
      }
    });
  }

  private static applyInput(input: ManualInput, message: InputMessage): void {
    input.set({ direction: message.direction, sprint: message.sprint, aim: message.aim ? fromNetAim(message.aim) : undefined });
    if (message.jump) {
      input.pressJump();
    }
    if (message.exit) {
      input.pressExit();
    }
    message.shots.forEach((shot) => input.shoot(fromNetAim(shot)));
    if (message.burst) {
      input.pressBurst();
    }
    if (message.projectile) {
      input.pickProjectile(message.projectile);
    }
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
        ignited: () => this.push({ e: 'ignite', player: index }),
      };
    });
  }

  /** A new enemy: the guest spawns it too, and replays its hits and swings. */
  public trackEnemy(enemy: Foe, type: EnemyType): void {
    const id = this.nextEnemyId;
    this.nextEnemyId += 1;
    this.enemyIds.set(enemy, id);
    this.push({ e: 'spawn', id, type });
    if (enemy instanceof DragonEnemy) {
      enemy.netHooks = { damaged: (amount, hit) => this.push({ e: 'hit', id, amount, hit: hit ?? { cause: 'arrow', fromX: enemy.x } }) };
    } else {
      enemy.netHooks = {
        damaged: (amount, hit) => this.push({ e: 'hit', id, amount, hit }),
        attacked: (style) => this.push({ e: 'attack', id, style }),
        healed: (amount) => this.push({ e: 'heal', id, amount }),
        cast: () => this.push({ e: 'cast', id }),
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
    };
  }

  public sound(id: SoundId, at: Vec2): void {
    this.push({ e: 'sound', id, x: round(at.x), y: round(at.y) });
  }

  public update(deltaMs: number): void {
    this.sinceFrameMs += deltaMs;
    if (this.sinceFrameMs >= FRAME_MS) {
      this.flush();
    }
  }

  /** The level is over: the last frame, then what the guest's end screen shows. */
  public sendEnd(info: EndInfo): void {
    this.flush();
    this.transport.send({ t: 'end', info });
  }

  private flush(): void {
    this.sinceFrameMs = 0;
    this.transport.send({ t: 'frame', snap: this.snapshot(), events: this.events });
    this.events = [];
  }

  private snapshot(): Snapshot {
    const { players, enemies, playerTower, enemyTower } = this.world;
    const living = enemies.filter((enemy) => enemy.isAlive() && this.enemyIds.has(enemy));
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
    };
  }
}
