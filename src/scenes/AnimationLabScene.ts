import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Scene } from '../core/Scene';
import { LAB_PARAM, getUrlParam, setUrlParam } from '../core/urlState';
import { drawStickman } from '../rendering/stickman';
import { ArcherReadySequence, FallClock, GibReplay, PausingWalk, RUN_PHASE_MS, WALK_PHASE_MS, WalkRunSequence } from './labSequences';

const LIST_TOP = 78;
const LIST_BOTTOM = GAME_HEIGHT - 8;
/** Rows visible at once; the rest scroll with the mouse wheel. */
const VISIBLE_ROWS = 8;
const ROW_HEIGHT = (LIST_BOTTOM - LIST_TOP) / VISIBLE_ROWS;
/** Previews are drawn smaller so every full-height stickman fits one under another. */
const PREVIEW_SCALE = 0.4;
const PREVIEW_X = 120;
const TEXT_X = 250;
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const ZOOM_SCALE = 2.4;
const ZOOM_FIGURE_X = 280;
const ZOOM_TEXT_X = 520;

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
  /** Scale overrides for animations that spread wide (default PREVIEW_SCALE / ZOOM_SCALE). */
  previewScale?: number;
  zoomScale?: number;
};

const DEFAULT_BACKDROP = 0x16243a;
const SKY_BACKDROP = 0x80b8d1;

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
      render: (sprite) => this.archerSequence.render(sprite),
    },
    {
      id: 'walk',
      title: 'Walk cycle with idle pauses',
      description: 'Walks 5 steps, blends into a standing pose and holds it for 3 s, then walks again.',
      render: (sprite) => drawStickman(sprite, this.pausingWalk.phase, { idleBlend: this.pausingWalk.idleBlend, originY: 0 }),
    },
    {
      id: 'sequence',
      title: 'Sequence: walk → stand → walk → run → walk',
      description: '5 steps, stand for 2 s, 2 steps, then 10 running steps with 0.4 s blends in and out.',
      render: (sprite) => this.walkRunSequence.render(sprite),
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
      render: (sprite) => drawStickman(sprite, this.pausingWalk.phase, { idleBlend: this.pausingWalk.idleBlend, armed: true, originY: 0 }),
    },
    {
      id: 'enemy-attack',
      title: 'Enemy club attack',
      description: 'Standing club swing: wind-up, strike with a forward lean, then recovery.',
      render: (sprite) => drawStickman(sprite, 0, { idleBlend: 1, armed: true, attackPhase: this.attackPhase, originY: 0 }),
    },
    {
      id: 'enemy-archer',
      title: 'Enemy archer · draw and shoot',
      description: 'Red-tinted enemy with a bow: raises it, draws, looses and repeats from range.',
      render: (sprite) => {
        sprite.tint = 0xffc2b4;
        const cycle = (this.attackPhase * 0.25) % 1;
        drawStickman(sprite, 0, {
          idleBlend: 1,
          archerPose: true,
          bowReady: Math.min(1, cycle * 5),
          bowTension: Math.max(0, Math.min(1, (cycle - 0.2) / 0.6)),
          originY: 0,
        });
      },
    },
    {
      id: 'death',
      title: 'Death · collapse forward',
      description: 'Knees buckle, drops to the knees, then collapses face down where it stood.',
      render: (sprite) => this.fallClock.render(sprite, 'death'),
    },
    {
      id: 'death-crumple',
      title: 'Death · crumple backwards',
      description: 'Recoils from the hit, the legs give way, sits down and falls onto its back.',
      offsetX: 29,
      render: (sprite) => this.fallClock.render(sprite, 'deathCrumple'),
    },
    {
      id: 'death-stiff',
      title: 'Death · stiff fall (headshot)',
      description: 'Head snaps back and the rigid body topples backwards around the feet, with a small bounce.',
      offsetX: 54,
      render: (sprite) => this.fallClock.render(sprite, 'deathStiff'),
    },
    {
      id: 'explosive-death',
      title: 'Explosive death · blown apart',
      description: 'Body bursts into head, torso, arms and legs that fly, spin, bounce and settle, with blood.',
      previewScale: 0.25,
      zoomScale: 1.3,
      render: (sprite) => this.gibReplay.render(sprite),
    },
    {
      id: 'knockback',
      title: 'Knockback (explosions)',
      description: 'Thrown a short distance backwards, lands and ends lying on its back.',
      offsetX: 54,
      render: (sprite) => this.fallClock.render(sprite, 'knockback'),
    },
    {
      id: 'knockback-get-up',
      title: 'Knockback → get up',
      description: 'Knockback, a moment on the ground, then sits up, pushes off and stands up again.',
      offsetX: 54,
      render: (sprite) => this.fallClock.renderKnockbackGetUp(sprite),
    },
  ];
  private readonly listSprites = new Map<PreviewRow, Graphics>();
  private readonly list = new Container();
  private readonly zoomView = new Container();
  private zoomSprite = new Graphics();
  private zoomed?: PreviewRow;

  private archerPhase = 0;
  private runPhase = 0;
  private attackPhase = 0;
  private archerWalkPhase = 0;
  private readonly pausingWalk = new PausingWalk();
  private readonly walkRunSequence = new WalkRunSequence();
  private readonly archerSequence = new ArcherReadySequence();
  private readonly fallClock = new FallClock();
  private readonly gibReplay = new GibReplay();
  private scrollY = 0;
  private readonly listMask = new Graphics().rect(0, LIST_TOP, GAME_WIDTH, LIST_BOTTOM - LIST_TOP).fill({ color: 0xffffff });
  private readonly scrollbar = new Graphics();

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
    this.archerPhase += deltaMs / 900;
    this.runPhase += deltaMs / RUN_PHASE_MS;
    this.attackPhase += deltaMs / 180;
    this.archerWalkPhase += deltaMs / WALK_PHASE_MS;
    this.pausingWalk.update(deltaMs);
    this.walkRunSequence.update(deltaMs);
    this.archerSequence.update(deltaMs);
    this.fallClock.update(deltaMs);
    this.gibReplay.update(deltaMs);
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
      sprite,
      PREVIEW_X + (preview.offsetX ?? 0) * (preview.previewScale ?? PREVIEW_SCALE),
      ROW_HEIGHT / 2,
      preview.previewScale ?? PREVIEW_SCALE,
      PREVIEW_X - 55,
      PREVIEW_X + 55,
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
      this.zoomSprite,
      ZOOM_FIGURE_X - 30 + (preview.offsetX ?? 0) * (preview.zoomScale ?? ZOOM_SCALE),
      top + height * 0.6,
      preview.zoomScale ?? ZOOM_SCALE,
      60,
      ZOOM_TEXT_X - 50,
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

  private draw(): void {
    if (this.zoomed) {
      this.zoomed.render(this.zoomSprite);
      return;
    }
    this.listSprites.forEach((sprite, row) => row.render(sprite));
  }
}
