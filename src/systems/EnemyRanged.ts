import {
  BANNERS,
  DRAGON_FLIGHT,
  DRAGON_RANGE,
  DRAGON_SCORCH_MS,
  DRAGON_TURBULENCE_SPREAD,
  ENEMY_ARROW_POWER,
  ENEMY_ATTACK,
  FIRE_DRAGON_RANGE,
  GROUND_Y,
} from '../config';
import { enemyArchetype } from '../data/enemyKinds';
import { bowSpeed } from '../data/projectiles';
import Arrow from '../objects/Arrow';
import type Bowman from '../objects/bowman/Bowman';
import type DragonEnemy from '../objects/dragon/DragonEnemy';
import type Enemy from '../objects/enemy/Enemy';
import { TOWER_HEIGHT } from '../objects/Tower';
import type { EnemyType, Vec2 } from '../types';
import { solveLaunchAngle } from './ballistics';
import { flamesTouch } from './burning';
import { BOWMAN_CHEST, bowmanBox, type Foe } from './combatGeometry';
import type { EnemyAIEvents, EnemyAIWorld } from './EnemyAI';
import { nearestExposedBowman, nearestMeleeTarget } from './targeting';

/** The fire dragon aims this far above the bowman's feet. */
const FIRE_AIM_ABOVE_FEET = 10;
/** Enemy archers re-solve their aim this often (the solver simulates many trajectories). */
const ARCHER_AIM_REFRESH_MS = 250;

/**
 * The enemies that shoot (EnemyAI hands them over): archers on foot, the dragon archer's rider and the fire dragon's
 * breath, all aiming with the real ballistics and the level's wind.
 */
export class EnemyRanged {
  /** Cached aim per shooter. */
  private readonly archerAim = new Map<Foe, { angle: number; ageMs: number }>();

  public constructor(
    private readonly world: EnemyAIWorld,
    private readonly events: EnemyAIEvents,
  ) {}

  /**
   * Enemy archer: walk until the bowman (or the keep, if he's hiding in it) is in range, then stop,
   * aim with the real ballistics and shoot with a little spread.
   */
  public updateArcher(enemy: Enemy, deltaMs: number, escortPost: number | undefined): void {
    // Banners: a soldier carrying ours off is the one to shoot.
    const thief = this.world.banners?.thief('enemy');
    const aimPoint = thief ? { x: thief.x, y: thief.y - 25 * thief.size } : this.aimPointFrom(enemy.x, true);
    const inRange = Math.abs(aimPoint.x - enemy.x) <= ENEMY_ATTACK.archerRange;
    // Escorting their bearer, an archer keeps to its post and shoots what comes in range from there.
    const post = thief ? undefined : escortPost;
    const strayed = post !== undefined && Math.abs(enemy.x - post) > BANNERS.escortRange;

    if (enemy.isDown || !inRange || strayed) {
      const toX = post ?? aimPoint.x;
      enemy.update(deltaMs, { x: toX, y: GROUND_Y }, post === undefined ? 0 : 4);
      enemy.relaxBow(deltaMs);
      this.archerAim.delete(enemy);
    } else {
      const speed = bowSpeed(ENEMY_ARROW_POWER);
      const angle = this.aimAngle(enemy, enemy.getBowReleasePoint(), aimPoint, speed, deltaMs);
      if (enemy.aimBow(angle, deltaMs)) {
        const spread = (Math.random() * 2 - 1) * ENEMY_ATTACK.archerSpread * this.world.enemyEdge.aimSpread;
        this.events.enemyShot(enemy.getBowReleasePoint(), (angle) + spread, speed * (0.97 + Math.random() * 0.06), enemy.kind as EnemyType, enemy.power);
      }
    }
    enemy.updateAnimation(deltaMs, enemy.isMoving());
  }

  /**
   * Dragon archer: flies to its hover point in front of the bowman (or the keep, if he's hiding), and
   * while the target is in range below it the rider aims with the same ballistics and wind and shoots.
   */
  public updateDragon(dragon: DragonEnemy, deltaMs: number): void {
    const bowman = nearestExposedBowman(this.world.bowmen, dragon.x);
    const aimPoint = this.aimPointFrom(dragon.x);
    // Everyone hiding in the keep: the fire dragon (its fire can't hurt the keep) waits away from it.
    dragon.update(deltaMs, aimPoint.x, !bowman);
    if (enemyArchetype(dragon.kind).breathesFire) {
      this.updateFireDragon(dragon, bowman, aimPoint, deltaMs);
      return;
    }
    const release = dragon.getBowReleasePoint();
    // In front of it (it faces either way) and in range; it doesn't shoot while turning round.
    const ahead = (aimPoint.x - release.x) * dragon.facingX;
    const inRange = !dragon.isTurning && ahead > 0 && ahead <= DRAGON_RANGE;
    if (!inRange || (!this.world.lanes && this.world.bowmen.every((candidate) => candidate.isDead))) {
      dragon.relax(deltaMs);
      this.archerAim.delete(dragon);
    } else {
      const speed = bowSpeed(ENEMY_ARROW_POWER);
      const angle = this.aimAngle(dragon, release, aimPoint, speed, deltaMs);
      // In flight between hovers he shoots less often and much wider (DRAGON_FLIGHT).
      const moving = dragon.flightSpeed;
      if (dragon.aim(angle, deltaMs, 1 + (DRAGON_FLIGHT.movingShotPace - 1) * moving)) {
        // Buffeted by turbulence the rider can't aim well.
        const turbulence = dragon.afflictions.isTurbulent ? DRAGON_TURBULENCE_SPREAD : 1;
        const flight = 1 + (DRAGON_FLIGHT.movingSpread - 1) * moving;
        const spread = (Math.random() * 2 - 1) * ENEMY_ATTACK.archerSpread * this.world.enemyEdge.aimSpread * turbulence * flight;
        this.events.enemyShot(dragon.getBowReleasePoint(), (angle) + spread, speed * (0.97 + Math.random() * 0.06), 'dragon', dragon.power);
      }
    }
    dragon.updateAnimation(deltaMs);
  }

  /**
   * Fire dragon: hovers lower and closer (DragonEnemy) and breathes fire at the bowman whenever he's within
   * FIRE_DRAGON_RANGE of its mouth, ahead of and below it (or strafes him, DragonEnemy); with everyone hiding in
   * the keep it waits away from it, no fire. Its flames
   * set the bowman alight (systems/burning.ts); the burn's damage is applied in update.
   */
  private updateFireDragon(dragon: DragonEnemy, bowman: Bowman | undefined, aimPoint: Vec2, deltaMs: number): void {
    // The hot gas rises towards the end of the stream: aim at his legs rather than his chest.
    const target = bowman ? { x: aimPoint.x, y: bowman.y - FIRE_AIM_ABOVE_FEET } : aimPoint;
    const mouth = dragon.getMouthPoint();
    const dx = target.x - mouth.x;
    const dy = target.y - mouth.y;
    const inReach = dx * dragon.facingX > 0 && dy > 0 && Math.hypot(dx, dy) <= FIRE_DRAGON_RANGE;
    if (inReach && bowman) {
      dragon.breathe(Math.atan2(dy, dx));
    }
    dragon.updateAnimation(deltaMs);
    // The flames set any bowman they touch alight (not inside the keep); staying in them keeps relighting the burn.
    const flames = dragon.getFlames();
    if (flames.length === 0) {
      return;
    }
    this.world.bowmen
      .filter((candidate) => !candidate.isInTower && !candidate.isDead && flamesTouch(flames, bowmanBox(candidate)))
      .forEach((candidate) => {
        if (candidate.ignite()) {
          this.events.bowmanIgnited(candidate);
        }
      });
    // Enemies on the ground in its way catch fire too, briefly (DRAGON_SCORCH_MS).
    this.world.enemies
      .filter((foe): foe is Enemy => !enemyArchetype(foe.kind).flies && foe.isAlive() && foe.getHitBoxes().some(({ bounds }) => flamesTouch(flames, bounds)))
      .forEach((enemy) => enemy.afflictions.scorch(DRAGON_SCORCH_MS));
  }

  /** The launch angle from `release` at `aimPoint`, re-solved every ARCHER_AIM_REFRESH_MS (the solver is costly). */
  private aimAngle(shooter: Foe, release: Vec2, aimPoint: Vec2, speed: number, deltaMs: number): number {
    const cached = this.archerAim.get(shooter);
    if (cached && cached.ageMs < ARCHER_AIM_REFRESH_MS) {
      cached.ageMs += deltaMs;
      return cached.angle;
    }
    const angle = solveLaunchAngle(release, aimPoint, speed, Arrow.getFlightParams('normal', this.world.wind()), GROUND_Y);
    this.archerAim.set(shooter, { angle, ageMs: 0 });
    return angle;
  }

  /** The chest of the nearest bowman out in the open (archers on foot: or soldier), else the keep's wall. */
  private aimPointFrom(fromX: number, soldiersToo = false): Vec2 {
    // MOBA: whatever of the blue side is nearest, dragons too.
    const { lanes, allies, allyFliers = [] } = this.world;
    const soldiers: readonly Foe[] = lanes ? [...allies, ...allyFliers] : soldiersToo ? allies : [];
    const target = nearestMeleeTarget(this.world.bowmen, soldiers, fromX);
    if (target?.ally) {
      return { x: target.ally.x, y: target.ally.y - (target.ally.isFlying ? 0 : 25 * target.ally.size) };
    }
    return target?.bowman
      ? { x: target.bowman.x, y: target.bowman.y - BOWMAN_CHEST }
      : { x: this.world.playerTower.x, y: GROUND_Y - TOWER_HEIGHT * 0.55 };
  }
}
