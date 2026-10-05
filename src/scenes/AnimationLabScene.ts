import { Container, Graphics, Text } from 'pixi.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Scene } from '../core/Scene';
import { drawStickman } from '../rendering/stickman';

const WALK_PHASE_MS = 150;
const RUN_PHASE_MS = 160;
const IDLE_BLEND_MS = 350;
const RUN_BLEND_MS = 400;

const LIST_TOP = 78;
const ROW_HEIGHT = (GAME_HEIGHT - LIST_TOP - 8) / 6;
/** Previews are drawn smaller so six full-height stickmen fit one under another. */
const PREVIEW_SCALE = 0.55;
const PREVIEW_X = 120;
const TEXT_X = 250;
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

type SequenceState = 'walkFirst' | 'stand' | 'walkSecond' | 'run' | 'runToWalk';

type PreviewRow = {
  sprite: Graphics;
  title: string;
  description: string;
  /** Backdrop behind the figure; the dark armored archer needs the light in-game sky colour. */
  backdrop?: number;
};

const DEFAULT_BACKDROP = 0x16243a;
const SKY_BACKDROP = 0x80b8d1;

/** Number of full steps (half walk cycles) completed between two phases. */
const stepsBetween = (previousPhase: number, phase: number): number =>
  Math.max(0, Math.floor(phase / Math.PI) - Math.floor(previousPhase / Math.PI));

/** Every stickman animation in its own row, with a description of what it shows on the right. */
export class AnimationLabScene extends Scene {
  private readonly archer = new Graphics();
  private readonly walk = new Graphics();
  private readonly sequence = new Graphics();
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

    const rows: PreviewRow[] = [
      {
        sprite: this.archer,
        backdrop: SKY_BACKDROP,
        title: 'Armored archer · bow draw',
        description: 'The player character. Draw tension cycles between 25% and 100%. Bow, hands and the '
          + 'nocked arrow come from the shared archer rig, which pivots at the neck.',
      },
      {
        sprite: this.walk,
        title: 'Walk cycle with idle pauses',
        description: 'Walks 5 steps, blends into a standing pose and holds it for 3 s, then walks again.',
      },
      {
        sprite: this.sequence,
        title: 'Sequence: walk → stand → walk → run → walk',
        description: '5 steps, stand for 2 s, 2 steps, then 10 running steps with a 0.4 s blend in and out '
          + 'of the run.',
      },
      {
        sprite: this.running,
        title: 'Sprint cycle',
        description: 'Full run: longer stride, higher foot lift, bent knees and a stronger body bounce.',
      },
      {
        sprite: this.armedWalk,
        title: 'Enemy walk (armed)',
        description: 'Enemy walk cycle with a club in the front hand. Pauses together with the walk above.',
      },
      {
        sprite: this.attack,
        title: 'Enemy club attack',
        description: 'Standing club swing: wind-up, strike with a forward lean, then recovery.',
      },
    ];
    rows.forEach((row, index) => this.createRow(row, index));
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
    const { root } = this.ctx;
    root.addChild(new Graphics().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x0d1728 }));
    root.addChild(AnimationLabScene.text('Animation lab', 22, 0xf5f7fb, 700, 32, 20));
    root.addChild(AnimationLabScene.text(
      'Every stickman animation, one per row. All previews use the same renderer as the game.',
      12, 0xaeb9c9, 400, 32, 50,
    ));
  }

  private createRow({ sprite, title, description, backdrop = DEFAULT_BACKDROP }: PreviewRow, index: number): void {
    const top = LIST_TOP + index * ROW_HEIGHT;
    const row = new Container();
    row.position.set(0, top);

    if (index % 2 === 0) {
      row.addChild(new Graphics().rect(16, 0, GAME_WIDTH - 32, ROW_HEIGHT).fill({ color: 0xffffff, alpha: 0.025 }));
    }
    row.addChild(new Graphics().moveTo(16, ROW_HEIGHT).lineTo(GAME_WIDTH - 16, ROW_HEIGHT)
      .stroke({ width: 1, color: 0x1c2b43 }));

    row.addChild(new Graphics().roundRect(PREVIEW_X - 62, 5, 124, ROW_HEIGHT - 10, 8).fill({ color: backdrop }));

    // Hip sits at the container origin; feet reach +58 and the head top −62 (unscaled).
    const figure = new Container();
    figure.scale.set(PREVIEW_SCALE);
    figure.position.set(PREVIEW_X, ROW_HEIGHT / 2 - 2 * PREVIEW_SCALE);
    figure.addChild(sprite);
    const feetY = figure.y + 58 * PREVIEW_SCALE;
    row.addChild(new Graphics().moveTo(PREVIEW_X - 45, feetY).lineTo(PREVIEW_X + 45, feetY)
      .stroke({ width: 2, color: 0x42617f }));
    row.addChild(figure);

    row.addChild(AnimationLabScene.text(`${index + 1}`, 12, 0x5b8def, 700, 32, ROW_HEIGHT / 2 - 8));
    row.addChild(AnimationLabScene.text(title, 15, 0xf5f7fb, 700, TEXT_X, 14));
    const body = AnimationLabScene.text(description, 12, 0xaeb9c9, 400, TEXT_X, 36);
    body.style.wordWrap = true;
    body.style.wordWrapWidth = GAME_WIDTH - TEXT_X - 40;
    row.addChild(body);

    this.ctx.root.addChild(row);
  }

  private static text(content: string, size: number, color: number, weight: 400 | 700, x: number, y: number): Text {
    const text = new Text({
      text: content,
      style: { fill: color, fontSize: size, fontFamily: FONT, fontWeight: weight === 700 ? '700' : '400' },
    });
    text.position.set(x, y);
    return text;
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
    const archerTension = 0.25 + (Math.sin(this.archerPhase) + 1) * 0.375;
    drawStickman(this.archer, 0, { idleBlend: 1, archerPose: true, bowTension: archerTension, skin: 'armored', originY: 0 });
    drawStickman(this.walk, this.walkPhase, { idleBlend: this.walkIdleBlend, originY: 0 });
    drawStickman(this.armedWalk, this.walkPhase, { idleBlend: this.walkIdleBlend, armed: true, originY: 0 });
    drawStickman(this.running, this.runPhase, { running: true, originY: 0 });
    drawStickman(this.attack, 0, { idleBlend: 1, armed: true, attackPhase: this.attackPhase, originY: 0 });

    if (this.sequenceState === 'run') {
      drawStickman(this.sequence, this.sequenceRunPhase, { runningBlend: this.sequenceRunBlend, originY: 0 });
    } else if (this.sequenceState === 'runToWalk') {
      drawStickman(this.sequence, this.sequencePhase, { runningBlend: this.sequenceRunBlend, originY: 0 });
    } else {
      drawStickman(this.sequence, this.sequencePhase, { idleBlend: this.sequenceIdleBlend, originY: 0 });
    }
  }
}
