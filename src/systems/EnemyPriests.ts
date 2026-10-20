import { PRIEST_ESCAPE_BEYOND, PRIEST_POST_SLACK } from '../config';
import { enemyArchetype, enemyTraits } from '../data/enemyKinds';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type { Vec2 } from '../types';
import { enemyKeepX, worldWidth } from './battlefield';
import type { EnemyAIWorld } from './EnemyAI';
import { planHeals, priestPost } from './healing';
import { ShamanSpells } from './ShamanSpells';
import { nearestExposedBowman } from './targeting';
import { groundAt } from './terrain';

/** Where a priest's heal goes from and to: the chest. */
const priestChest = (enemy: Enemy): Vec2 => ({ x: enemy.x, y: enemy.y - 25 * enemy.size });

/** The enemies that never attack (EnemyAI hands them over): the priest heals, the goblin shaman casts its spells. */
export class EnemyPriests {
  private readonly shamanSpells: ShamanSpells;

  public constructor(private readonly world: EnemyAIWorld) {
    this.shamanSpells = new ShamanSpells(world);
  }

  /**
   * Priest: never attacks. It walks behind the front soldier on its side of the bowman (or the keep while everyone
   * hides), dashes past the bowman to the soldiers beyond him when none are left on its side and, with no soldier left,
   * retreats to the enemy keep (systems/healing.ts); meanwhile it heals. Once only priests are left and no more are to
   * come, it walks off the field's right edge and has escaped (counts as defeated). The goblin shaman moves the same
   * way and casts its spells instead (ShamanSpells).
   */
  public update(priest: Enemy, deltaMs: number): void {
    const { heals } = enemyArchetype(priest.kind);
    priest.updateMana(deltaMs);
    const bowman = nearestExposedBowman(this.world.bowmen, priest.x);
    priest.target = bowman ? 'bowman' : 'tower';
    const others = this.world.enemies.filter((other) => other !== priest && other.isAlive() && !enemyArchetype(other.kind).heals && !enemyArchetype(other.kind).buffs);
    const soldiers = others.filter((other) => !(other instanceof DragonEnemy)).map((other) => other.x);
    const escaping = others.length === 0 && !this.world.reinforcementsDue();
    const escapeX = worldWidth() + PRIEST_ESCAPE_BEYOND;
    const retreatX = escaping ? escapeX + PRIEST_POST_SLACK : enemyKeepX();
    const post = priestPost(priest.x, soldiers, bowman ? bowman.x : this.world.playerTower.x, retreatX);
    priest.update(deltaMs, { x: post, y: groundAt(Math.min(post, worldWidth())) }, PRIEST_POST_SLACK);
    priest.updateAnimation(deltaMs, priest.isMoving());
    if (escaping && priest.x >= escapeX) {
      priest.escape();
      return;
    }
    if (priest.isDown || priest.afflictions.isFrozen || priest.afflictions.inVortex) {
      // Knocked down, thrown, frozen or in a vortex: a cast under way is lost (its mana too).
      priest.actions.interrupt();
    } else if (heals) {
      this.castHeal(priest);
    } else {
      this.shamanSpells.update(priest, deltaMs);
    }
    priest.clearHitTint();
  }

  /**
   * Priest: when the pause is over and it has the mana, raises its scepter for a cast. The mana goes now, the heals land
   * when the cast ends (systems/healing.ts): the wounded around it then, nearest first, never itself or the undead, up to
   * the mana spent; red crosses rise from each one. Cut short, the cast is lost.
   */
  private castHeal(priest: Enemy): void {
    const { mana } = priest;
    if (!mana?.canCast || priest.isCasting || priest.isAttacking) {
      return;
    }
    const spent = this.planPriestHeals(priest, mana.mana).reduce((sum, { amount }) => sum + amount, 0);
    if (spent === 0) {
      return;
    }
    mana.spend(spent);
    priest.castHeal(() => {
      const heals = this.planPriestHeals(priest, spent);
      if (heals.length === 0) {
        return;
      }
      this.world.effects.healPulse({ x: priest.x, y: priest.y });
      heals.forEach(({ enemy, amount }) => {
        enemy.heal(amount);
        this.world.effects.healCrosses(priestChest(enemy));
      });
    });
  }

  /** Who a cast of the priest's with `mana` heals now, and by how much (planHeals). */
  private planPriestHeals(priest: Enemy, mana: number): { enemy: Enemy; amount: number }[] {
    const wounded = this.world.enemies.filter((other): other is Enemy =>
      other !== priest && !(other instanceof DragonEnemy) && other.isAlive() && other.missingHealth > 0 && enemyTraits(other.kind).healable);
    return planHeals(priestChest(priest), wounded.map((enemy) => ({ at: priestChest(enemy), missing: enemy.missingHealth })), mana)
      .map(({ index, amount }) => ({ enemy: wounded[index], amount }));
  }
}
