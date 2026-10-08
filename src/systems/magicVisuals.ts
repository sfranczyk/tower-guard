import { Graphics, type Container } from 'pixi.js';
import { FIRE_PATCH_MS, FIRE_PATCH_RADIUS, VORTEX_MS, VORTEX_RADIUS, VORTEX_TOP } from '../config';
import { drawBurning } from '../rendering/burning';
import { drawVortex } from '../rendering/vortexArt';
import type { ProjectileType, Vec2 } from '../types';
import { groundAt } from './terrain';

/** A fading particle as EffectsSystem spawns it (see its `spawn`). */
export interface MagicParticle {
  velocity: Vec2;
  lifeMs: number;
  gravity: number;
  drag: number;
  grow: number;
  startAlpha?: number;
}

export type SpawnParticle = (sprite: Graphics, point: Vec2, zIndex: number, spec: MagicParticle) => void;

const FIRE = [0xfff1a8, 0xffd166, 0xffa63d, 0xff6b35];
const ICE = [0xffffff, 0xe1f4ff, 0xb5e0ff, 0x8cc8f2];
const ARCANE = [0xf1e6ff, 0xc9a8ff, 0x9a6ee6];
/** Funnel height of the vortex (px): a little above where it throws them out. */
const VORTEX_HEIGHT = VORTEX_TOP + 25;
/** Fire patch flames in burning.ts sprite units (≈ 19 px tall). */
const PATCH_FLAME_SIZE = 0.55;
const PATCH_FLAMES = 7;

const random = (min: number, max: number): number => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

interface Lasting {
  art: Graphics;
  point: Vec2;
  ageMs: number;
  lifeMs: number;
  draw(lasting: Lasting): void;
}

/**
 * The fire, frost and vortex arrows' visuals (EffectsSystem forwards them, so a co-op guest sees them too): bursts
 * of flame and frost, ice shattering, the fire left in the ground, the vortex (and its dying away) and the arrows'
 * trails in flight.
 */
export class MagicVisuals {
  private lasting: Lasting[] = [];

  public constructor(private readonly container: Container, private readonly spawn: SpawnParticle) {}

  /** A fire arrow strikes: a puff of flame and embers. */
  public fireBurst(point: Vec2): void {
    for (let index = 0; index < 8; index += 1) {
      const flame = new Graphics().circle(0, 0, random(3, 6)).fill({ color: pick(FIRE) });
      this.spawn(flame, point, 5, { velocity: { x: random(-60, 60), y: random(-110, -30) }, lifeMs: random(280, 480), gravity: -80, drag: 2.5, grow: 0.6 });
    }
    this.embers(point, 10);
  }

  /** A frost arrow strikes: frost glints, a few ice chips and a cold mist. */
  public frostBurst(point: Vec2): void {
    for (let index = 0; index < 4; index += 1) {
      const mist = new Graphics().circle(0, 0, random(6, 10)).fill({ color: 0xe8f6ff });
      this.spawn(mist, point, 4, { velocity: { x: random(-25, 25), y: random(-30, -5) }, lifeMs: random(500, 800), gravity: -10, drag: 1.5, grow: 1.2, startAlpha: 0.45 });
    }
    this.iceChips(point, 7, 160);
  }

  /** A frozen enemy shatters: a burst of ice shards and a cloud of frost. */
  public shatter(point: Vec2): void {
    for (let index = 0; index < 7; index += 1) {
      const mist = new Graphics().circle(0, 0, random(8, 14)).fill({ color: 0xe8f6ff });
      this.spawn(mist, point, 4, { velocity: { x: random(-50, 50), y: random(-50, 0) }, lifeMs: random(600, 1000), gravity: -12, drag: 1.4, grow: 1.4, startAlpha: 0.5 });
    }
    this.iceChips(point, 22, 320);
  }

  /** A fire arrow in the ground: flames along a stretch of it for FIRE_PATCH_MS, and a scorch mark. */
  public firePatch(point: Vec2): void {
    const art = new Graphics();
    art.zIndex = 2;
    this.container.addChild(art);
    const points = Array.from({ length: PATCH_FLAMES }, (_, index) => {
      const x = point.x + (index / (PATCH_FLAMES - 1) - 0.5) * FIRE_PATCH_RADIUS * 1.6;
      return { x, y: groundAt(x) };
    });
    this.lasting.push({
      art, point, ageMs: 0, lifeMs: FIRE_PATCH_MS,
      draw: ({ art: g, ageMs, lifeMs }) => {
        // Flares up, burns, dies down.
        const intensity = Math.min(1, ageMs / 200, (lifeMs - ageMs) / 700);
        g.clear();
        drawBurning(g, points, ageMs, intensity, PATCH_FLAME_SIZE);
        if (Math.random() < 0.15 * intensity) {
          this.embers({ x: pick(points).x, y: point.y - 6 }, 1);
        }
      },
    });
    const scorch = new Graphics().ellipse(0, 0, FIRE_PATCH_RADIUS, 4).fill({ color: 0x2b2420, alpha: 0.4 });
    scorch.position.set(point.x, groundAt(point.x) + 1);
    scorch.zIndex = 0;
    this.container.addChild(scorch);
  }

  /** A vortex opens at `point` (on the ground) for VORTEX_MS and ends in a burst of light. */
  public vortex(point: Vec2): void {
    const art = new Graphics();
    art.zIndex = 3;
    this.container.addChild(art);
    const ground = { x: point.x, y: groundAt(point.x) };
    this.lasting.push({
      art, point: ground, ageMs: 0, lifeMs: VORTEX_MS,
      draw: ({ art: g, ageMs }) => {
        drawVortex(g, ground, ageMs, VORTEX_RADIUS, VORTEX_HEIGHT);
        // Dust and leaves sucked in from the edges.
        if (Math.random() < 0.5) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const from = { x: ground.x + side * random(0.6, 1) * VORTEX_RADIUS, y: groundAt(ground.x + side * VORTEX_RADIUS) - random(2, 10) };
          const dust = new Graphics().circle(0, 0, random(1.5, 3)).fill({ color: pick([0x8a7a5a, 0x6b8a3a, 0xa08a62]) });
          this.spawn(dust, from, 3, { velocity: { x: -side * random(90, 160), y: random(-60, -20) }, lifeMs: random(500, 800), gravity: -20, drag: 0.6, grow: 0 });
        }
      },
    });
  }

  /** The vortex dies away: a gust of dust and arcane motes thrown out along the ground. */
  public vortexFade(point: Vec2): void {
    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const at = { x: point.x + side * random(0, 30), y: groundAt(point.x) - random(2, 40) };
      const mote = new Graphics().circle(0, 0, random(1.5, 3)).fill({ color: pick([...ARCANE, 0x8a7a5a, 0xa08a62]) });
      this.spawn(mote, at, 5, { velocity: { x: side * random(140, 300), y: random(-90, -10) }, lifeMs: random(350, 650), gravity: 200, drag: 2, grow: 0 });
    }
  }

  /** What a fire, frost or vortex arrow leaves behind it in flight (called every frame while it flies). */
  public arrowTrail(type: ProjectileType, point: Vec2, deltaMs: number): void {
    const chance = Math.min(1, deltaMs / 16);
    if (type === 'fire') {
      if (Math.random() < 0.9 * chance) {
        const flame = new Graphics().circle(0, 0, random(2, 3.5)).fill({ color: pick(FIRE) });
        this.spawn(flame, point, 2, { velocity: { x: random(-15, 15), y: random(-40, -10) }, lifeMs: random(200, 340), gravity: -60, drag: 2, grow: -0.5 });
      }
      if (Math.random() < 0.3 * chance) {
        const smoke = new Graphics().circle(0, 0, random(2.5, 4)).fill({ color: 0x5f5f63 });
        this.spawn(smoke, point, 1, { velocity: { x: random(-10, 10), y: random(-25, -10) }, lifeMs: random(500, 800), gravity: -10, drag: 1, grow: 1.2, startAlpha: 0.35 });
      }
    } else if (type === 'frost') {
      if (Math.random() < 0.6 * chance) {
        const glint = new Graphics().circle(0, 0, random(1, 2)).fill({ color: pick(ICE) });
        this.spawn(glint, { x: point.x + random(-3, 3), y: point.y + random(-3, 3) }, 2, { velocity: { x: random(-10, 10), y: random(5, 25) }, lifeMs: random(350, 600), gravity: 40, drag: 1, grow: 0 });
      }
    } else if (type === 'vortex' && Math.random() < 0.7 * chance) {
      const angle = random(0, Math.PI * 2);
      const mote = new Graphics().circle(0, 0, random(1.2, 2.4)).fill({ color: pick(ARCANE) });
      this.spawn(mote, { x: point.x + Math.cos(angle) * 6, y: point.y + Math.sin(angle) * 6 }, 2, {
        velocity: { x: -Math.sin(angle) * 40, y: Math.cos(angle) * 40 }, lifeMs: random(300, 500), gravity: 0, drag: 1.5, grow: 0,
      });
    }
  }

  public update(deltaMs: number): void {
    this.lasting = this.lasting.filter((lasting) => {
      lasting.ageMs += deltaMs;
      if (lasting.ageMs >= lasting.lifeMs) {
        this.container.removeChild(lasting.art);
        lasting.art.destroy();
        return false;
      }
      lasting.draw(lasting);
      return true;
    });
  }

  private embers(point: Vec2, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const ember = new Graphics().circle(0, 0, random(0.8, 1.6)).fill({ color: pick([0xffd166, 0xff8a2e, 0xfff1a8]) });
      this.spawn(ember, point, 5, { velocity: { x: random(-70, 70), y: random(-160, -60) }, lifeMs: random(500, 900), gravity: 120, drag: 1.2, grow: 0 });
    }
  }

  /** Little shards of ice: thin pale polygons spinning off, falling. */
  private iceChips(point: Vec2, count: number, speed: number): void {
    for (let index = 0; index < count; index += 1) {
      const size = random(2, 5);
      const shard = new Graphics().poly([0, -size, size * 0.5, 0, 0, size * 0.8, -size * 0.45, 0]).fill({ color: pick(ICE) })
        .poly([0, -size, size * 0.5, 0, 0, size * 0.8, -size * 0.45, 0]).stroke({ width: 0.6, color: 0x6fa9d6, alpha: 0.7 });
      shard.rotation = random(0, Math.PI * 2);
      const angle = random(-Math.PI * 0.95, -Math.PI * 0.05);
      const velocity = random(speed * 0.35, speed);
      this.spawn(shard, point, 5, { velocity: { x: Math.cos(angle) * velocity, y: Math.sin(angle) * velocity }, lifeMs: random(500, 900), gravity: 520, drag: 0.8, grow: 0 });
    }
  }
}
