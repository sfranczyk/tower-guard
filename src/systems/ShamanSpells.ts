import { SHAMAN } from '../config';
import { ENEMY_KINDS, enemyTraits } from '../data/enemyKinds';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type { Vec2 } from '../types';
import type { Foe } from './combatGeometry';
import type { EffectsSystem } from './EffectsSystem';
import { planBuffs, shamanBuffFor } from './shamanBuffs';

/** Where a shaman's spell goes from and to: the chest. */
const chest = (enemy: Enemy): Vec2 => ({ x: enemy.x, y: enemy.y - 25 * enemy.size });

/**
 * The goblin shamans' casting (host; EnemyAI moves them like priests): every SHAMAN.intervalMs, when anyone around it
 * can take a spell, it raises its staff; at the cast's end the nearest (SHAMAN.perCast) get their spell
 * (systems/shamanBuffs.ts): a lasting buff, or health for the undead. Cut short, the cast is lost.
 */
export class ShamanSpells {
  /** Time until each shaman may start its next cast. */
  private readonly cooldown = new WeakMap<Enemy, number>();

  public constructor(private readonly world: { readonly enemies: readonly Foe[]; readonly effects: EffectsSystem }) {}

  public update(shaman: Enemy, deltaMs: number): void {
    const left = Math.max(0, (this.cooldown.get(shaman) ?? 0) - deltaMs);
    this.cooldown.set(shaman, left);
    if (left > 0 || shaman.isCasting || shaman.isAttacking || this.plan(shaman).length === 0) {
      return;
    }
    this.cooldown.set(shaman, SHAMAN.intervalMs);
    shaman.castHeal(() => {
      const targets = this.plan(shaman);
      if (targets.length === 0) {
        return;
      }
      this.world.effects.buffPulse({ x: shaman.x, y: shaman.y });
      targets.forEach(({ enemy, buff }) => {
        if (buff === 'mend') {
          enemy.heal(SHAMAN.undeadHeal);
          this.world.effects.healCrosses(chest(enemy));
        } else {
          enemy.buff.apply(buff);
        }
      });
    });
  }

  /** Who a cast of `shaman`'s reaches now, and with what. */
  private plan(shaman: Enemy) {
    const others = this.world.enemies.filter((other): other is Enemy => other !== shaman && !(other instanceof DragonEnemy) && other.isAlive());
    const candidates = others.map((enemy) => ({
      at: chest(enemy),
      buff: shamanBuffFor(ENEMY_KINDS[enemy.kind].archetype, enemyTraits(enemy.kind)),
      buffed: enemy.buff.kind !== undefined,
      missing: enemy.missingHealth,
    }));
    return planBuffs(chest(shaman), candidates).map((index) => ({ enemy: others[index], buff: candidates[index].buff! }));
  }
}
