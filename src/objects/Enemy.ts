import { Container, Graphics, Text } from 'pixi.js';
import { ENEMY_ATTACK_INTERVAL_MS, ENEMY_GROUND_Y } from '../config';
import { STICKMAN_HEAD, drawStickman, type StickmanPose } from '../rendering/stickman';
import type { Bounds, Vec2 } from '../types';

const ATTACK_ANIMATION_DURATION_MS = 1_130;

export type EnemyTarget = 'bowman' | 'tower';

const ENEMY_POSE: StickmanPose = { armed: true, originY: -25 };

export default class Enemy extends Container {
  private readonly body: Graphics;
  private readonly healthLabel: Text;
  private readonly maxHealth: number;
  private health: number;
  private readonly speed: number;
  private attackCooldown = 0;
  private hitStaggerMs = 0;
  private animationTime = 0;
  private attackTimerMs = 0;
  private velocity = { x: 0, y: 0 };
  private alive = true;
  public target: EnemyTarget;

  public constructor(
    x: number,
    health = 3,
    speed = 60,
    target: EnemyTarget = 'bowman',
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
    this.scale.set(2 / 3, 2 / 3);
    this.position.set(x, ENEMY_GROUND_Y);
    this.zIndex = 1;
    this.velocity.x = -this.speed;
    this.updateHealthLabel();
  }

  private drawPlaceholder(): void {
    drawStickman(this.body, 0, { ...ENEMY_POSE, idleBlend: 1 });
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
    this.body.rotation = -0.18;
  }

  public updateAnimation(deltaMs: number, moving: boolean): void {
    if (!this.isAlive()) {
      return;
    }

    if (this.attackTimerMs > 0) {
      this.attackTimerMs = Math.max(0, this.attackTimerMs - deltaMs);
      const attackProgress = 1 - this.attackTimerMs / ATTACK_ANIMATION_DURATION_MS;
      drawStickman(this.body, this.animationTime, {
        ...ENEMY_POSE,
        idleBlend: 1,
        attackPhase: Math.max(0.001, attackProgress * Math.PI * 2),
      });
      if (this.attackTimerMs === 0) {
        this.body.rotation = 0;
      }
      return;
    }

    if (!moving) {
      this.body.rotation = 0;
      this.body.y = -29;
      drawStickman(this.body, this.animationTime, { ...ENEMY_POSE, idleBlend: 1 });
      return;
    }

    this.animationTime += deltaMs;
    drawStickman(this.body, this.animationTime / 150, ENEMY_POSE);
    this.body.scale.x = this.velocity.x < 0 ? -0.5 : 0.5;
    this.body.rotation = this.velocity.x < 0 ? -0.06 : 0.06;
  }

  public isAlive(): boolean {
    return this.alive && this.health > 0;
  }

  public getHealthRatio(): number {
    return this.health / this.maxHealth;
  }

  public getPhysicsBounds(): Bounds {
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

  /** Box around the drawn head (follows bob, lean and scale), in world space. */
  public getHeadBounds(): Bounds {
    const { body } = this;
    const cos = Math.cos(body.rotation);
    const sin = Math.sin(body.rotation);
    const localX = STICKMAN_HEAD.x * body.scale.x;
    const localY = STICKMAN_HEAD.y * body.scale.y;
    const centerX = this.x + (body.x + localX * cos - localY * sin) * this.scale.x;
    const centerY = this.y + (body.y + localX * sin + localY * cos) * this.scale.y;
    const radius = STICKMAN_HEAD.radius * Math.abs(body.scale.x) * this.scale.x;
    return {
      x: centerX - radius,
      y: centerY - radius,
      width: radius * 2,
      height: radius * 2,
      left: centerX - radius,
      right: centerX + radius,
      top: centerY - radius,
      bottom: centerY + radius,
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
