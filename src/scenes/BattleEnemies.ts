import type { Container } from 'pixi.js';
import { WORLD_WIDTH } from '../config';
import { getEnemyStats } from '../data/enemies';
import { ENEMY_KINDS, isFlyingType } from '../data/enemyKinds';
import { levelEnemyTotal, type LevelSetup } from '../data/sandbox';
import type { HostSync } from '../net/HostSync';
import type { SpawnPlace } from '../net/protocol';
import DragonEnemy from '../objects/DragonEnemy';
import Enemy, { type HitInfo, type RiderOff } from '../objects/enemy/Enemy';
import type { Foe } from '../systems/CombatSystem';
import { WaveDirector } from '../systems/waveDirector';
import type { EnemyType } from '../types';

/** Enemies come in from beyond the right edge of the battlefield (out of view), past the enemy keep. */
const ENEMY_SPAWN_X = WORLD_WIDTH + 60;

export interface BattleEnemiesDeps {
  world: Container;
  /** The level's enemies (shared with CombatSystem and the co-op sync); the fallen stay as corpses. */
  list: Foe[];
  /** A co-op guest runs no waves of its own: the host's enemies arrive as events. */
  guest: boolean;
  hostSync(): HostSync | undefined;
}

/** A level's enemies: released in waves, spawned, riders thrown off their horses, and counted for the level's end. */
export class BattleEnemies {
  /** The level's enemies, and each rider thrown off his horse (he fights on as one more). */
  public total: number;
  /** Debug toggle (O key): hides and freezes all enemies. */
  public visible = true;
  private spawned = 0;
  private director?: WaveDirector;

  public constructor(level: LevelSetup, private readonly deps: BattleEnemiesDeps) {
    this.total = levelEnemyTotal(level.enemies);
    if (!deps.guest) {
      this.director = new WaveDirector(level.enemies);
    }
  }

  public get list(): Foe[] {
    return this.deps.list;
  }

  /** Releases the next enemies of the wave (until the level ends) and keeps them hidden while toggled off. */
  public update(deltaMs: number): void {
    if (this.director) {
      const alive = this.list.filter((enemy) => enemy.isAlive()).length;
      this.director.update(deltaMs, alive).forEach((type) => this.spawn(type));
    }
    this.list.forEach((enemy) => {
      enemy.visible = this.visible;
    });
  }

  /** The level is over: no more waves. */
  public stopWaves(): void {
    this.director = undefined;
  }

  /**
   * Fallen enemies stay in the list (corpses), so every non-living one counts as defeated, but a dead horse whose rider
   * hasn't come off it yet (he comes as an enemy of his own).
   */
  public defeated(): number {
    return this.list.filter((enemy) => !enemy.isAlive() && !(enemy instanceof Enemy && enemy.riderPending)).length;
  }

  public allDefeated(): boolean {
    return this.spawned >= this.total && this.defeated() >= this.total;
  }

  public toggleVisible(): void {
    this.visible = !this.visible;
    this.list.forEach((enemy) => {
      enemy.visible = this.visible;
      enemy.setPaused(!this.visible);
    });
  }

  /** A new enemy walking (or flying) in, or (`place`) a mounted knight's rider thrown off where his horse stood. */
  public spawn(type: EnemyType, place?: SpawnPlace): Foe {
    const stats = getEnemyStats(type, 1);
    const enemy = isFlyingType(type)
      ? new DragonEnemy(ENEMY_SPAWN_X, stats.health, stats.speed, type)
      : new Enemy(place?.x ?? ENEMY_SPAWN_X, stats.health, stats.speed, 'bowman', type);
    enemy.visible = this.visible;
    this.list.push(enemy);
    this.spawned += 1;
    if (place) {
      this.total += 1;
    }
    this.deps.world.addChild(enemy);
    this.deps.hostSync()?.trackEnemy(enemy, type, place);
    if (enemy instanceof Enemy) {
      if (place) {
        // A rider keeps the health he had in the saddle (one with none left is killed by the blow: unhorse).
        if (place.health > 0) {
          enemy.startWounded(place.health);
        }
        if (place.lift) {
          enemy.liftFromSaddle();
        } else {
          // A co-op guest's copy flies where the host has it.
          enemy.throwOff(place.thrownFrom, this.deps.guest, place.force);
        }
      }
      // The host decides what becomes of a rider (the guest gets his spawn and hits as events).
      if (enemy.rides && !this.deps.guest) {
        enemy.onUnhorsed = (x, hit, off) => this.unhorse(type, x, hit, off);
      }
    }
    return enemy;
  }

  /**
   * A mounted knight's rider leaves the saddle at `x` (his horse killed, he killed, or a vortex pulled him out): he is put
   * on the ground with the health he has left and fights on foot, or (none left) dies of `hit`. Returns him.
   */
  public unhorse(type: EnemyType, x: number, hit: HitInfo, off: RiderOff): Enemy | undefined {
    const riderType = ENEMY_KINDS[type].unhorsed;
    if (!riderType) {
      return undefined;
    }
    const rider = this.spawn(riderType, { ...off, x: Math.round(x), thrownFrom: Math.round(off.thrownFrom) });
    if (!(rider instanceof Enemy)) {
      return undefined;
    }
    if (off.health <= 0) {
      rider.takeDamage(Number.MAX_SAFE_INTEGER, hit);
    }
    return rider;
  }
}
