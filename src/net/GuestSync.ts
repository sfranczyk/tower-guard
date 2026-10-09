import type { SoundId } from '../audio/SoundManager';
import type { RecordingInput } from '../input/PlayerInput';
import type { AimInput } from '../managers/InputManager';
import type Arrow from '../objects/Arrow';
import DragonEnemy from '../objects/DragonEnemy';
import type Enemy from '../objects/Enemy';
import type Tower from '../objects/Tower';
import { HUMAN_BODY, ZOMBIE_BODY } from '../rendering/bodyColors';
import type { Player } from '../scenes/PlayerControl';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { Foe } from '../systems/CombatSystem';
import { groundAt } from '../systems/terrain';
import type { EnemyType, ProjectileType, Vec2 } from '../types';
import type { ArrowLaunch } from './HostSync';
import { toNetAim, type EndInfo, type GameEvent, type NetMessage, type Snapshot, type SpawnPlace } from './protocol';
import type { Transport } from './Transport';

/** The guest shows the world this far in the past, between two frames, so motion stays smooth. */
const INTERPOLATION_DELAY_MS = 100;
/** Controls go to the host this often. */
const INPUT_MS = 33;
/** The guest's own bowman is put where the host has him when they disagree by this much (px). */
const CORRECT_ALWAYS = 70;
/** ... or by this much once he stands still (the host's copy lags behind while he moves). */
const CORRECT_STILL = 6;
/** In or out of the keep: follow the host once it disagrees this long (it confirms a move a moment later). */
const KEEP_MISMATCH_MS = 450;

/** What the guest's battle exposes to the sync. */
export interface GuestWorld {
  readonly players: readonly Player[];
  readonly localIndex: number;
  readonly enemies: readonly Foe[];
  readonly arrows: readonly Arrow[];
  readonly effects: EffectsSystem;
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  spawnEnemy(type: EnemyType, place?: SpawnPlace): Foe;
  launchArrow(launch: ArrowLaunch): Arrow;
  playSound(id: SoundId, at: Vec2): void;
  setStatus(text: string): void;
  showEnd(info: EndInfo): void;
  /** The host started the next level (or a new battle). */
  restart(message: Extract<NetMessage, { t: 'start' }>): void;
  /** The host went back to the battle setup. */
  backToLobby(): void;
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * Co-op guest side: applies the host's events as they come (the same objects play the same reactions),
 * shows the host's state a little in the past, smoothly interpolated, flies arrows locally (same ballistics)
 * and sends its own controls. The guest's bowman moves at once and is corrected when the host disagrees.
 */
export class GuestSync {
  private readonly enemyById = new Map<number, Foe>();
  private readonly arrowById = new Map<number, Arrow>();
  private frames: Array<{ at: number; snap: Snapshot }> = [];
  private clockMs = 0;
  private sinceInputMs = 0;
  private keepMismatchMs = 0;
  private shots: AimInput[] = [];
  private burst = false;
  private projectile?: ProjectileType;

  public constructor(
    private readonly transport: Transport,
    private readonly world: GuestWorld,
    private readonly input: RecordingInput,
  ) {
    transport.onMessage((message) => this.receive(message));
  }

  /** A shot the guest released: the host looses it (the arrow comes back as an event). */
  public queueShot(aim: AimInput): void {
    this.shots.push(aim);
  }

  /** The scene dropped a gone arrow: no event can reach it any more. */
  public forgetArrow(arrow: Arrow): void {
    this.arrowById.forEach((known, id) => {
      if (known === arrow) {
        this.arrowById.delete(id);
      }
    });
  }

  public queueBurst(): void {
    this.burst = true;
  }

  public queueProjectile(type: ProjectileType): void {
    this.projectile = type;
  }

  private receive(message: NetMessage): void {
    switch (message.t) {
      case 'frame':
        message.events.forEach((event) => this.apply(event));
        this.frames.push({ at: this.clockMs, snap: message.snap });
        // Keep enough to interpolate (and a little more).
        this.frames = this.frames.filter((frame) => frame.at >= this.clockMs - INTERPOLATION_DELAY_MS * 4);
        break;
      case 'end':
        this.world.showEnd(message.info);
        break;
      case 'start':
        this.world.restart(message);
        break;
      case 'lobby':
        this.world.backToLobby();
        break;
      default:
        break;
    }
  }

  private apply(event: GameEvent): void {
    const { players, effects } = this.world;
    switch (event.e) {
      case 'spawn':
        this.enemyById.set(event.id, this.world.spawnEnemy(event.type, event.place));
        break;
      case 'unseat': {
        const enemy = this.enemyById.get(event.id);
        if (enemy && !(enemy instanceof DragonEnemy)) {
          enemy.unseat();
        }
        break;
      }
      case 'hit': {
        const enemy = this.enemyById.get(event.id);
        enemy?.applyHitReaction(0);
        enemy?.takeDamage(event.amount, event.hit);
        break;
      }
      case 'attack': {
        const enemy = this.enemyById.get(event.id);
        if (enemy && !(enemy instanceof DragonEnemy)) {
          enemy.playAttackAnimation(undefined, event.style);
        }
        break;
      }
      case 'cast':
      case 'heal': {
        const enemy = this.enemyById.get(event.id);
        if (enemy && !(enemy instanceof DragonEnemy)) {
          if (event.e === 'cast') {
            enemy.castHeal();
          } else {
            enemy.heal(event.amount);
          }
        }
        break;
      }
      case 'cheer':
        this.world.enemies.forEach((enemy) => enemy.celebrate());
        break;
      case 'arrow':
        this.arrowById.set(event.id, this.world.launchArrow({
          owner: event.owner, type: event.type, from: { x: event.x, y: event.y }, angle: event.angle,
          speed: event.speed, hostile: event.hostile, shooter: event.shooter,
        }));
        break;
      case 'stick': {
        const arrow = this.arrowById.get(event.id);
        const target = event.enemy !== undefined ? this.enemyById.get(event.enemy) : undefined;
        if (arrow && target) {
          arrow.stickToEnemy(target, { x: event.x, y: event.y });
        } else if (arrow && !arrow.isStuck) {
          arrow.position.set(event.x, event.y);
          arrow.stickToGround(event.y);
        }
        break;
      }
      case 'gone':
        this.arrowById.get(event.id)?.deactivate();
        this.arrowById.delete(event.id);
        break;
      case 'fx': {
        const point = { x: event.x, y: event.y };
        if (event.kind === 'blood' || event.kind === 'greenBlood') {
          effects.bloodBurst(point, event.kind === 'blood' ? HUMAN_BODY : ZOMBIE_BODY);
        } else if (event.kind === 'impact') {
          effects.impact(point);
        } else if (event.kind === 'explosion') {
          effects.explosion(point, event.scale);
        } else if (event.kind === 'dragonBlast') {
          effects.dragonBlast(point);
        } else if (event.kind === 'lightning') {
          effects.lightningStrike(point);
        } else if (event.kind === 'fire') {
          effects.fireBurst(point);
        } else if (event.kind === 'frost') {
          effects.frostBurst(point);
        } else if (event.kind === 'shatter') {
          effects.shatter(point);
        } else if (event.kind === 'firePatch') {
          effects.firePatch(point);
        } else if (event.kind === 'heal') {
          effects.healCrosses(point);
        } else if (event.kind === 'healPulse') {
          effects.healPulse(point);
        } else if (event.kind === 'vortex') {
          effects.vortex(point);
        } else {
          effects.vortexFade(point);
        }
        break;
      }
      case 'sound':
        this.world.playSound(event.id, { x: event.x, y: event.y });
        break;
      case 'knock':
        players[event.player]?.bowman.knockBack(event.fromX, event.strength);
        break;
      case 'ignite':
        players[event.player]?.bowman.ignite();
        break;
      case 'die':
        players[event.player]?.bowman.die({ kind: event.kind, fromX: event.fromX });
        break;
      case 'status':
        if (event.player === this.world.localIndex) {
          this.world.setStatus(event.text);
        }
        break;
    }
  }

  /** Every frame: the world as the host had it a moment ago, local arrows, and the guest's controls out. */
  public update(deltaMs: number): void {
    this.clockMs += deltaMs;
    const latest = this.frames[this.frames.length - 1]?.snap;
    if (latest) {
      this.applySnapshot(deltaMs, latest);
    }
    this.animateEnemies(deltaMs);
    this.flyArrows(deltaMs);
    this.sinceInputMs += deltaMs;
    if (this.sinceInputMs >= INPUT_MS) {
      this.sendInput();
    }
  }

  private applySnapshot(deltaMs: number, latest: Snapshot): void {
    const { players, localIndex, playerTower, enemyTower } = this.world;
    const renderAt = this.clockMs - INTERPOLATION_DELAY_MS;
    const nextIndex = this.frames.findIndex((frame) => frame.at > renderAt);
    const to = nextIndex === -1 ? this.frames[this.frames.length - 1] : this.frames[nextIndex];
    const from = nextIndex > 0 ? this.frames[nextIndex - 1] : to;
    const t = to.at === from.at ? 1 : Math.max(0, Math.min(1, (renderAt - from.at) / (to.at - from.at)));

    to.snap.enemies.forEach((state) => {
      const enemy = this.enemyById.get(state.id);
      const before = from.snap.enemies.find((candidate) => candidate.id === state.id) ?? state;
      if (enemy && !(enemy instanceof DragonEnemy)) {
        enemy.applyNetState({ ...state, x: lerp(before.x, state.x, t), y: lerp(before.y, state.y, t) });
      }
    });
    to.snap.dragons.forEach((state) => {
      const dragon = this.enemyById.get(state.id);
      const before = from.snap.dragons.find((candidate) => candidate.id === state.id) ?? state;
      if (dragon instanceof DragonEnemy) {
        dragon.applyNetState({ ...state, x: lerp(before.x, state.x, t), y: lerp(before.y, state.y, t) });
      }
    });

    players.forEach((player, index) => {
      const state = to.snap.bowmen[index];
      const before = from.snap.bowmen[index] ?? state;
      if (!state) {
        return;
      }
      player.health = latest.bowmen[index]?.health ?? player.health;
      if (index === localIndex) {
        // Friendly fire: frozen, pinned, or caught and thrown by a vortex as the host has him (then moved by the host).
        player.bowman.applyNetState(latest.bowmen[index]?.net ?? {});
        if (player.bowman.isAloft) {
          player.bowman.correctTo(lerp(before.x, state.x, t), lerp(before.y, state.y, t));
          return;
        }
        this.reconcile(player, latest.bowmen[index], deltaMs);
        return;
      }
      player.bowman.applyNetState(state.net ?? {});
      if (!player.bowman.isDead) {
        player.bowman.applyRemote({ ...state, x: lerp(before.x, state.x, t), y: lerp(before.y, state.y, t) });
      }
      player.bowman.updateAnimation(deltaMs, Math.abs(state.vx) > 1);
    });

    if (latest.keep !== playerTower.getHealth()) {
      playerTower.setHealth(latest.keep);
    }
    if (latest.enemyKeep !== enemyTower.getHealth()) {
      enemyTower.setHealth(latest.enemyKeep);
    }
  }

  /** The guest's own bowman: predicted locally; put where the host has him when they disagree too much. */
  private reconcile(player: Player, host: Snapshot['bowmen'][number], deltaMs: number): void {
    const { bowman } = player;
    if (bowman.isDead || bowman.isStunned) {
      return;
    }
    if (host.inTower !== bowman.isInTower) {
      this.keepMismatchMs += deltaMs;
      if (this.keepMismatchMs >= KEEP_MISMATCH_MS) {
        bowman.applyRemote({ ...host, power: bowman.getAim().power, ax: bowman.getAim().direction.x, ay: bowman.getAim().direction.y });
        this.keepMismatchMs = 0;
      }
      return;
    }
    this.keepMismatchMs = 0;
    if (bowman.isInTower) {
      return;
    }
    const gap = Math.hypot(host.x - bowman.x, host.y - bowman.y);
    const still = Math.abs(host.vx) < 1 && Math.abs(bowman.velocityX) < 1 && this.input.getMovementDirection() === 0;
    if (gap > CORRECT_ALWAYS || (still && gap > CORRECT_STILL)) {
      bowman.correctTo(host.x, host.y);
    }
  }

  private animateEnemies(deltaMs: number): void {
    this.world.enemies.forEach((enemy) => {
      if (enemy instanceof DragonEnemy) {
        enemy.updateAnimation(deltaMs);
      } else {
        (enemy as Enemy).updateAnimation(deltaMs, enemy.isAlive() && enemy.isMoving());
      }
    });
  }

  /** Same flight as on the host; hits come from the host, sticking into the ground is done here too. */
  private flyArrows(deltaMs: number): void {
    this.world.arrows.filter((arrow) => arrow.isActive).forEach((arrow) => arrow.update(deltaMs));
    this.world.arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck && arrow.y >= groundAt(arrow.x) - 3)
      .forEach((arrow) => {
        if (arrow.type === 'explosive') {
          arrow.deactivate();
        } else {
          arrow.stickToGround(groundAt(arrow.x) - 3);
        }
      });
  }

  private sendInput(): void {
    this.sinceInputMs = 0;
    const aim = this.input.getAim();
    this.transport.send({
      t: 'input',
      direction: this.input.getMovementDirection(),
      sprint: this.input.isSprintDown(),
      aim: aim ? toNetAim(aim) : undefined,
      jump: this.input.takeJump(),
      exit: this.input.takeExit(),
      shots: this.shots.map(toNetAim),
      burst: this.burst,
      projectile: this.projectile,
    });
    this.shots = [];
    this.burst = false;
    this.projectile = undefined;
  }
}
