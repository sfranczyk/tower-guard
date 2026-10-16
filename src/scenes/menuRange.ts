import { Container, Graphics } from 'pixi.js';
import type { GameTextures } from '../core/Scene';
import { launchSpeed } from '../data/projectiles';
import Arrow from '../objects/Arrow';
import type Bowman from '../objects/bowman/Bowman';
import { ARCHERY_TARGET, drawArcheryTarget } from '../rendering/archeryTarget';
import { solveLaunchAngle } from '../systems/ballistics';
import { groundAt } from '../systems/terrain';
import type { Vec2 } from '../types';

/**
 * The menu bowman's practice: draw, hold the full draw, loose (the bow stays up while the string springs back), then
 * draw again or lower the bow. After `shotsPerRound` shots he walks to each target, looks at it, pulls his arrows
 * out (and picks up the misses on the way), and walks back.
 */
const RANGE = {
  shotsPerRound: 10,
  restMs: { min: 1000, max: 2200 },
  drawMs: 850,
  holdMs: { min: 600, max: 1300 },
  /** Bow still up after the shot. */
  followMs: 550,
  /** Chance to draw again straight from the follow-through instead of lowering the bow. */
  againChance: 0.45,
  /** Draw power at the near and at the far end of the range (`reach` px away). */
  power: { near: 0.5, far: 0.95, reach: 700 },
  /** Share of shots that go wide of the face (into the ground or past). */
  missChance: 0.15,
  /** How far an arrow's centre stays back from its tip in the straw. */
  sink: 11,
  /** He stands this far before a target's face to look at it. */
  standOff: 26,
  lookMs: 1100,
  /** One arrow pulled out every … */
  pullMs: 320,
  /** Close enough to a stop (px); arrows on the ground this close to him are picked up. */
  reachPx: 4,
  pickPx: 10,
};

const random = (min: number, max: number): number => min + Math.random() * (max - min);

interface Target {
  x: number;
  y: number;
}

interface StuckArrow {
  arrow: Arrow;
  /** Index of the target it is in; undefined while flying or on the ground. */
  target?: number;
}

type Phase =
  | { kind: 'rest'; ms: number }
  | { kind: 'draw'; ms: number; aimAt: Vec2; power: number; direction: Vec2 }
  | { kind: 'hold'; ms: number; power: number; direction: Vec2 }
  | { kind: 'follow'; ms: number }
  | { kind: 'collect'; stops: number[]; step: number; ms: number; looking: boolean };

export class MenuRange {
  private readonly targets: Target[];
  private readonly arrows: StuckArrow[] = [];
  private readonly homeX: number;
  private phase: Phase = { kind: 'rest', ms: random(600, 1200) };
  private shots = 0;

  public constructor(
    private readonly world: Container,
    private readonly bowman: Bowman,
    private readonly textures: GameTextures,
    targetXs: readonly number[],
  ) {
    this.homeX = bowman.x;
    this.targets = targetXs.map((x) => {
      const art = new Graphics();
      drawArcheryTarget(art);
      art.position.set(x, groundAt(x));
      art.zIndex = 1;
      world.addChild(art);
      return { x, y: groundAt(x) };
    });
  }

  /** Moves him, plays his body and flies the arrows. */
  public update(deltaMs: number): void {
    const walking = this.updateArcher(deltaMs);
    this.bowman.moveHorizontal(walking, deltaMs / 1000);
    this.bowman.updateVertical(deltaMs / 1000);
    this.bowman.updateAnimation(deltaMs, walking !== 0);
    this.arrows.forEach((stuck) => this.updateArrow(stuck, deltaMs));
  }

  /** Steps the routine; returns the way he walks (−1, 0, 1). */
  private updateArcher(deltaMs: number): number {
    const phase = this.phase;
    phase.ms -= deltaMs;
    switch (phase.kind) {
      case 'rest':
        if (phase.ms <= 0) {
          this.startDraw();
        }
        return 0;
      case 'draw': {
        const draw = Math.min(1, 1 - phase.ms / RANGE.drawMs);
        this.bowman.setAim(phase.direction, Math.max(0.06, phase.power * draw));
        if (draw >= 1) {
          // Fully drawn and raised: aim once more from where the arrow now sits.
          const direction = this.solveAim(phase.aimAt, phase.power);
          this.phase = { kind: 'hold', ms: random(RANGE.holdMs.min, RANGE.holdMs.max), power: phase.power, direction };
        }
        return 0;
      }
      case 'hold':
        this.bowman.setAim(phase.direction, phase.power);
        if (phase.ms <= 0) {
          this.loose(phase.direction, phase.power);
        }
        return 0;
      case 'follow':
        if (phase.ms <= 0) {
          this.afterShot();
        }
        return 0;
      case 'collect':
        return this.collect(phase);
    }
  }

  private startDraw(): void {
    const aimAt = this.pickAimPoint();
    const distance = Math.abs(aimAt.x - this.bowman.x) / RANGE.power.reach;
    const power = Math.min(1, RANGE.power.near + (RANGE.power.far - RANGE.power.near) * distance);
    this.phase = { kind: 'draw', ms: RANGE.drawMs, aimAt, power, direction: this.solveAim(aimAt, power) };
  }

  /** The direction that sends a draw of `power` from the bow through `aimAt` (costly: once per phase). */
  private solveAim(aimAt: Vec2, power: number): Vec2 {
    const from = this.bowman.getBowReleasePoint();
    const angle = solveLaunchAngle(from, aimAt, launchSpeed('normal', power), Arrow.getFlightParams('normal'), groundAt(aimAt.x));
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  private loose(direction: Vec2, power: number): void {
    const from = this.bowman.getBowReleasePoint();
    const trail = new Graphics();
    trail.zIndex = 1;
    this.world.addChild(trail);
    const arrow = new Arrow(from.x, from.y, this.textures.arrows.normal, trail);
    arrow.fire(Math.atan2(direction.y, direction.x), launchSpeed('normal', power));
    // No trails in the menu.
    arrow.hideTrail();
    this.world.addChild(arrow);
    this.arrows.push({ arrow });
    this.bowman.loose();
    this.bowman.holdBow(true);
    this.shots += 1;
    this.phase = { kind: 'follow', ms: RANGE.followMs };
  }

  /** Bow up after the shot: the next draw, a rest with the bow lowered, or (after a round) collecting. */
  private afterShot(): void {
    if (this.shots >= RANGE.shotsPerRound) {
      this.bowman.holdBow(false);
      this.phase = { kind: 'collect', stops: [], step: -1, ms: 0, looking: false };
    } else if (Math.random() < RANGE.againChance) {
      this.startDraw();
    } else {
      this.bowman.holdBow(false);
      this.phase = { kind: 'rest', ms: random(RANGE.restMs.min, RANGE.restMs.max) };
    }
  }

  /** A spot on a random target's face; now and then one off it. */
  private pickAimPoint(): Vec2 {
    const base = this.targets[Math.floor(Math.random() * this.targets.length)];
    const { centreY, radiusY } = ARCHERY_TARGET;
    const spread = Math.random() < RANGE.missChance ? radiusY * random(1.3, 2) * Math.sign(random(-1, 1)) : radiusY * random(-0.7, 0.7);
    return { x: base.x, y: base.y + centreY + spread };
  }

  /**
   * Walks to each target (looks at it, then pulls its arrows out one by one), on to the farthest miss, and home.
   * Arrows on the ground are picked up as he passes them.
   */
  private collect(phase: Extract<Phase, { kind: 'collect' }>): number {
    if (phase.step < 0) {
      // Wait until every arrow has landed, then plan the walk.
      if (this.arrows.some(({ arrow }) => arrow.isActive && !arrow.isStuck)) {
        return 0;
      }
      const misses = this.groundArrows().map(({ arrow }) => arrow.x).filter((x) => x > this.bowman.x);
      const stops = this.targets.map((target) => target.x - RANGE.standOff);
      const lastMiss = Math.max(...misses, -Infinity);
      phase.stops = lastMiss > stops[stops.length - 1] ? [...stops, lastMiss] : stops;
      phase.stops.push(this.homeX);
      phase.step = 0;
    }
    this.pickUpNear();
    const stopX = phase.stops[phase.step];
    const away = stopX - this.bowman.x;
    if (!phase.looking && Math.abs(away) > RANGE.reachPx) {
      return Math.sign(away);
    }
    const target = this.targets.findIndex((t) => Math.abs(t.x - RANGE.standOff - stopX) < 1);
    if (!phase.looking) {
      // Arrived: at a target he faces it and looks; home, he faces the range again.
      phase.looking = true;
      phase.ms = target >= 0 ? RANGE.lookMs : 0;
      this.bowman.setAim({ x: 1, y: 0 }, 0);
      return 0;
    }
    if (phase.ms > 0) {
      return 0;
    }
    if (target >= 0) {
      const index = this.arrows.findIndex((stuck) => stuck.target === target);
      if (index >= 0) {
        this.arrows.splice(index, 1)[0].arrow.dispose();
        phase.ms = RANGE.pullMs;
        return 0;
      }
    }
    phase.step += 1;
    phase.looking = false;
    if (phase.step >= phase.stops.length) {
      // Home: a new round.
      this.arrows.splice(0).forEach(({ arrow }) => arrow.dispose());
      this.shots = 0;
      this.phase = { kind: 'rest', ms: random(RANGE.restMs.min, RANGE.restMs.max) };
    }
    return 0;
  }

  private groundArrows(): StuckArrow[] {
    return this.arrows.filter(({ arrow, target }) => arrow.isStuck && target === undefined);
  }

  private pickUpNear(): void {
    this.groundArrows()
      .filter(({ arrow }) => Math.abs(arrow.x - this.bowman.x) < RANGE.pickPx)
      .forEach((stuck) => {
        this.arrows.splice(this.arrows.indexOf(stuck), 1);
        stuck.arrow.dispose();
      });
  }

  /** In flight: sticks into a target face it crosses, else into the ground. */
  private updateArrow(stuck: StuckArrow, deltaMs: number): void {
    const { arrow } = stuck;
    if (!arrow.isActive || arrow.isStuck) {
      return;
    }
    arrow.update(deltaMs);
    const { start, end } = arrow.getTravelSegment();
    const { centreY, radiusY } = ARCHERY_TARGET;
    for (const [index, target] of this.targets.entries()) {
      if (start.x < target.x && end.x >= target.x) {
        const y = start.y + ((end.y - start.y) * (target.x - start.x)) / (end.x - start.x);
        if (Math.abs(y - (target.y + centreY)) <= radiusY) {
          arrow.stickToWall({ x: target.x, y }, RANGE.sink);
          stuck.target = index;
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
