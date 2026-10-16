import { Container, Graphics } from 'pixi.js';
import type { GameTextures } from '../core/Scene';
import { launchSpeed } from '../data/projectiles';
import Arrow from '../objects/Arrow';
import type Bowman from '../objects/bowman/Bowman';
import { ARCHERY_TARGET, drawArcheryTarget } from '../rendering/archeryTarget';
import { solveLaunchAngle } from '../systems/ballistics';
import { groundAt } from '../systems/terrain';
import type { Vec2 } from '../types';

/** The menu bowman's practice: pause, draw, loose at one of the targets; a few arrows stay stuck in them. */
const RANGE = {
  restMs: { min: 1300, max: 2600 },
  drawMs: 850,
  power: { min: 0.5, max: 0.75 },
  /** Share of shots that go wide of the face (into the ground or past). */
  missChance: 0.15,
  /** Stuck arrows kept; older ones are taken away. */
  keep: 14,
  /** How far an arrow's centre stays back from its tip in the straw. */
  sink: 11,
};

const random = (min: number, max: number): number => min + Math.random() * (max - min);

interface Shot {
  target: Vec2;
  power: number;
  elapsedMs: number;
}

export class MenuRange {
  private readonly targets: Vec2[];
  private readonly arrows: Arrow[] = [];
  private restMs = random(600, 1200);
  private shot?: Shot;

  public constructor(
    private readonly world: Container,
    private readonly bowman: Bowman,
    private readonly textures: GameTextures,
    targetXs: readonly number[],
  ) {
    this.targets = targetXs.map((x) => {
      const art = new Graphics();
      drawArcheryTarget(art);
      art.position.set(x, groundAt(x));
      art.zIndex = 1;
      world.addChild(art);
      return { x, y: groundAt(x) };
    });
  }

  public update(deltaMs: number): void {
    this.updateArcher(deltaMs);
    this.arrows.forEach((arrow) => this.updateArrow(arrow, deltaMs));
  }

  private updateArcher(deltaMs: number): void {
    if (!this.shot) {
      this.restMs -= deltaMs;
      if (this.restMs <= 0) {
        this.shot = { target: this.pickAimPoint(), power: random(RANGE.power.min, RANGE.power.max), elapsedMs: 0 };
      }
      return;
    }
    const shot = this.shot;
    shot.elapsedMs += deltaMs;
    const draw = Math.min(1, shot.elapsedMs / RANGE.drawMs);
    const angle = this.angleTo(shot);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    this.bowman.setAim(direction, Math.max(0.06, shot.power * draw));
    if (draw < 1) {
      return;
    }
    this.loose(angle, launchSpeed('normal', shot.power));
    this.bowman.setAim(direction, 0);
    this.shot = undefined;
    this.restMs = random(RANGE.restMs.min, RANGE.restMs.max);
  }

  /** A spot on a random target's face; now and then one off it. */
  private pickAimPoint(): Vec2 {
    const base = this.targets[Math.floor(Math.random() * this.targets.length)];
    const { centreY, radiusY } = ARCHERY_TARGET;
    const spread = Math.random() < RANGE.missChance ? radiusY * random(1.3, 2) * Math.sign(random(-1, 1)) : radiusY * random(-0.7, 0.7);
    return { x: base.x, y: base.y + centreY + spread };
  }

  private angleTo(shot: Shot): number {
    const from = this.bowman.getBowReleasePoint();
    return solveLaunchAngle(from, shot.target, launchSpeed('normal', shot.power), Arrow.getFlightParams('normal'), groundAt(shot.target.x));
  }

  private loose(angle: number, speed: number): void {
    const from = this.bowman.getBowReleasePoint();
    this.arrows.forEach((arrow) => arrow.ageTrail(2));
    const trail = new Graphics();
    trail.zIndex = 1;
    this.world.addChild(trail);
    const arrow = new Arrow(from.x, from.y, this.textures.arrows.normal, trail);
    arrow.fire(angle, speed);
    this.world.addChild(arrow);
    this.arrows.push(arrow);
    while (this.arrows.length > RANGE.keep) {
      this.arrows.shift()!.dispose();
    }
  }

  /** In flight: sticks into a target face it crosses, else into the ground. */
  private updateArrow(arrow: Arrow, deltaMs: number): void {
    if (!arrow.isActive || arrow.isStuck) {
      return;
    }
    arrow.update(deltaMs);
    const { start, end } = arrow.getTravelSegment();
    const { centreY, radiusY } = ARCHERY_TARGET;
    for (const target of this.targets) {
      if (start.x < target.x && end.x >= target.x) {
        const y = start.y + ((end.y - start.y) * (target.x - start.x)) / (end.x - start.x);
        if (Math.abs(y - (target.y + centreY)) <= radiusY) {
          arrow.stickToWall({ x: target.x, y }, RANGE.sink);
          return;
        }
      }
    }
    const ground = groundAt(arrow.x);
    if (arrow.y >= ground) {
      arrow.stickToGround(ground);
    }
  }
}
