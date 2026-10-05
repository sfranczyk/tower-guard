import { Graphics, type Container } from 'pixi.js';
import { EXPLOSION_RADIUS, GROUND_Y } from '../config';
import type { Vec2 } from '../types';

type BloodParticle = {
  sprite: Graphics;
  velocity: Vec2;
  lifeMs: number;
};

type FadingEffect = {
  sprite: Graphics;
  lifeMs: number;
  maxLifeMs: number;
};

const BLOOD_GRAVITY = 520;

/** Short-lived visuals: blood particles and stains, impact flashes and explosion rings. */
export class EffectsSystem {
  private bloodParticles: BloodParticle[] = [];
  private effects: FadingEffect[] = [];

  public constructor(private readonly container: Container) {}

  public bloodBurst(point: Vec2): void {
    for (let index = 0; index < 8; index += 1) {
      const particle = new Graphics()
        .circle(0, 0, 1.5 + Math.random() * 2)
        .fill({ color: index % 3 === 0 ? 0x8f2035 : 0xc33d48 });
      particle.position.set(point.x, point.y);
      particle.zIndex = 3;
      this.container.addChild(particle);
      this.bloodParticles.push({
        sprite: particle,
        velocity: {
          x: (Math.random() - 0.5) * 150,
          y: -80 - Math.random() * 170,
        },
        lifeMs: 480 + Math.random() * 420,
      });
    }
    this.bloodStain(point.x + (Math.random() - 0.5) * 12, GROUND_Y - 1);
  }

  public impact(point: Vec2, explosive: boolean): void {
    const sprite = new Graphics();
    sprite.circle(0, 0, explosive ? 18 : 8).fill({
      color: explosive ? 0xffc857 : 0xf4e7b1,
      alpha: 0.8,
    });
    sprite.position.set(point.x, point.y);
    sprite.zIndex = 5;
    this.container.addChild(sprite);
    this.effects.push({ sprite, lifeMs: 220, maxLifeMs: 220 });
  }

  public explosion(point: Vec2): void {
    const ring = new Graphics().circle(0, 0, EXPLOSION_RADIUS)
      .stroke({ width: 5, color: 0xffa63d, alpha: 0.75 })
      .circle(0, 0, EXPLOSION_RADIUS * 0.6)
      .fill({ color: 0xffd166, alpha: 0.18 });
    ring.position.set(point.x, point.y);
    ring.zIndex = 4;
    this.container.addChild(ring);
    this.effects.push({ sprite: ring, lifeMs: 360, maxLifeMs: 360 });
  }

  public update(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.bloodParticles = this.bloodParticles.filter((particle) => {
      particle.lifeMs -= deltaMs;
      particle.velocity.y += BLOOD_GRAVITY * deltaSeconds;
      particle.sprite.x += particle.velocity.x * deltaSeconds;
      particle.sprite.y += particle.velocity.y * deltaSeconds;
      particle.sprite.alpha = Math.min(1, particle.lifeMs / 180);

      const landed = particle.sprite.y >= GROUND_Y - 2;
      if (landed || particle.lifeMs <= 0) {
        if (landed) {
          this.bloodStain(particle.sprite.x, GROUND_Y - 1);
        }
        this.remove(particle.sprite);
        return false;
      }
      return true;
    });

    this.effects = this.effects.filter((effect) => {
      effect.lifeMs -= deltaMs;
      effect.sprite.alpha = Math.max(0, effect.lifeMs / effect.maxLifeMs);
      effect.sprite.scale.set(1 + (1 - effect.lifeMs / effect.maxLifeMs) * 0.55);
      if (effect.lifeMs <= 0) {
        this.remove(effect.sprite);
        return false;
      }
      return true;
    });
  }

  /** Stains stay on the ground until the scene is torn down. */
  private bloodStain(x: number, y: number): void {
    const stain = new Graphics()
      .ellipse(0, 0, 3 + Math.random() * 6, 1.5 + Math.random() * 2)
      .fill({ color: 0x7e2637, alpha: 0.72 });
    stain.position.set(x, y);
    stain.rotation = (Math.random() - 0.5) * 0.8;
    stain.zIndex = 0;
    this.container.addChild(stain);
  }

  private remove(sprite: Graphics): void {
    this.container.removeChild(sprite);
    sprite.destroy();
  }
}
