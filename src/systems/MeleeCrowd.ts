import { CROWD } from '../config';
import { enemyArchetype } from '../data/enemyKinds';
import type Bowman from '../objects/bowman/Bowman';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type { Foe } from './combatGeometry';
import { meleePosts, spreadApart, weaponReaches, type MeleePost } from './crowding';
import { nearestMeleeTarget } from './targeting';
import { groundAt } from './terrain';

/** How close an enemy comes to strike when it has no reach of its own (EnemyAI). */
export const MELEE_REACH = 25;

/**
 * The melee enemies' places around their targets this frame (systems/crowding.ts): `plan` before the enemies move gives
 * each its attack post or its place in the queue; `approach` walks it there and says whether it may strike; `lands` is
 * whether a blow reaches; `spread` keeps everyone not fighting from standing on one another.
 */
export class MeleeCrowd {
  private posts = new Map<Enemy, MeleePost>();
  /** Standing at an attack post this frame (they may overlap; the rest keep apart). */
  private readonly engaged = new Set<Enemy>();

  /** The melee fighters (not archers, kamikazes, healers, shamans or dragons) and the foe each goes for. */
  public plan(enemies: readonly Foe[], bowmen: readonly Bowman[], allies: readonly Enemy[]): void {
    this.engaged.clear();
    const fighters = enemies.filter((enemy): enemy is Enemy => {
      if (enemy instanceof DragonEnemy || !enemy.isAlive() || enemy.isArcher || enemy.fleeing || enemy.isCelebrating) {
        return false;
      }
      const { detonates, heals, buffs } = enemyArchetype(enemy.kind);
      return !detonates && !heals && !buffs;
    });
    this.posts = meleePosts(fighters.flatMap((enemy) => {
      const near = nearestMeleeTarget(bowmen, allies, enemy.x);
      const foe = near?.ally ?? near?.bowman;
      return foe ? [{ id: enemy, x: enemy.x, target: foe, targetX: foe.x, reach: enemy.reach?.bowman ?? MELEE_REACH }] : [];
    }));
  }

  /**
   * One frame of `enemy` going for `foe` (at `foeX`): to its post on its own side of him (stepping back if it got too
   * close for its weapon), then standing. Whether it is at an attack post within reach now.
   */
  public approach(enemy: Enemy, foe: unknown, foeX: number, deltaMs: number): boolean {
    const post = this.posts.get(enemy);
    const own = post?.target === foe ? post : undefined;
    const distance = own?.distance ?? enemy.reach?.bowman ?? MELEE_REACH;
    const side = enemy.x >= foeX ? 1 : -1;
    const off = (enemy.x - foeX) * side;
    const closest = Math.min(distance, enemy.strikeReach * CROWD.minReachShare);
    const placed = off >= closest && off <= distance + 2;
    const toX = placed ? enemy.x : foeX + side * distance;
    enemy.update(deltaMs, { x: toX, y: groundAt(toX) }, placed ? Infinity : 1);
    const attacks = placed && (own?.attacks ?? true);
    if (attacks) {
      this.engaged.add(enemy);
    }
    return attacks;
  }

  /** Whether `attacker`'s blow, landing now, reaches `targetX` (ahead of it, within its weapon's reach). */
  public lands(attacker: Enemy, targetX: number): boolean {
    return weaponReaches(attacker.x, attacker.figure.facing, targetX, attacker.strikeReach);
  }

  /** Neighbours too close step apart (crowding.spreadApart); those fighting at a post, down or held stay put. */
  public spread(units: readonly Enemy[], deltaMs: number): void {
    const ground = units.filter((unit) => !(unit instanceof DragonEnemy) && unit.isAlive());
    const xs = spreadApart(ground.map((unit) => ({ x: unit.x, fixed: this.holdsPlace(unit) })), (CROWD.spreadSpeed * deltaMs) / 1000);
    ground.forEach((unit, index) => {
      if (xs[index] !== unit.x) {
        unit.x = xs[index];
        unit.y = groundAt(unit.x);
      }
    });
  }

  private holdsPlace(unit: Enemy): boolean {
    return this.engaged.has(unit) || unit.isAttacking || unit.isDown || unit.isPinned || unit.isKneeling
      || unit.motion.isThrown || unit.afflictions.isFrozen || unit.afflictions.inVortex;
  }
}
