import type { Graphics } from 'pixi.js';
import {
  ENEMY_TOWER_DAMAGE,
  FIRE_ARROW_DAMAGE,
  FIRE_DRAGON_BLAST_POWER,
  FRIENDLY_FIRE_GRACE_MS,
  FROST_ARROW_DAMAGE,
  HEADSHOT_DAMAGE_MULTIPLIER,
  KAMIKAZE_BLAST_POWER,
  PIERCING_DAMAGE_MULTIPLIER,
  PIN_DAMAGE,
  PIN_DURATION_MS,
  PROJECTILE_DAMAGE,
  SHOW_HITBOX_DEBUG,
  SHRAPNEL_FRAGMENT_DAMAGE,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import { enemyDamage, explosionDamage, pinDurationMs, rollDamage, type DamageTarget } from '../data/enemies';
import { enemyArchetype } from '../data/enemyKinds';
import type Arrow from '../objects/Arrow';
import type Bowman from '../objects/Bowman';
import DragonEnemy from '../objects/DragonEnemy';
import type Enemy from '../objects/Enemy';
import type Tower from '../objects/Tower';
import type { EnemyType, ProjectileType, Vec2 } from '../types';
import type { ArrowMagic } from './ArrowMagic';
import { isMagicArrow } from './ArrowMagic';
import type { BowmanHit } from './bowmanDeath';
import { segmentHitTime } from './collision';
import { bowmanBox, foeHitBoxes, pointAlong, type Foe } from './combatGeometry';
import type { EffectsSystem } from './EffectsSystem';

/** Damage of the fire and frost arrows' hit, × PROJECTILE_DAMAGE (their effect does the rest; a vortex arrow does none). */
const MAGIC_HIT_DAMAGE: Partial<Record<ProjectileType, number>> = { fire: FIRE_ARROW_DAMAGE, frost: FROST_ARROW_DAMAGE };
const PIERCING_MAX_IMPACTS = 5;
/** A pinning arrow's centre sits this far back from where its tip goes into the ground (the sprite is ~36 px long). */
const PIN_SINK = 13;
/** An arrow hitting a keep sticks into the stone with its centre this far back from the point of impact. */
const WALL_SINK = 14;
/** A player arrow hitting a bowman (friendly fire) in the top this many px of him is a headshot. */
const BOWMAN_HEAD = 10;

interface EnemyHit {
  enemy: Foe;
  time: number;
  headshot: boolean;
}

interface BowmanArrowHit {
  bowman: Bowman;
  time: number;
  headshot: boolean;
}

/** Damage of a hostile arrow by who shot it (archer arrows if unknown). */
const arrowDamage = (shooter: EnemyType | undefined, target: DamageTarget) => enemyDamage(shooter ?? 'archer', 'arrow', target);

/** What the arrows need of the battle. */
export interface ArrowHitsWorld {
  readonly bowmen: readonly Bowman[];
  readonly playerTower: Tower;
  readonly enemyTower: Tower;
  readonly arrows: readonly Arrow[];
  readonly effects: EffectsSystem;
  readonly debug: Graphics;
}

export interface ArrowHitsEvents {
  bowmanDamaged(bowman: Bowman, amount: number, hit: BowmanHit): void;
  headshot(): void;
  sound(id: SoundId, at: Vec2): void;
}

/** The blasts and ice CombatSystem handles (they reach beyond the one arrow). */
export interface ArrowHitsActions {
  explode(point: Vec2, activeEnemies: readonly Foe[], directHit?: Foe | Bowman, power?: number, dragon?: boolean): void;
  shatter(enemy: Enemy, fromX: number): void;
  breakIce(bowman: Bowman): void;
}

/**
 * Every arrow in flight against what it can hit (CombatSystem calls `resolve` / `resolveHostile` each frame):
 * a player's arrow against the enemies, the enemy keep and (friendly fire) the bowmen, earliest hit first, and what
 * each kind of arrow does there; an enemy's arrow against the bowmen out in the open, or the keep while all hide.
 */
export class ArrowHits {
  /** Enemies (and bowmen) each arrow has already hit, so piercing arrows hit each one once. */
  private readonly arrowHits = new Map<Arrow, Set<Foe | Bowman>>();

  public constructor(
    private readonly world: ArrowHitsWorld,
    private readonly events: ArrowHitsEvents,
    private readonly magic: ArrowMagic,
    private readonly actions: ArrowHitsActions,
  ) {}

  /** Stuck or gone, an arrow hits nothing more: what it already hit can go. */
  public forget(arrow: Arrow): void {
    this.arrowHits.delete(arrow);
  }

  /** Enemy arrows hurt any bowman out in the open, or the keep while everyone left hides inside it. */
  public resolveHostile(arrow: Arrow): void {
    const { start, end } = arrow.getTravelSegment();
    const travel = { x: end.x - start.x, y: end.y - start.y };
    const { bowmen, playerTower, effects } = this.world;
    const exposed = bowmen.filter((bowman) => !bowman.isInTower && !bowman.isDead);

    if (exposed.length === 0 && bowmen.some((bowman) => !bowman.isDead)) {
      // Follows the keep's silhouette; chips fly off where it lands.
      const towerHit = playerTower.hitTime(start, travel);
      if (towerHit !== undefined) {
        const impact = pointAlong(start, travel, towerHit);
        playerTower.takeDamage(rollDamage(arrowDamage(arrow.shooter, 'keep')), impact);
        arrow.stickToWall(impact, WALL_SINK);
      }
      return;
    }

    // The earliest bowman on its path (it flies over the fallen into the ground).
    const hit = exposed
      .map((bowman) => ({ bowman, time: segmentHitTime(start, travel, bowmanBox(bowman)) }))
      .filter((candidate): candidate is { bowman: Bowman; time: number } => candidate.time !== undefined)
      .sort((first, second) => first.time - second.time)[0];
    if (hit) {
      // He falls as if shot from where the arrow came from.
      this.events.bowmanDamaged(hit.bowman, rollDamage(arrowDamage(arrow.shooter, 'bowman')), { cause: 'arrow', fromX: start.x });
      const point = pointAlong(start, travel, hit.time);
      effects.bloodBurst(point);
      this.events.sound('arrowFlesh', point);
      arrow.deactivate();
    }
  }

  public resolve(arrow: Arrow, activeEnemies: readonly Foe[], friendly: readonly Bowman[]): void {
    const { start, end } = arrow.getTravelSegment();
    const travel = { x: end.x - start.x, y: end.y - start.y };
    const hitEnemies = this.arrowHits.get(arrow) ?? new Set<Foe | Bowman>();
    this.arrowHits.set(arrow, hitEnemies);

    const enemyHit = activeEnemies
      .filter((candidate) => candidate.isAlive() && !hitEnemies.has(candidate))
      .map((candidate) => ArrowHits.hitTest(start, travel, candidate))
      .filter((hit): hit is EnemyHit => hit !== undefined)
      .sort((first, second) => first.time - second.time)[0];

    const { enemyTower } = this.world;
    const towerHit = enemyTower.hitTime(start, travel);

    // Friendly fire: the bowmen are hit like the enemies (the one who loosed it not while it leaves his bow).
    const bowmanHit = friendly
      .filter((bowman) => !hitEnemies.has(bowman) && (this.world.bowmen.indexOf(bowman) !== arrow.owner || arrow.flightMs >= FRIENDLY_FIRE_GRACE_MS))
      .map((bowman) => ArrowHits.bowmanHitTest(start, travel, bowman))
      .filter((hit): hit is BowmanArrowHit => hit !== undefined)
      .sort((first, second) => first.time - second.time)[0];

    const earliest = Math.min(towerHit ?? Infinity, enemyHit?.time ?? Infinity, bowmanHit?.time ?? Infinity);
    if (towerHit !== undefined && towerHit <= earliest) {
      this.hitTower(arrow, pointAlong(start, travel, towerHit), activeEnemies);
      return;
    }
    if (bowmanHit && bowmanHit.time < (enemyHit?.time ?? Infinity)) {
      this.hitBowman(arrow, bowmanHit, pointAlong(start, travel, bowmanHit.time), hitEnemies, activeEnemies);
      return;
    }
    if (enemyHit) {
      this.hitEnemy(arrow, enemyHit, pointAlong(start, travel, enemyHit.time), hitEnemies, activeEnemies);
    }
  }

  /** Earliest hit of the segment on a bowman: his head (the top BOWMAN_HEAD px, a headshot) or body; the head wins ties. */
  private static bowmanHitTest(start: Vec2, travel: Vec2, bowman: Bowman): BowmanArrowHit | undefined {
    const box = bowmanBox(bowman);
    const head = { ...box, bottom: box.top + BOWMAN_HEAD };
    const body = { ...box, top: box.top + BOWMAN_HEAD };
    const headTime = segmentHitTime(start, travel, head);
    const bodyTime = segmentHitTime(start, travel, body);
    if (headTime !== undefined && (bodyTime === undefined || headTime <= bodyTime)) {
      return { bowman, time: headTime, headshot: true };
    }
    return bodyTime === undefined ? undefined : { bowman, time: bodyTime, headshot: false };
  }

  /** Earliest hit of the segment on any of the enemy's hit zones; a headshot zone wins ties. */
  private static hitTest(start: Vec2, travel: Vec2, enemy: Foe): EnemyHit | undefined {
    let best: EnemyHit | undefined;
    foeHitBoxes(enemy).forEach(({ bounds, headshot }) => {
      const time = segmentHitTime(start, travel, bounds);
      if (time !== undefined && (!best || time < best.time || (time === best.time && headshot))) {
        best = { enemy, time, headshot };
      }
    });
    return best;
  }

  private hitTower(arrow: Arrow, impactPoint: Vec2, activeEnemies: readonly Foe[]): void {
    const explosive = arrow.type === 'explosive';
    if (arrow.type === 'vortex') {
      // A vortex arrow does nothing to the stone: no damage, no vortex; it just sticks in.
      arrow.stickToWall(impactPoint, WALL_SINK);
      return;
    }
    // Chips fly off where it lands.
    this.world.enemyTower.takeDamage(ENEMY_TOWER_DAMAGE * (explosive ? 1.25 : 1), impactPoint);
    if (explosive) {
      this.actions.explode(impactPoint, activeEnemies);
      arrow.deactivate();
    } else {
      // Sticks into the stone and stays there.
      arrow.stickToWall(impactPoint, WALL_SINK);
      this.magic.wallImpact(arrow.type, impactPoint);
    }
  }

  /** What a player arrow's hit deals (an enemy, or a bowman with friendly fire). */
  private static arrowHitDamage(arrow: Arrow, headshot: boolean): number {
    if (arrow.type === 'explosive') {
      return explosionDamage(0);
    }
    // A pinning arrow only scratches (it's about holding them, not hurting them; no headshot bonus).
    if (arrow.type === 'pinning') {
      return rollDamage(PIN_DAMAGE);
    }
    const baseDamage = arrow.type === 'piercing'
      ? PROJECTILE_DAMAGE * Math.pow(PIERCING_DAMAGE_MULTIPLIER, arrow.impacts)
      : arrow.type === 'fragment' ? PROJECTILE_DAMAGE * SHRAPNEL_FRAGMENT_DAMAGE : PROJECTILE_DAMAGE * (MAGIC_HIT_DAMAGE[arrow.type] ?? 1);
    return headshot ? baseDamage * HEADSHOT_DAMAGE_MULTIPLIER : baseDamage;
  }

  /**
   * Friendly fire: a player's arrow hit a bowman, and does to him what it does to an enemy: the same damage
   * (headshots too), a blast that knocks him down, fire, frost, a vortex that lifts him, a pin through the foot.
   * Frozen, a blast breaks his ice (he isn't shattered). An arrow that hits him is gone (piercing ones fly on).
   */
  private hitBowman(
    arrow: Arrow,
    { bowman, headshot }: BowmanArrowHit,
    impactPoint: Vec2,
    hitTargets: Set<Foe | Bowman>,
    activeEnemies: readonly Foe[],
  ): void {
    const { effects } = this.world;
    hitTargets.add(bowman);
    arrow.registerImpact();
    if (arrow.type === 'vortex') {
      // No damage: he glows and levitates while its vortex lasts.
      this.magic.hitEnemy(arrow.type, bowman, headshot, impactPoint);
      arrow.deactivate();
      return;
    }
    const explosive = arrow.type === 'explosive';
    if (bowman.isFrozen) {
      effects.frostBurst(impactPoint);
      if (explosive) {
        this.actions.breakIce(bowman);
      }
    } else {
      effects.bloodBurst(impactPoint);
      if (!explosive) {
        this.events.sound('arrowFlesh', impactPoint);
      }
    }
    const fromX = arrow.x < bowman.x ? bowman.x - 1 : bowman.x + 1;
    this.events.bowmanDamaged(bowman, ArrowHits.arrowHitDamage(arrow, headshot), { cause: explosive ? 'blast' : 'arrow', fromX });
    if (isMagicArrow(arrow.type)) {
      this.magic.hitEnemy(arrow.type, bowman, headshot, impactPoint);
    }
    if (!explosive) {
      this.events.sound('groan', impactPoint);
    }
    if (explosive) {
      bowman.knockBack(impactPoint.x, 1);
      this.actions.explode(impactPoint, activeEnemies, bowman);
      arrow.deactivate();
    } else if (arrow.type === 'piercing') {
      effects.impact(impactPoint);
      if (arrow.impacts >= PIERCING_MAX_IMPACTS) {
        arrow.deactivate();
      }
    } else if (arrow.type === 'pinning' && !bowman.isDead && !bowman.isAloft) {
      // Through his foot into the ground: he can't walk away for a while (he can still shoot).
      bowman.pin(PIN_DURATION_MS);
      const heading = Math.atan2(arrow.velocityVector.y, arrow.velocityVector.x);
      const foot = bowman.pinnedFootPoint();
      arrow.position.set(foot.x - Math.cos(heading) * PIN_SINK, foot.y - Math.sin(heading) * PIN_SINK);
      arrow.stickToGround(arrow.y);
      effects.impact({ x: foot.x, y: foot.y - 2 });
    } else {
      arrow.deactivate();
    }
  }

  private hitEnemy(
    arrow: Arrow,
    { enemy, headshot }: EnemyHit,
    impactPoint: Vec2,
    hitEnemies: Set<Foe | Bowman>,
    activeEnemies: readonly Foe[],
  ): void {
    const { effects, debug } = this.world;
    if (arrow.type === 'vortex') {
      // No damage: the one it hits glows and levitates while its vortex lasts (ArrowMagic); the arrow rides along.
      hitEnemies.add(enemy);
      arrow.registerImpact();
      this.magic.hitEnemy(arrow.type, enemy, headshot, impactPoint);
      arrow.stickToEnemy(enemy, impactPoint);
      return;
    }
    const frozen = !(enemy instanceof DragonEnemy) && enemy.afflictions.isFrozen;
    if (frozen) {
      // Ice chips instead of blood.
      effects.frostBurst(impactPoint);
    } else {
      effects.bloodBurst(impactPoint, enemy.bodyColors);
      // The arrow sinking in (an explosive arrow's hit is just its blast).
      if (arrow.type !== 'explosive') {
        this.events.sound('arrowFlesh', impactPoint);
      }
    }
    // A fire arrow thaws a frozen enemy before it hurts it (so it doesn't shatter).
    if (arrow.type === 'fire' && frozen) {
      enemy.afflictions.ignite();
    }
    if (SHOW_HITBOX_DEBUG) {
      debug.circle(impactPoint.x, impactPoint.y, 3).fill({ color: 0x55ff88, alpha: 1 });
    }

    // An explosive arrow deals only its blast (no impact damage, so no headshot either); a kill blows the body apart.
    const explosive = arrow.type === 'explosive';
    const pinning = arrow.type === 'pinning';
    const damage = ArrowHits.arrowHitDamage(arrow, headshot);
    if (headshot && !explosive && !pinning) {
      this.events.headshot();
    }
    const fromLeft = arrow.x < enemy.x;
    enemy.applyHitReaction(fromLeft ? 6 : -4);
    const fromX = fromLeft ? enemy.x - 1 : enemy.x + 1;
    if (!(enemy instanceof DragonEnemy) && enemy.afflictions.isFrozen && (explosive || damage >= enemy.currentHealth)) {
      // Frozen: a blast, or a killing hit, shatters it (an explosive arrow still goes off below).
      this.actions.shatter(enemy, fromX);
    } else {
      const cause = explosive ? 'blast' : headshot && !pinning ? 'headshot' : 'arrow';
      enemy.takeDamage(damage, { cause, fromX, point: impactPoint });
    }
    if (isMagicArrow(arrow.type)) {
      this.magic.hitEnemy(arrow.type, enemy, headshot, impactPoint);
    }
    // Every arrow hit makes the enemy cry out (kills and headshots too); an explosive kill is just the blast.
    if (!explosive || enemy.isAlive()) {
      this.events.sound('groan', impactPoint);
    }
    hitEnemies.add(enemy);
    arrow.registerImpact();

    if (explosive && enemy instanceof DragonEnemy && enemyArchetype(enemy.kind).breathesFire && !enemy.isAlive()) {
      // A fire dragon killed by a direct explosive hit blows up: FIRE_DRAGON_BLAST_POWER times the blast, centred on its body, and the
      // arrows stuck in it go with it.
      const body = enemy.getPhysicsBounds();
      this.actions.explode({ x: body.x + body.width / 2, y: body.y + body.height / 2 }, activeEnemies, enemy, FIRE_DRAGON_BLAST_POWER, true);
      this.world.arrows.filter((stuck) => stuck.stuckTo === enemy).forEach((stuck) => stuck.deactivate());
      arrow.deactivate();
    } else if (explosive && enemyArchetype(enemy.kind).detonates && !enemy.isAlive()) {
      // A kamikaze killed by a direct explosive hit sets its bomb off: a twice-as-big blast where it stood.
      const body = enemy.getPhysicsBounds();
      this.actions.explode({ x: body.x + body.width / 2, y: body.y + body.height / 2 }, activeEnemies, enemy, KAMIKAZE_BLAST_POWER);
      arrow.deactivate();
    } else if (explosive) {
      this.actions.explode(impactPoint, activeEnemies, enemy);
      arrow.deactivate();
    } else if (arrow.type === 'piercing') {
      effects.impact(impactPoint);
      if (arrow.impacts >= PIERCING_MAX_IMPACTS) {
        arrow.deactivate();
      }
    } else if (arrow.type === 'pinning' && enemy.isAlive() && !(enemy instanceof DragonEnemy) && pinDurationMs(enemy.kind) > 0) {
      // Through the rear foot into the ground: the enemy is held there for a while, struggling.
      enemy.pin(pinDurationMs(enemy.kind));
      const heading = Math.atan2(arrow.velocityVector.y, arrow.velocityVector.x);
      const foot = enemy.pinnedFootPoint();
      arrow.position.set(foot.x - Math.cos(heading) * PIN_SINK, foot.y - Math.sin(heading) * PIN_SINK);
      arrow.stickToGround(arrow.y);
      effects.impact({ x: foot.x, y: foot.y - 2 });
    } else {
      // Pinned to the body: it rides along with walking, falls and the corpse.
      arrow.stickToEnemy(enemy, impactPoint);
    }
  }
}
