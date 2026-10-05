import { Graphics } from 'pixi.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Scene } from '../core/Scene';
import { drawStickman, drawTensionArcher } from '../rendering/stickman';

const PREVIEW_Y = 430;
const WALK_PHASE_MS = 150;
const RUN_PHASE_MS = 160;
const IDLE_BLEND_MS = 350;
const RUN_BLEND_MS = 400;

type SequenceState = 'walkFirst' | 'stand' | 'walkSecond' | 'run' | 'runToWalk';

/** Number of full steps (half walk cycles) completed between two phases. */
const stepsBetween = (previousPhase: number, phase: number): number =>
  Math.max(0, Math.floor(phase / Math.PI) - Math.floor(previousPhase / Math.PI));

/**
 * Side-by-side previews of every stickman animation: archer bow tension, a walk that pauses
 * every 5 steps, a walk→stand→walk→run→walk sequence, sprint, armed walk and club attack.
 */
export class AnimationLabScene extends Scene {
  private readonly archer = new Graphics();
  private readonly sequence = new Graphics();
  private readonly walk = new Graphics();
  private readonly running = new Graphics();
  private readonly armedWalk = new Graphics();
  private readonly attack = new Graphics();

  private archerPhase = 0;
  private walkPhase = 0;
  private walkStepsSinceStand = 0;
  private walkIdleRemainingMs = 0;
  private walkIdleBlend = 0;
  private runPhase = 0;
  private attackPhase = 0;

  private sequenceState: SequenceState = 'walkFirst';
  private sequencePhase = 0;
  private sequenceRunPhase = 0;
  private sequenceRunBlend = 0;
  private sequenceSteps = 0;
  private sequenceTimerMs = 0;
  private sequenceIdleBlend = 0;

  public enter(): void {
    this.ctx.ui.showScreen('animationLab');
    this.createBackdrop();

    const previews: Array<[Graphics, number]> = [
      [this.archer, 100],
      [this.walk, 365],
      [this.armedWalk, 560],
      [this.running, 460],
      [this.attack, 655],
      [this.sequence, 265],
    ];
    previews.forEach(([sprite, x]) => {
      sprite.position.set(x, PREVIEW_Y);
      this.ctx.root.addChild(sprite);
    });
    this.draw();
  }

  public update(deltaMs: number): void {
    this.updateWalk(deltaMs);
    this.archerPhase += deltaMs / 900;
    this.runPhase += deltaMs / RUN_PHASE_MS;
    this.attackPhase += deltaMs / 180;
    this.updateSequence(deltaMs);
    this.draw();
  }

  private createBackdrop(): void {
    this.ctx.root.addChild(new Graphics().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x0d1728 }));

    const grid = new Graphics();
    for (let x = 40; x < GAME_WIDTH; x += 40) {
      grid.moveTo(x, 0).lineTo(x, GAME_HEIGHT);
    }
    for (let y = 40; y < GAME_HEIGHT; y += 40) {
      grid.moveTo(0, y).lineTo(GAME_WIDTH, y);
    }
    grid.stroke({ width: 1, color: 0x1c2b43, alpha: 0.7 });
    this.ctx.root.addChild(grid);

    this.ctx.root.addChild(new Graphics().moveTo(80, 495).lineTo(690, 495).stroke({ width: 2, color: 0x42617f }));
  }

  /** Walks 5 steps, then stands for 3 seconds, and repeats. */
  private updateWalk(deltaMs: number): void {
    if (this.walkIdleRemainingMs > 0) {
      this.walkIdleRemainingMs = Math.max(0, this.walkIdleRemainingMs - deltaMs);
      this.walkIdleBlend = Math.min(1, this.walkIdleBlend + deltaMs / IDLE_BLEND_MS);
      if (this.walkIdleRemainingMs === 0) {
        this.walkStepsSinceStand = 0;
      }
      return;
    }

    const previousPhase = this.walkPhase;
    this.walkPhase += deltaMs / WALK_PHASE_MS;
    this.walkStepsSinceStand += stepsBetween(previousPhase, this.walkPhase);
    this.walkIdleBlend = Math.max(0, this.walkIdleBlend - deltaMs / IDLE_BLEND_MS);
    if (this.walkStepsSinceStand >= 5) {
      this.walkIdleRemainingMs = 3_000;
    }
  }

  /** walkFirst (5 steps) → stand (2 s) → walkSecond (2 steps) → run (10 steps) → runToWalk → … */
  private updateSequence(deltaMs: number): void {
    switch (this.sequenceState) {
      case 'stand':
        this.sequenceTimerMs = Math.max(0, this.sequenceTimerMs - deltaMs);
        this.sequenceIdleBlend = Math.min(1, this.sequenceIdleBlend + deltaMs / IDLE_BLEND_MS);
        if (this.sequenceTimerMs === 0) {
          this.sequenceState = 'walkSecond';
          this.sequenceSteps = 0;
        }
        return;

      case 'run': {
        const previousPhase = this.sequenceRunPhase;
        this.sequenceRunPhase += deltaMs / RUN_PHASE_MS;
        this.sequenceRunBlend = Math.min(1, this.sequenceRunBlend + deltaMs / RUN_BLEND_MS);
        this.sequenceSteps += stepsBetween(previousPhase, this.sequenceRunPhase);
        if (this.sequenceSteps >= 10) {
          this.sequenceState = 'runToWalk';
          this.sequencePhase = this.sequenceRunPhase;
          this.sequenceSteps = 0;
          this.sequenceIdleBlend = 0;
        }
        return;
      }

      case 'runToWalk':
        this.sequencePhase += deltaMs / WALK_PHASE_MS;
        this.sequenceRunBlend = Math.max(0, this.sequenceRunBlend - deltaMs / RUN_BLEND_MS);
        if (this.sequenceRunBlend === 0) {
          this.sequenceState = 'walkFirst';
          this.sequenceSteps = 0;
          this.sequenceRunPhase = 0;
        }
        return;

      case 'walkFirst':
      case 'walkSecond': {
        const previousPhase = this.sequencePhase;
        this.sequencePhase += deltaMs / WALK_PHASE_MS;
        this.sequenceSteps += stepsBetween(previousPhase, this.sequencePhase);
        this.sequenceIdleBlend = Math.max(0, this.sequenceIdleBlend - deltaMs / IDLE_BLEND_MS);
        const targetSteps = this.sequenceState === 'walkFirst' ? 5 : 2;
        if (this.sequenceSteps < targetSteps) {
          return;
        }
        if (this.sequenceState === 'walkFirst') {
          this.sequenceState = 'stand';
          this.sequenceTimerMs = 2_000;
        } else {
          this.sequenceState = 'run';
          this.sequenceRunPhase = this.sequencePhase;
          this.sequenceRunBlend = 0;
          this.sequenceSteps = 0;
        }
      }
    }
  }

  private draw(): void {
    drawTensionArcher(this.archer, this.archerPhase);
    drawStickman(this.walk, this.walkPhase, { idleBlend: this.walkIdleBlend });
    drawStickman(this.armedWalk, this.walkPhase, { idleBlend: this.walkIdleBlend, armed: true });
    drawStickman(this.running, this.runPhase, { running: true });
    drawStickman(this.attack, 0, { idleBlend: 1, armed: true, attackPhase: this.attackPhase });

    if (this.sequenceState === 'run') {
      drawStickman(this.sequence, this.sequenceRunPhase, { runningBlend: this.sequenceRunBlend });
    } else if (this.sequenceState === 'runToWalk') {
      drawStickman(this.sequence, this.sequencePhase, { runningBlend: this.sequenceRunBlend });
    } else {
      drawStickman(this.sequence, this.sequencePhase, { idleBlend: this.sequenceIdleBlend });
    }
  }
}
