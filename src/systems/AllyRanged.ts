import { DRAGON_FLIGHT, DRAGON_RANGE, ENEMY_ARROW_POWER, ENEMY_ATTACK, GROUND_Y, MOBA_LANES } from '../config';
import { bowSpeed } from '../data/projectiles';
import Arrow from '../objects/Arrow';
import type DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import type Tower from '../objects/Tower';
import type { UnitType, Vec2 } from '../types';
import { solveLaunchAngle } from './ballistics';
import { TOWER_HALF_WIDTH, type Foe } from './combatGeometry';
import { groundAt } from './terrain';

/** Re-solve the aim this often (as EnemyRanged: the solver simulates many trajectories). */
const AIM_REFRESH_MS = 250;
/** How far behind him a foe may be and still be shot (he turns round). */
const BEHIND = 40;

export interface AllyRangedWorld {
  readonly enemies: readonly Foe[];
  readonly enemyTower: Tower;
  wind(): number;
}

export interface AllyRangedEvents {
  /** An arrow loosed by one of the player's side's archers (a MOBA minion): it hits the enemies and their keep. */
  allyShot(from: Vec2, angle: number, speed: number, shooter: UnitType): void;
}

/** Where an archer aims at a foe: the chest of a man, the body of a dragon. */
const aimPointOf = (foe: Foe): Vec2 => (foe.isFlying ? { x: foe.x, y: foe.y } : { x: foe.x, y: foe.y - 25 * foe.size });

/**
 * The player's side's archers (MOBA blue archers; AllyAI hands them over): walk down the lane until an enemy is within
 * `ENEMY_ATTACK.archerRange` (the nearest), or the enemy keep within `MOBA_LANES.archerKeepRange`, then stop and shoot
 * with the real ballistics and wind, a little spread, like the enemy archers (EnemyRanged).
 */
export class AllyRanged {
  private readonly aims = new Map<Foe, { angle: number; ageMs: number }>();

  public constructor(private readonly world: AllyRangedWorld, private readonly events: AllyRangedEvents) {}

  public updateArcher(archer: Enemy, deltaMs: number, laneEnd: number): void {
    const aimPoint = this.target(archer);
    if (archer.isDown || !aimPoint) {
      archer.update(deltaMs, { x: laneEnd, y: groundAt(laneEnd) }, 4);
      archer.relaxBow(deltaMs);
      this.aims.delete(archer);
    } else {
      const speed = bowSpeed(ENEMY_ARROW_POWER);
      const release = archer.getBowReleasePoint();
      const angle = this.aimAngle(archer, release, aimPoint, speed, deltaMs);
      if (archer.aimBow(angle, deltaMs)) {
        const spread = (Math.random() * 2 - 1) * ENEMY_ATTACK.archerSpread;
        this.events.allyShot(archer.getBowReleasePoint(), angle + spread, speed * (0.97 + Math.random() * 0.06), archer.kind);
      }
    }
    archer.updateAnimation(deltaMs, archer.isMoving());
  }

  /**
   * MOBA blue dragon: flies to its hover point by the nearest enemy (else over the red keep) and, while it is ahead and
   * in range, the rider shoots it as the red dragon archers do (EnemyRanged.updateDragon).
   */
  public updateDragon(dragon: DragonEnemy, deltaMs: number): void {
    const foe = this.world.enemies
      .filter((candidate) => candidate.isAlive())
      .reduce<Foe | undefined>((best, candidate) => (!best || Math.abs(candidate.x - dragon.x) < Math.abs(best.x - dragon.x) ? candidate : best), undefined);
    const tower = this.world.enemyTower;
    const aimPoint = foe ? aimPointOf(foe) : { x: tower.x, y: GROUND_Y - 90 };
    dragon.update(deltaMs, aimPoint.x);
    const release = dragon.getBowReleasePoint();
    const ahead = (aimPoint.x - release.x) * dragon.facingX;
    if (dragon.isTurning || ahead <= 0 || ahead > DRAGON_RANGE || (!foe && tower.isDestroyed())) {
      dragon.relax(deltaMs);
      this.aims.delete(dragon);
    } else {
      const speed = bowSpeed(ENEMY_ARROW_POWER);
      const angle = this.aimAngle(dragon, release, aimPoint, speed, deltaMs);
      const moving = dragon.flightSpeed;
      if (dragon.aim(angle, deltaMs, 1 + (DRAGON_FLIGHT.movingShotPace - 1) * moving)) {
        const spread = (Math.random() * 2 - 1) * ENEMY_ATTACK.archerSpread * (1 + (DRAGON_FLIGHT.movingSpread - 1) * moving);
        this.events.allyShot(dragon.getBowReleasePoint(), angle + spread, speed * (0.97 + Math.random() * 0.06), dragon.kind);
      }
    }
    dragon.updateAnimation(deltaMs);
  }

  /** The nearest living enemy in range (not far behind him), else the enemy keep's wall in range, else none. */
  private target(archer: Enemy): Vec2 | undefined {
    const foe = this.world.enemies
      .filter((candidate) => candidate.isAlive() && candidate.x >= archer.x - BEHIND && Math.abs(candidate.x - archer.x) <= ENEMY_ATTACK.archerRange)
      .reduce<Foe | undefined>((best, candidate) => (!best || Math.abs(candidate.x - archer.x) < Math.abs(best.x - archer.x) ? candidate : best), undefined);
    if (foe) {
      return aimPointOf(foe);
    }
    const tower = this.world.enemyTower;
    const wall = tower.x - TOWER_HALF_WIDTH + 12;
    if (!tower.isDestroyed() && wall - archer.x <= MOBA_LANES.archerKeepRange) {
      return { x: wall, y: GROUND_Y - 70 };
    }
    return undefined;
  }

  private aimAngle(archer: Foe, release: Vec2, aimPoint: Vec2, speed: number, deltaMs: number): number {
    const cached = this.aims.get(archer);
    if (cached && cached.ageMs < AIM_REFRESH_MS) {
      cached.ageMs += deltaMs;
      return cached.angle;
    }
    const angle = solveLaunchAngle(release, aimPoint, speed, Arrow.getFlightParams('normal', this.world.wind()), GROUND_Y);
    this.aims.set(archer, { angle, ageMs: 0 });
    return angle;
  }
}
