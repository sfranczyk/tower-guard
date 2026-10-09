import { Graphics } from 'pixi.js';
import type { Vec2 } from '../../types';
import { getFlailPose } from '../../rendering/stickmanFlail';
import { knockdownProgress } from '../../systems/bowmanMotion';
import { spriteToContainer } from '../../systems/bodyAnchor';
import type { JointPose } from '../../rendering/stickmanPose';
import { approach } from '../../utils/math';
import { getArcherRig, toArcherLocalAngle } from '../../rendering/archer';
import type { ArmorPalette } from '../../rendering/armor';
import { armoredFallPose } from '../../rendering/armoredPose';
import { STANDING_BURN_POINTS, burnPoints } from '../../rendering/burning';
import { drawBowmanBody, drawBowmanFall, type BowmanLook } from '../../rendering/bowmanBody';
import { FALL_DURATION_MS } from '../../rendering/stickmanFall';
import type { Bowman } from './Bowman';

/** Body sprite baseline (hip height) relative to the bowman's feet, in unscaled units. */
const BODY_ORIGIN_Y = -55;
/** Time for the body lean to swing from one side to the other after turning around. */
const LEAN_TURN_MS = 260;
/** Lifted this high (px) in a vortex, he flails. */
const FLAIL_LIFT = 4;

/**
 * The bowman's drawn body: his look (ranger or keep warden) walking, sprinting, standing and drawing the bow, or in a
 * fall pose (knocked down, dying, flailing in a vortex), leaning and tumbling; where his bow's string hand and his
 * burning body points are.
 */
export class BowmanFigure {
  public readonly body = new Graphics();
  /** Always-running clock for the look's own motion (the cloak). */
  public lookTimeMs = 0;
  /** +1 facing right, −1 left. */
  public facing = 1;
  private animationTime = 0;
  private idleBlend = 1;
  private runningBlend = 0;
  /** Follows facing smoothly so the lean doesn't flip instantly on a turn. */
  private leanDirection = 1;

  public constructor(
    private readonly bowman: Bowman,
    private readonly look: BowmanLook,
    private readonly armorColors?: ArmorPalette,
  ) {}

  /**
   * Walking, sprinting or standing at `deltaMs`: blends between them, faces the way he runs while not drawing (the bow
   * carried pointing forward; while drawing, facing follows the aim), and raises or lowers the bow.
   */
  public animate(deltaMs: number, moving: boolean, sprinting: boolean): void {
    const { aim } = this.bowman;
    const speed = this.bowman.velocityX;
    const isMoving = moving || Math.abs(speed) > 1;
    const blendStep = deltaMs / 220;
    this.idleBlend = approach(this.idleBlend, isMoving ? 0 : 1, blendStep);
    this.runningBlend = approach(this.runningBlend, isMoving && sprinting ? 1 : 0, blendStep);

    if (isMoving) {
      // Faster cadence when sprinting.
      this.animationTime += deltaMs / (150 - this.runningBlend * 19);
    }
    if (aim.power <= 0 && Math.abs(speed) > 1) {
      this.facing = Math.sign(speed);
      aim.carry(this.facing);
    }
    this.leanDirection = approach(this.leanDirection, this.facing, (deltaMs / LEAN_TURN_MS) * 2);
    aim.raise(deltaMs);
    this.redraw();
  }

  /** Back on his feet: standing still. */
  public stand(): void {
    this.idleBlend = 1;
    this.runningBlend = 0;
  }

  /** Off his feet in a vortex, or thrown by one (not frozen): flailing. */
  private get isFlailing(): boolean {
    const { bowman } = this;
    if (bowman.isFrozen || bowman.knockdown || bowman.deathFall) {
      return false;
    }
    return bowman.motion.isThrown || (bowman.afflictions.inVortex && bowman.afflictions.lift > FLAIL_LIFT);
  }

  /** The joint pose he's in: knocked down (and getting up), dying, or flailing in (or out of) a vortex. */
  private fallPose(): JointPose | undefined {
    const { knockdown, deathFall } = this.bowman;
    if (this.isFlailing) {
      return getFlailPose(this.lookTimeMs);
    }
    if (knockdown) {
      return armoredFallPose(knockdown.kind, knockdownProgress(knockdown));
    }
    if (deathFall) {
      const { kind, timeMs } = deathFall;
      return armoredFallPose(kind, Math.min(1, timeMs / FALL_DURATION_MS[kind]));
    }
    return undefined;
  }

  public redraw(): void {
    const { body } = this;
    const { aim } = this.bowman;
    body.scale.x = this.facing;
    const fall = this.fallPose();
    if (fall) {
      drawBowmanFall(body, this.look, this.armorColors, fall, BODY_ORIGIN_Y, this.lookTimeMs);
      this.turnAloft();
      return;
    }
    // Leaning into the walk, more when sprinting (as drawStickman leans the sprite).
    body.rotation = (0.06 + 0.04 * this.runningBlend) * (1 - this.idleBlend) * this.leanDirection;
    drawBowmanBody(body, this.look, this.armorColors, {
      phase: this.animationTime,
      idleBlend: this.idleBlend,
      runningBlend: this.runningBlend,
      localAngle: toArcherLocalAngle(aim.angle, body.rotation, this.facing),
      tension: aim.power,
      ready: aim.ready,
    }, BODY_ORIGIN_Y, this.lookTimeMs);
    this.turnAloft();
  }

  /** Thrown, he tumbles; in a vortex he leans into the pull (and rocks round the funnel), flailing a little. */
  private turnAloft(): void {
    const { body, bowman } = this;
    const { flight } = bowman.motion;
    if (flight) {
      body.rotation = flight.rotation;
    } else if (bowman.afflictions.inVortex && !bowman.knockdown && !bowman.deathFall) {
      body.rotation += bowman.afflictions.lean + (this.isFlailing ? 0 : Math.sin(this.lookTimeMs / 90) * 0.06);
    }
  }

  /** Where the arrow is nocked: the string hand, converted from body-sprite space to world space. */
  public getBowReleasePoint(): Vec2 {
    const { body, bowman } = this;
    const localAngle = toArcherLocalAngle(bowman.aim.angle, body.rotation, this.facing);
    const hand = getArcherRig(localAngle, bowman.aim.power, bowman.aim.ready).stringNock;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    const x = hand.x * body.scale.x;
    const y = hand.y * body.scale.y;
    return {
      x: bowman.x + (body.x + x * cos - y * sin) * bowman.scale.x,
      y: bowman.y + (body.y +x * sin + y * cos) * bowman.scale.y,
    };
  }

  /** Where the fire burns from, in container space: the fall pose's joints, or the standing figure's (leaning, toppling). */
  public burnPoints(): Vec2[] {
    const fall = this.fallPose();
    return this.toContainer(fall ? burnPoints(fall) : STANDING_BURN_POINTS);
  }

  /** Body-sprite points in container space (as the body is turned now). */
  public toContainer(points: readonly Vec2[]): Vec2[] {
    return spriteToContainer(points, this.body);
  }
}
