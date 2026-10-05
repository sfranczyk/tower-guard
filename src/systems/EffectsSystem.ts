import { Graphics, type Container } from 'pixi.js';
import { EXPLOSION_RADIUS, LIGHTNING_RADIUS } from '../config';
import type { Vec2 } from '../types';
import { groundAt } from './terrain';

type BloodParticle = {
  sprite: Graphics;
  velocity: Vec2;
  lifeMs: number;
};

/** Generic fading particle: moves, slows with drag, falls (or rises) and grows while fading out. */
type Particle = {
  sprite: Graphics;
  velocity: Vec2;
  lifeMs: number;
  maxLifeMs: number;
  /** px/s²; negative values rise (smoke, fire). */
  gravity: number;
  /** Exponential velocity damping per second. */
  drag: number;
  /** Extra scale reached at the end of life (0 = constant size). */
  grow: number;
  startAlpha: number;
};

type ParticleSpec = Omit<Particle, 'sprite' | 'maxLifeMs' | 'startAlpha'> & { startAlpha?: number };

const BLOOD_GRAVITY = 520;
const FIRE_COLORS = [0xfff1a8, 0xffd166, 0xffa63d, 0xff6b35, 0xe84a27];
const SHAKE_DURATION_MS = 280;
const SHAKE_AMPLITUDE = 5;

const random = (min: number, max: number): number => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Velocity with a random direction inside [minAngle, maxAngle] (radians, 0 = right, −π/2 = up). */
const burst = (minAngle: number, maxAngle: number, minSpeed: number, maxSpeed: number): Vec2 => {
  const angle = random(minAngle, maxAngle);
  const speed = random(minSpeed, maxSpeed);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
};

/** Short-lived visuals: blood, impact flashes, explosions (with camera shake) and ground marks. */
export class EffectsSystem {
  private bloodParticles: BloodParticle[] = [];
  private particles: Particle[] = [];
  private shakeMs = 0;
  private shake: Vec2 = { x: 0, y: 0 };

  public constructor(private readonly container: Container) {}

  /** Current camera shake offset; add it to the world container's position. */
  public get cameraShake(): Vec2 {
    return this.shake;
  }

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
    const stainX = point.x + (Math.random() - 0.5) * 12;
    this.bloodStain(stainX, groundAt(stainX) - 1);
  }

  public impact(point: Vec2): void {
    const sprite = new Graphics().circle(0, 0, 8).fill({ color: 0xf4e7b1, alpha: 0.8 });
    this.spawn(sprite, point, 5, { velocity: { x: 0, y: 0 }, lifeMs: 220, gravity: 0, drag: 0, grow: 0.55 });
  }

  /**
   * Explosion: flash, shockwave, fireballs, sparks and smoke, plus dirt and a scorch mark when it
   * happens at ground level. Also shakes the camera.
   */
  public explosion(point: Vec2): void {
    const radius = EXPLOSION_RADIUS;
    const onGround = point.y >= groundAt(point.x) - 12;
    // On the ground everything is thrown upwards; in the air it bursts in all directions.
    const [minAngle, maxAngle] = onGround ? [-Math.PI * 0.95, -Math.PI * 0.05] : [-Math.PI, Math.PI];
    const still = { x: 0, y: 0 };

    // Smoke first so it sits behind the fire.
    for (let index = 0; index < 7; index += 1) {
      const puff = new Graphics().circle(0, 0, random(9, 15)).fill({ color: pick([0x5f5f63, 0x77777b, 0x4b4b50]) });
      this.spawn(puff, point, 4, {
        velocity: { x: random(-35, 35), y: random(-70, -25) },
        lifeMs: random(900, 1400), gravity: -15, drag: 1.2, grow: 1.3, startAlpha: 0.5,
      });
    }

    const shockwave = new Graphics().circle(0, 0, radius * 0.3).stroke({ width: 4, color: 0xffb347 });
    this.spawn(shockwave, point, 5, { velocity: still, lifeMs: 320, gravity: 0, drag: 0, grow: 2.4, startAlpha: 0.85 });

    for (let index = 0; index < 12; index += 1) {
      const fireball = new Graphics().circle(0, 0, random(5, 11)).fill({ color: pick(FIRE_COLORS) });
      this.spawn(fireball, point, 5, {
        velocity: burst(minAngle, maxAngle, 60, 210),
        lifeMs: random(320, 560), gravity: -80, drag: 4, grow: 0.5,
      });
    }

    for (let index = 0; index < 14; index += 1) {
      const spark = new Graphics().circle(0, 0, random(1, 2)).fill({ color: 0xfff1a8 });
      this.spawn(spark, point, 6, {
        velocity: burst(minAngle, maxAngle, 200, 420),
        lifeMs: random(380, 700), gravity: 600, drag: 1.5, grow: 0,
      });
    }

    const flash = new Graphics().circle(0, 0, radius * 0.45).fill({ color: 0xfff6c8 });
    this.spawn(flash, point, 6, { velocity: still, lifeMs: 140, gravity: 0, drag: 0, grow: 0.6, startAlpha: 0.9 });

    if (onGround) {
      for (let index = 0; index < 9; index += 1) {
        const dirt = new Graphics().rect(-2, -2, random(2, 4), random(2, 4)).fill({ color: pick([0x6b4f32, 0x4f3a25, 0x7d9a55]) });
        this.spawn(dirt, point, 5, {
          velocity: burst(-Math.PI * 0.85, -Math.PI * 0.15, 150, 320),
          lifeMs: random(500, 800), gravity: 750, drag: 0.5, grow: 0,
        });
      }
      this.scorchMark(point.x, radius);
    }

    this.shakeMs = SHAKE_DURATION_MS;
  }

  /** Ground lightning strike: a white flash, blue-white sparks thrown up, smoke, a scorch mark, a shake. */
  public lightningStrike(point: Vec2): void {
    const still = { x: 0, y: 0 };
    const flash = new Graphics().circle(0, 0, LIGHTNING_RADIUS * 0.8).fill({ color: 0xe8f1ff });
    this.spawn(flash, point, 6, { velocity: still, lifeMs: 180, gravity: 0, drag: 0, grow: 0.8, startAlpha: 0.85 });
    for (let index = 0; index < 5; index += 1) {
      const smoke = new Graphics().circle(0, 0, random(7, 12)).fill({ color: pick([0x5f6470, 0x4b505b]) });
      this.spawn(smoke, { x: point.x + random(-10, 10), y: point.y - 4 }, 4, {
        velocity: { x: random(-20, 20), y: random(-55, -25) },
        lifeMs: random(700, 1100), gravity: -10, drag: 1.2, grow: 1.2, startAlpha: 0.45,
      });
    }
    for (let index = 0; index < 18; index += 1) {
      const spark = new Graphics().circle(0, 0, random(1, 2.2)).fill({ color: pick([0xffffff, 0xd6e6ff, 0x9ec5ff]) });
      this.spawn(spark, point, 6, {
        velocity: burst(-Math.PI * 0.95, -Math.PI * 0.05, 150, 400),
        lifeMs: random(300, 650), gravity: 700, drag: 1.5, grow: 0,
      });
    }
    this.scorchMark(point.x, LIGHTNING_RADIUS * 1.6);
    this.shakeMs = SHAKE_DURATION_MS;
  }

  public update(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    this.bloodParticles = this.bloodParticles.filter((particle) => {
      particle.lifeMs -= deltaMs;
      particle.velocity.y += BLOOD_GRAVITY * deltaSeconds;
      particle.sprite.x += particle.velocity.x * deltaSeconds;
      particle.sprite.y += particle.velocity.y * deltaSeconds;
      particle.sprite.alpha = Math.min(1, particle.lifeMs / 180);

      const landed = particle.sprite.y >= groundAt(particle.sprite.x) - 2;
      if (landed || particle.lifeMs <= 0) {
        if (landed) {
          this.bloodStain(particle.sprite.x, groundAt(particle.sprite.x) - 1);
        }
        this.remove(particle.sprite);
        return false;
      }
      return true;
    });

    this.particles = this.particles.filter((particle) => {
      particle.lifeMs -= deltaMs;
      if (particle.lifeMs <= 0) {
        this.remove(particle.sprite);
        return false;
      }
      const damping = Math.exp(-particle.drag * deltaSeconds);
      particle.velocity.x *= damping;
      particle.velocity.y = particle.velocity.y * damping + particle.gravity * deltaSeconds;
      particle.sprite.x += particle.velocity.x * deltaSeconds;
      particle.sprite.y += particle.velocity.y * deltaSeconds;
      const life = particle.lifeMs / particle.maxLifeMs;
      particle.sprite.alpha = particle.startAlpha * life;
      particle.sprite.scale.set(1 + particle.grow * (1 - life));
      return true;
    });

    this.shakeMs = Math.max(0, this.shakeMs - deltaMs);
    const strength = SHAKE_AMPLITUDE * (this.shakeMs / SHAKE_DURATION_MS);
    this.shake = { x: random(-strength, strength), y: random(-strength, strength) };
  }

  private spawn(sprite: Graphics, point: Vec2, zIndex: number, spec: ParticleSpec): void {
    sprite.position.set(point.x, point.y);
    sprite.zIndex = zIndex;
    sprite.alpha = spec.startAlpha ?? 1;
    this.container.addChild(sprite);
    this.particles.push({ ...spec, sprite, maxLifeMs: spec.lifeMs, startAlpha: spec.startAlpha ?? 1 });
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

  /** Burnt patch left on the ground by an explosion; stays until the scene is torn down. */
  private scorchMark(x: number, radius: number): void {
    const scorch = new Graphics()
      .ellipse(0, 0, radius * 0.5, 5).fill({ color: 0x2b2420, alpha: 0.45 })
      .ellipse(0, 0, radius * 0.28, 3).fill({ color: 0x1a1512, alpha: 0.5 });
    scorch.position.set(x, groundAt(x) + 1);
    scorch.zIndex = 0;
    this.container.addChild(scorch);
  }

  private remove(sprite: Graphics): void {
    this.container.removeChild(sprite);
    sprite.destroy();
  }
}
