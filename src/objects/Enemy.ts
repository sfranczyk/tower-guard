import { Container, Graphics, Text } from 'pixi.js';
import { ENEMY_ATTACK_INTERVAL_MS, ENEMY_GROUND_Y } from '../config';

type AnimationPoint = { x: number; y: number };
const ATTACK_ANIMATION_DURATION_MS = 1_130;

const drawWalkingEnemy = (sprite: Graphics, phase: number): void => {
  sprite.clear();
  const skeleton = 0xd76565;
  const rear = 0x8f3141;
  const hip = { x: 0, y: 0 };
  const shoulder = { x: 0, y: -35 };
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const rightLegIsSwinging = cycle < Math.PI;
  const progress = rightLegIsSwinging ? cycle / Math.PI : (cycle - Math.PI) / Math.PI;
  const eased = progress * progress * (3 - 2 * progress);
  const swingFoot = { x: -22 + eased * 44, y: 55 - Math.sin(progress * Math.PI) * 20 };
  const stanceFoot = { x: 22 - eased * 44, y: 55 };
  const rightFoot = rightLegIsSwinging ? swingFoot : stanceFoot;
  const leftFoot = rightLegIsSwinging ? stanceFoot : swingFoot;
  const swingKneeBend = 0.2 - Math.sin(progress * Math.PI) * 0.85;

  const line = (from: AnimationPoint, to: AnimationPoint, isRear = false, width = 3.5): void => {
    sprite.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({
      width: isRear ? width - 0.5 : width,
      color: isRear ? rear : skeleton,
      cap: 'round',
    });
  };
  const joint = (point: AnimationPoint, isRear = false): void => {
    sprite.circle(point.x, point.y, 3).stroke({ width: 1.5, color: isRear ? rear : skeleton });
  };
  const drawLeg = (foot: AnimationPoint, bend: number, isRear: boolean): void => {
    const dx = foot.x - hip.x;
    const dy = foot.y - hip.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const targetLength = Math.min(59.99, length);
    const ux = dx / length;
    const uy = dy / length;
    const along = targetLength / 2;
    const height = Math.sqrt(Math.max(0, 30 ** 2 - along ** 2));
    const knee = {
      x: hip.x + ux * along - uy * height * bend,
      y: hip.y + uy * along + ux * height * bend,
    };
    line(hip, knee, isRear);
    line(knee, foot, isRear);
    joint(knee, isRear);
    sprite.circle(foot.x, foot.y, 2.5).fill({ color: isRear ? rear : skeleton });
    line({ x: foot.x - 6, y: foot.y }, { x: foot.x + 9, y: foot.y }, isRear, 3);
  };
  const drawArm = (angle: number, isRear: boolean): AnimationPoint => {
    const elbow = { x: Math.sin(angle) * 21, y: shoulder.y + Math.cos(angle) * 21 };
    const forearmAngle = angle + 0.2;
    const hand = { x: elbow.x + Math.sin(forearmAngle) * 21, y: elbow.y + Math.cos(forearmAngle) * 21 };
    line(shoulder, elbow, isRear);
    line(elbow, hand, isRear);
    joint(elbow, isRear);
    sprite.circle(hand.x, hand.y, 2.5).fill({ color: isRear ? rear : skeleton });
    return hand;
  };
  const drawStick = (hand: AnimationPoint): void => {
    sprite.moveTo(hand.x - 4, hand.y + 5).lineTo(hand.x + 26, hand.y - 24)
      .stroke({ width: 4, color: 0x563b2c, cap: 'round' });
  };

  drawLeg(leftFoot, rightLegIsSwinging ? 0.2 : swingKneeBend, true);
  drawArm(Math.sin(phase) * 0.42, true);
  line(hip, shoulder);
  joint(hip);
  line(shoulder, { x: 0, y: -43 });
  sprite.circle(0, -52, 10).fill({ color: 0xc17a5e }).stroke({ width: 2, color: 0x271b2a });
  sprite.moveTo(-10, -55).lineTo(0, -64).lineTo(11, -55).lineTo(8, -50).lineTo(-8, -50).closePath()
    .fill({ color: 0x3a2531 }).stroke({ width: 2, color: 0x171725 });
  drawLeg(rightFoot, rightLegIsSwinging ? swingKneeBend : 0.2, false);
  drawStick(drawArm(-Math.sin(phase) * 0.42, false));
};

const drawStandingEnemy = (sprite: Graphics): void => {
  sprite.clear();
  const skeleton = 0xd76565;
  const rear = 0x8f3141;
  const line = (from: AnimationPoint, to: AnimationPoint, isRear = false, width = 3.5): void => {
    sprite.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({
      width: isRear ? width - 0.5 : width,
      color: isRear ? rear : skeleton,
      cap: 'round',
    });
  };
  const joint = (point: AnimationPoint, isRear = false): void => {
    sprite.circle(point.x, point.y, 3).stroke({ width: 1.5, color: isRear ? rear : skeleton });
  };
  const hip = { x: 0, y: 0 };
  const shoulder = { x: 0, y: -35 };
  const rearKnee = { x: -8, y: 28 };
  const rearFoot = { x: -16, y: 55 };
  const frontKnee = { x: 8, y: 28 };
  const frontFoot = { x: 16, y: 55 };
  const rearElbow = { x: -13, y: -13 };
  const rearHand = { x: -13, y: 8 };
  const frontElbow = { x: 13, y: -13 };
  const frontHand = { x: 13, y: 8 };
  const drawStick = (hand: AnimationPoint): void => {
    sprite.moveTo(hand.x - 4, hand.y + 5).lineTo(hand.x + 26, hand.y - 24)
      .stroke({ width: 4, color: 0x563b2c, cap: 'round' });
  };

  line(hip, rearKnee, true);
  line(rearKnee, rearFoot, true);
  line(shoulder, rearElbow, true);
  line(rearElbow, rearHand, true);
  line(hip, shoulder);
  line(hip, frontKnee);
  line(frontKnee, frontFoot);
  line(shoulder, frontElbow);
  line(frontElbow, frontHand);
  joint(hip);
  joint(rearKnee, true);
  joint(rearElbow, true);
  joint(frontKnee);
  joint(frontElbow);
  sprite.circle(0, -52, 10).fill({ color: 0xc17a5e }).stroke({ width: 2, color: 0x271b2a });
  sprite.moveTo(-10, -55).lineTo(0, -64).lineTo(11, -55).lineTo(8, -50).lineTo(-8, -50).closePath()
    .fill({ color: 0x3a2531 }).stroke({ width: 2, color: 0x171725 });
  drawStick(frontHand);
};

export type EnemyTarget = 'bowman' | 'tower';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type EnemyAnimationRenderer = (
  sprite: Graphics,
  phase: number,
  idleBlend?: number,
  armed?: boolean,
  running?: boolean,
  runningBlend?: number,
  originY?: number,
  attackPhase?: number,
) => void;

export default class Enemy extends Container {
  private readonly body: Graphics;
  private readonly healthLabel: Text;
  private readonly maxHealth: number;
  private health: number;
  private readonly speed: number;
  private readonly animationRenderer?: EnemyAnimationRenderer;
  private attackCooldown = 0;
  private hitStaggerMs = 0;
  private animationTime = 0;
  private attackTimerMs = 0;
  private attackPhase = 0;
  private velocity = { x: 0, y: 0 };
  private alive = true;
  public target: EnemyTarget;

  public constructor(
    x: number,
    health = 3,
    speed = 60,
    target: EnemyTarget = 'bowman',
    animationRenderer?: EnemyAnimationRenderer,
  ) {
    super();
    this.body = new Graphics();
    this.drawPlaceholder();
    this.addChild(this.body);
    this.healthLabel = new Text({
      text: '',
      style: {
        fill: 0xffffff,
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: '700',
        stroke: { color: 0x3b2030, width: 3 },
      },
    });
    this.healthLabel.anchor.set(0.5);
    this.healthLabel.scale.set(2);
    this.healthLabel.position.set(0, -76);
    this.addChild(this.healthLabel);
    this.health = Math.max(0, health);
    this.maxHealth = Math.max(1, health);
    this.speed = Math.max(0, speed);
    this.target = target;
    this.animationRenderer = animationRenderer;
    this.scale.set(2 / 3, 2 / 3);
    this.position.set(x, ENEMY_GROUND_Y);
    this.zIndex = 1;
    this.velocity.x = -this.speed;
    this.updateHealthLabel();
  }

  private drawPlaceholder(): void {
    drawWalkingEnemy(this.body, 0);
    this.body.position.set(0, -29);
    this.body.scale.set(-0.5, 0.52);
  }

  public takeDamage(amount: number): number {
    if (!this.isAlive()) {
      return this.health;
    }

    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.updateHealthLabel();
    if (this.health === 0) {
      this.alive = false;
      this.y = ENEMY_GROUND_Y + 12;
      this.body.rotation = 0.35;
      this.body.alpha = 0.6;
      this.velocity = { x: 0, y: 0 };
    }

    return this.health;
  }

  public clearHitTint(): void {
    if (!this.isAlive()) {
      return;
    }
    this.body.alpha = 1;
  }

  public applyHitReaction(pushX: number): void {
    if (!this.isAlive()) {
      return;
    }
    this.hitStaggerMs = Math.max(this.hitStaggerMs, 120);
    this.x += Math.max(-6, Math.min(8, pushX));
  }

  public playAttackAnimation(): void {
    this.attackTimerMs = ATTACK_ANIMATION_DURATION_MS;
    this.attackPhase = 0;
    this.body.rotation = -0.18;
  }

  public updateAnimation(deltaMs: number, moving: boolean): void {
    if (!this.isAlive()) {
      return;
    }

    if (this.attackTimerMs > 0) {
      this.attackTimerMs = Math.max(0, this.attackTimerMs - deltaMs);
      const attackProgress = 1 - this.attackTimerMs / ATTACK_ANIMATION_DURATION_MS;
      if (this.animationRenderer) {
        this.animationRenderer(
          this.body,
          this.animationTime,
          1,
          true,
          false,
          0,
          -25,
          Math.max(0.001, attackProgress * Math.PI * 2),
        );
      }
      if (this.attackTimerMs <= ATTACK_ANIMATION_DURATION_MS * 0.52 && this.attackPhase === 0) {
        this.attackPhase = 1;
      }
      if (this.attackTimerMs === 0) {
        this.body.rotation = 0;
        this.attackPhase = 0;
      }
      return;
    }

    if (!moving) {
      this.body.rotation = 0;
      this.body.y = -29;
      if (this.animationRenderer) {
        this.animationRenderer(this.body, this.animationTime, 1, true, false, 0, -25);
      } else {
        drawStandingEnemy(this.body);
      }
      return;
    }

    this.animationTime += deltaMs;
    if (this.animationRenderer) {
      this.animationRenderer(this.body, this.animationTime / 150, 0, true, false, 0, -25);
      this.body.scale.x = this.velocity.x < 0 ? -0.5 : 0.5;
      this.body.rotation = this.velocity.x < 0 ? -0.06 : 0.06;
      return;
    }
    const phase = this.animationTime / 150;
    this.body.scale.x = this.velocity.x < 0 ? -0.5 : 0.5;
    drawWalkingEnemy(this.body, phase);
    this.body.rotation = this.velocity.x < 0 ? -0.06 : 0.06;
    this.body.y = -29 + (0.5 + Math.cos(phase * 2) * 0.5) * 1.4;
  }

  public isAlive(): boolean {
    return this.alive && this.health > 0;
  }

  public getHealthRatio(): number {
    return this.health / this.maxHealth;
  }

  public getPhysicsBounds(): Rect {
    const width = 14;
    const height = 28;
    const x = this.x - width / 2;
    const y = this.y - height;
    return {
      x,
      y,
      width,
      height,
      left: x,
      right: x + width,
      top: y,
      bottom: y + height,
    };
  }

  public update(deltaMs: number, target?: Vec2, stopDistance = 0): void {
    if (!this.isAlive()) {
      return;
    }

    this.hitStaggerMs = Math.max(0, this.hitStaggerMs - deltaMs);
    if (this.hitStaggerMs > 0) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.y = ENEMY_GROUND_Y;
      return;
    }

    if (target) {
      const distanceToTarget = target.x - this.x;
      if (Math.abs(distanceToTarget) <= stopDistance) {
        this.velocity.x = 0;
        this.velocity.y = 0;
      } else {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const length = Math.hypot(dx, dy) || 1;
        this.velocity.x = (dx / length) * this.speed;
        this.velocity.y = (dy / length) * this.speed;
      }
    } else {
      this.velocity.x = -this.speed;
      this.velocity.y = 0;
    }

    const deltaSeconds = deltaMs / 1000;
    this.x += this.velocity.x * deltaSeconds;
    this.y = ENEMY_GROUND_Y;
  }

  public canAttack(deltaMs: number): boolean {
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaMs);
    if (this.attackCooldown > 0) {
      return false;
    }
    this.attackCooldown = ENEMY_ATTACK_INTERVAL_MS;
    return true;
  }

  public isMoving(): boolean {
    return Math.abs(this.velocity.x) > 1 || Math.abs(this.velocity.y) > 1;
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }
  }

  private updateHealthLabel(): void {
    this.healthLabel.text = `${Math.ceil(this.getHealthRatio() * 100)}%`;
    this.healthLabel.alpha = this.isAlive() ? 1 : 0.55;
  }
}
