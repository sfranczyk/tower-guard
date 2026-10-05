import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Scene } from '../core/Scene';
import { LAB_PARAM, getUrlParam, setUrlParam } from '../core/urlState';
import { drawStickman } from '../rendering/stickman';
import { FALL_DURATION_MS, drawStickmanFall, type FallKind } from '../rendering/stickmanFall';

const WALK_PHASE_MS = 150;
const RUN_PHASE_MS = 110;
const IDLE_BLEND_MS = 350;
const RUN_BLEND_MS = 400;

const LIST_TOP = 78;
const LIST_BOTTOM = GAME_HEIGHT - 8;
/** Rows visible at once; the rest scroll with the mouse wheel. */
const VISIBLE_ROWS = 8;
const ROW_HEIGHT = (LIST_BOTTOM - LIST_TOP) / VISIBLE_ROWS;
/** Previews are drawn smaller so every full-height stickman fits one under another. */
const PREVIEW_SCALE = 0.4;
/** Fall animations hold the final pose this long before replaying. */
const FALL_HOLD_MS = 1200;
const PREVIEW_X = 120;
const TEXT_X = 250;
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const ZOOM_SCALE = 2.4;
const ZOOM_FIGURE_X = 280;
const ZOOM_TEXT_X = 520;

type SequenceState = 'walkFirst' | 'stand' | 'walkSecond' | 'run' | 'runToWalk';
type ArcherSequenceState =
  | 'walkLowered' | 'stopLowered' | 'raise' | 'draw' | 'walkDrawn' | 'stopDrawn' | 'release' | 'lower' | 'hold';

/** Archer ready sequence timings (ms) and the draw tension it walks with. */
const ARCHER_STOP_MS = 400;
const ARCHER_RAISE_MS = 350;
const ARCHER_DRAW_MS = 500;
const ARCHER_RELEASE_MS = 300;
const ARCHER_LOWER_MS = 450;
const ARCHER_HOLD_MS = 700;
const ARCHER_SEQUENCE_TENSION = 0.85;
const ARCHER_SEQUENCE_STEPS = 4;

type PreviewRow = {
  /** Stable id used in the URL (?lab=<id>). */
  id: string;
  title: string;
  description: string;
  /** Backdrop behind the figure; the dark armored archer needs the light in-game sky colour. */
  backdrop?: number;
  /** Draws the current frame of this animation; `originY: 0` keeps the hip at the sprite origin. */
  render: (sprite: Graphics) => void;
  /** Shifts the figure right (unscaled units) for animations that travel left, so they stay centred. */
  offsetX?: number;
};

const DEFAULT_BACKDROP = 0x16243a;
const SKY_BACKDROP = 0x80b8d1;

/** Number of full steps (half walk cycles) completed between two phases. */
const stepsBetween = (previousPhase: number, phase: number): number =>
  Math.max(0, Math.floor(phase / Math.PI) - Math.floor(previousPhase / Math.PI));

/**
 * Every stickman animation in its own row with a description. Clicking a row zooms into it; the
 * zoomed animation is kept in the URL (?lab=<id>) so it survives a refresh.
 */
export class AnimationLabScene extends Scene {
  private readonly rows: PreviewRow[] = [
    {
      id: 'archer',
      backdrop: SKY_BACKDROP,
      title: 'Armored archer · bow draw',
      description: 'Player character. Draw tension cycles 25–100%; bow, hands and arrow come from the shared rig.',
      render: (sprite) => drawStickman(sprite, 0, {
        idleBlend: 1,
        archerPose: true,
        bowTension: 0.25 + (Math.sin(this.archerPhase) + 1) * 0.375,
        skin: 'armored',
        originY: 0,
      }),
    },
    {
      id: 'archer-lowered',
      backdrop: SKY_BACKDROP,
      title: 'Archer · standing, bow lowered',
      description: 'Default stance in game: bow held low, pointing at the ground ahead; the other arm hangs free.',
      render: (sprite) => drawStickman(sprite, 0, {
        idleBlend: 1, archerPose: true, bowReady: 0, skin: 'armored', originY: 0,
      }),
    },
    {
      id: 'archer-lowered-walk',
      backdrop: SKY_BACKDROP,
      title: 'Archer · walking, bow lowered',
      description: 'Walk cycle carrying the lowered bow; the free arm swings with the steps.',
      render: (sprite) => drawStickman(sprite, this.archerWalkPhase, {
        archerPose: true, bowReady: 0, skin: 'armored', originY: 0,
      }),
    },
    {
      id: 'archer-ready',
      backdrop: SKY_BACKDROP,
      title: 'Archer · walk → stop → raise & draw → walk drawn → stop → lower',
      description: 'Bow comes up to aim and the string is drawn, walks with it drawn, then releases and lowers.',
      render: (sprite) => drawStickman(sprite, this.archerSequence.phase, {
        idleBlend: this.archerSequence.idle,
        archerPose: true,
        bowReady: this.archerSequence.ready,
        bowTension: this.archerSequence.tension,
        skin: 'armored',
        originY: 0,
      }),
    },
    {
      id: 'walk',
      title: 'Walk cycle with idle pauses',
      description: 'Walks 5 steps, blends into a standing pose and holds it for 3 s, then walks again.',
      render: (sprite) => drawStickman(sprite, this.walkPhase, { idleBlend: this.walkIdleBlend, originY: 0 }),
    },
    {
      id: 'sequence',
      title: 'Sequence: walk → stand → walk → run → walk',
      description: '5 steps, stand for 2 s, 2 steps, then 10 running steps with 0.4 s blends in and out.',
      render: (sprite) => this.renderSequence(sprite),
    },
    {
      id: 'sprint',
      title: 'Sprint cycle',
      description: 'Contact, stance on the ground, push-off, heel kick, high knee drive and a short flight phase.',
      render: (sprite) => drawStickman(sprite, this.runPhase, { running: true, originY: 0 }),
    },
    {
      id: 'enemy-walk',
      title: 'Enemy walk (armed)',
      description: 'Walk cycle with a club in the front hand; pauses together with the plain walk.',
      render: (sprite) => drawStickman(sprite, this.walkPhase, { idleBlend: this.walkIdleBlend, armed: true, originY: 0 }),
    },
    {
      id: 'enemy-attack',
      title: 'Enemy club attack',
      description: 'Standing club swing: wind-up, strike with a forward lean, then recovery.',
      render: (sprite) => drawStickman(sprite, 0, { idleBlend: 1, armed: true, attackPhase: this.attackPhase, originY: 0 }),
    },
    {
      id: 'death',
      title: 'Death',
      description: 'Knees buckle, drops to the knees, then collapses face down where it stood.',
      render: (sprite) => drawStickmanFall(sprite, 'death', this.fallProgress('death')),
    },
    {
      id: 'knockback',
      title: 'Knockback (explosions)',
      description: 'Thrown a short distance backwards, lands and ends lying on its back.',
      offsetX: 54,
      render: (sprite) => drawStickmanFall(sprite, 'knockback', this.fallProgress('knockback')),
    },
  ];
  private readonly listSprites = new Map<PreviewRow, Graphics>();
  private readonly list = new Container();
  private readonly zoomView = new Container();
  private zoomSprite = new Graphics();
  private zoomed?: PreviewRow;

  private archerPhase = 0;
  private walkPhase = 0;
  private walkStepsSinceStand = 0;
  private walkIdleRemainingMs = 0;
  private walkIdleBlend = 0;
  private runPhase = 0;
  private attackPhase = 0;
  private fallTimeMs = 0;
  private archerWalkPhase = 0;
  private readonly archerSequence = {
    state: 'walkLowered' as ArcherSequenceState,
    timeMs: 0,
    phase: 0,
    steps: 0,
    idle: 0,
    ready: 0,
    tension: 0,
  };
  private scrollY = 0;
  private readonly listMask = new Graphics().rect(0, LIST_TOP, GAME_WIDTH, LIST_BOTTOM - LIST_TOP).fill({ color: 0xffffff });
  private readonly scrollbar = new Graphics();

  private sequenceState: SequenceState = 'walkFirst';
  private sequencePhase = 0;
  private sequenceRunPhase = 0;
  private sequenceRunBlend = 0;
  private sequenceSteps = 0;
  private sequenceTimerMs = 0;
  private sequenceIdleBlend = 0;

  public enter(): void {
    const { ui, root } = this.ctx;
    ui.showScreen('animationLab');
    this.createBackdrop();
    this.rows.forEach((row, index) => this.createRow(row, index));
    this.list.mask = this.listMask;
    root.addChild(this.listMask, this.list, this.scrollbar, this.zoomView);
    this.listenWindow('wheel', (event) => {
      if (!this.zoomed) {
        this.scrollTo(this.scrollY + event.deltaY * 0.5);
      }
    });
    this.scrollTo(0);

    ui.handlers.labBack = () => this.zoomTo(undefined);
    this.onExit(() => {
      ui.handlers.labBack = undefined;
    });
    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape' && this.zoomed) {
        this.zoomTo(undefined);
      }
    });

    this.zoomTo(this.rows.find((row) => row.id === getUrlParam(LAB_PARAM)));
  }

  public update(deltaMs: number): void {
    this.updateWalk(deltaMs);
    this.archerPhase += deltaMs / 900;
    this.runPhase += deltaMs / RUN_PHASE_MS;
    this.attackPhase += deltaMs / 180;
    this.fallTimeMs += deltaMs;
    this.archerWalkPhase += deltaMs / WALK_PHASE_MS;
    this.updateArcherSequence(deltaMs);
    this.updateSequence(deltaMs);
    this.draw();
  }

  private createBackdrop(): void {
    const { root } = this.ctx;
    root.addChild(new Graphics().rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x0d1728 }));
    root.addChild(AnimationLabScene.text('Animation lab', 22, 0xf5f7fb, 700, 32, 20));
    root.addChild(AnimationLabScene.text(
      'Every stickman animation, one per row. Click a row to zoom in.',
      12, 0xaeb9c9, 400, 32, 50,
    ));
  }

  private createRow(preview: PreviewRow, index: number): void {
    const { title, description, backdrop = DEFAULT_BACKDROP } = preview;
    const top = LIST_TOP + index * ROW_HEIGHT;
    const row = new Container();
    row.position.set(0, top);
    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.hitArea = new Rectangle(16, 0, GAME_WIDTH - 32, ROW_HEIGHT);
    row.on('pointertap', () => this.zoomTo(preview));

    const highlight = new Graphics().rect(16, 0, GAME_WIDTH - 32, ROW_HEIGHT)
      .fill({ color: 0xffffff, alpha: index % 2 === 0 ? 0.025 : 0 });
    row.addChild(highlight);
    row.on('pointerover', () => { highlight.tint = 0x5b8def; highlight.alpha = 4; });
    row.on('pointerout', () => { highlight.tint = 0xffffff; highlight.alpha = 1; });
    row.addChild(new Graphics().moveTo(16, ROW_HEIGHT).lineTo(GAME_WIDTH - 16, ROW_HEIGHT)
      .stroke({ width: 1, color: 0x1c2b43 }));

    row.addChild(new Graphics().roundRect(PREVIEW_X - 62, 3, 124, ROW_HEIGHT - 6, 6).fill({ color: backdrop }));
    const sprite = new Graphics();
    this.listSprites.set(preview, sprite);
    row.addChild(...AnimationLabScene.createFigure(
      sprite, PREVIEW_X + (preview.offsetX ?? 0) * PREVIEW_SCALE, ROW_HEIGHT / 2, PREVIEW_SCALE, PREVIEW_X - 55, PREVIEW_X + 55,
    ));

    row.addChild(AnimationLabScene.text(`${index + 1}`, 12, 0x5b8def, 700, 32, ROW_HEIGHT / 2 - 8));
    row.addChild(AnimationLabScene.text(title, 14, 0xf5f7fb, 700, TEXT_X, ROW_HEIGHT / 2 - 18));
    row.addChild(AnimationLabScene.text(description, 12, 0xaeb9c9, 400, TEXT_X, ROW_HEIGHT / 2 + 2));

    this.list.addChild(row);
  }

  /** Switches between the list (undefined) and one zoomed animation, and records it in the URL. */
  private zoomTo(preview: PreviewRow | undefined): void {
    this.zoomed = preview;
    this.list.visible = !preview;
    this.scrollbar.visible = !preview && this.maxScroll > 0;
    this.zoomView.visible = Boolean(preview);
    this.ctx.ui.setLabZoomed(Boolean(preview));
    setUrlParam(LAB_PARAM, preview?.id ?? '');

    this.zoomView.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.zoomSprite = new Graphics();
    if (!preview) {
      this.draw();
      return;
    }

    const index = this.rows.indexOf(preview);
    const top = LIST_TOP + 4;
    const height = GAME_HEIGHT - top - 16;
    this.zoomView.addChild(new Graphics()
      .roundRect(40, top, ZOOM_TEXT_X - 70, height, 12)
      .fill({ color: preview.backdrop ?? DEFAULT_BACKDROP }));
    this.zoomView.addChild(...AnimationLabScene.createFigure(
      this.zoomSprite, ZOOM_FIGURE_X - 30 + (preview.offsetX ?? 0) * ZOOM_SCALE, top + height * 0.6, ZOOM_SCALE, 60, ZOOM_TEXT_X - 50,
    ));
    this.zoomView.addChild(AnimationLabScene.text(`Animation ${index + 1} of ${this.rows.length}`, 12, 0x5b8def, 700, ZOOM_TEXT_X, top + 8));
    this.zoomView.addChild(AnimationLabScene.wrapped(preview.title, 22, ZOOM_TEXT_X, top + 30, GAME_WIDTH - ZOOM_TEXT_X - 40, 0xf5f7fb, 700));
    this.zoomView.addChild(AnimationLabScene.wrapped(preview.description, 14, ZOOM_TEXT_X, top + 100, GAME_WIDTH - ZOOM_TEXT_X - 40));
    this.zoomView.addChild(AnimationLabScene.wrapped('Esc or “All animations” returns to the list.', 12, ZOOM_TEXT_X, top + height - 24, GAME_WIDTH - ZOOM_TEXT_X - 40, 0x6f7d90));
    this.draw();
  }

  private get maxScroll(): number {
    return Math.max(0, this.rows.length * ROW_HEIGHT - (LIST_BOTTOM - LIST_TOP));
  }

  private scrollTo(y: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScroll, y));
    this.list.y = -this.scrollY;
    const trackHeight = LIST_BOTTOM - LIST_TOP;
    const thumbHeight = trackHeight * (trackHeight / (trackHeight + this.maxScroll));
    const thumbY = LIST_TOP + (this.maxScroll ? (this.scrollY / this.maxScroll) * (trackHeight - thumbHeight) : 0);
    this.scrollbar.clear()
      .roundRect(GAME_WIDTH - 10, LIST_TOP, 4, trackHeight, 2).fill({ color: 0xffffff, alpha: 0.06 })
      .roundRect(GAME_WIDTH - 10, thumbY, 4, thumbHeight, 2).fill({ color: 0x5b8def, alpha: 0.8 });
    this.scrollbar.visible = !this.zoomed && this.maxScroll > 0;
  }

  /**
   * Archer ready sequence: walk with the bow lowered, stop, raise and draw, walk drawn, stop,
   * release, lower, hold, repeat.
   */
  private updateArcherSequence(deltaMs: number): void {
    const seq = this.archerSequence;
    seq.timeMs += deltaMs;
    const walking = seq.state === 'walkLowered' || seq.state === 'walkDrawn';
    if (walking) {
      const previousPhase = seq.phase;
      seq.phase += deltaMs / WALK_PHASE_MS;
      seq.steps += stepsBetween(previousPhase, seq.phase);
      seq.idle = Math.max(0, seq.idle - deltaMs / IDLE_BLEND_MS);
    } else {
      seq.idle = Math.min(1, seq.idle + deltaMs / IDLE_BLEND_MS);
    }
    const next = (state: ArcherSequenceState): void => {
      seq.state = state;
      seq.timeMs = 0;
      seq.steps = 0;
    };
    const progress = (duration: number): number => Math.min(1, seq.timeMs / duration);

    switch (seq.state) {
      case 'walkLowered':
        if (seq.steps >= ARCHER_SEQUENCE_STEPS) next('stopLowered');
        break;
      case 'stopLowered':
        if (seq.timeMs >= ARCHER_STOP_MS) next('raise');
        break;
      case 'raise':
        seq.ready = progress(ARCHER_RAISE_MS);
        if (seq.ready >= 1) next('draw');
        break;
      case 'draw':
        seq.tension = ARCHER_SEQUENCE_TENSION * progress(ARCHER_DRAW_MS);
        if (seq.timeMs >= ARCHER_DRAW_MS) next('walkDrawn');
        break;
      case 'walkDrawn':
        if (seq.steps >= ARCHER_SEQUENCE_STEPS) next('stopDrawn');
        break;
      case 'stopDrawn':
        if (seq.timeMs >= ARCHER_STOP_MS) next('release');
        break;
      case 'release':
        seq.tension = ARCHER_SEQUENCE_TENSION * (1 - progress(ARCHER_RELEASE_MS));
        if (seq.timeMs >= ARCHER_RELEASE_MS) next('lower');
        break;
      case 'lower':
        seq.ready = 1 - progress(ARCHER_LOWER_MS);
        if (seq.timeMs >= ARCHER_LOWER_MS) next('hold');
        break;
      case 'hold':
        if (seq.timeMs >= ARCHER_HOLD_MS) next('walkLowered');
        break;
    }
  }

  /** Figure container (hip at x/hipY) plus a ground line under the feet from groundFrom to groundTo. */
  private static createFigure(
    sprite: Graphics, x: number, hipY: number, scale: number, groundFrom: number, groundTo: number,
  ): [Graphics, Container] {
    const figure = new Container();
    figure.scale.set(scale);
    figure.position.set(x, hipY - 2 * scale);
    figure.addChild(sprite);
    const feetY = figure.y + 58 * scale;
    const ground = new Graphics().moveTo(groundFrom, feetY).lineTo(groundTo, feetY)
      .stroke({ width: 2, color: 0x42617f });
    return [ground, figure];
  }

  private static wrapped(content: string, size: number, x: number, y: number, width: number, color = 0xaeb9c9, weight: 400 | 700 = 400): Text {
    const text = AnimationLabScene.text(content, size, color, weight, x, y);
    text.style.wordWrap = true;
    text.style.wordWrapWidth = width;
    text.style.lineHeight = Math.round(size * 1.45);
    return text;
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

  /** Plays a fall animation, holds the last pose, then replays (all falls share one clock). */
  private fallProgress(kind: FallKind): number {
    const duration = FALL_DURATION_MS[kind];
    return Math.min(1, (this.fallTimeMs % (duration + FALL_HOLD_MS)) / duration);
  }

  private renderSequence(sprite: Graphics): void {
    if (this.sequenceState === 'run') {
      drawStickman(sprite, this.sequenceRunPhase, { runningBlend: this.sequenceRunBlend, originY: 0 });
    } else if (this.sequenceState === 'runToWalk') {
      drawStickman(sprite, this.sequencePhase, { runningBlend: this.sequenceRunBlend, originY: 0 });
    } else {
      drawStickman(sprite, this.sequencePhase, { idleBlend: this.sequenceIdleBlend, originY: 0 });
    }
  }

  private draw(): void {
    if (this.zoomed) {
      this.zoomed.render(this.zoomSprite);
      return;
    }
    this.listSprites.forEach((sprite, row) => row.render(sprite));
  }
}
