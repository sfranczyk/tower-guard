import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { GAME_HEIGHT, GAME_WIDTH, SHOW_HITBOX_DEBUG } from '../config';
import { Scene } from '../core/Scene';
import { LAB_PARAM, getUrlParam, setUrlParam } from '../core/urlState';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { Background } from '../rendering/Background';
import { drawStickman } from '../rendering/stickman';
import { drawDragonRider } from '../rendering/dragon';
import { drawStickmanCheer } from '../rendering/stickmanCheer';
import { ArcherReadySequence, FallClock, GibReplay, PausingWalk, RUN_PHASE_MS, WALK_PHASE_MS, WalkRunSequence } from './labSequences';

/** The cream panel the lab sits on (same look as the HTML panels), over the meadow. */
const PANEL = { x: 14, y: 12, width: GAME_WIDTH - 28, height: GAME_HEIGHT - 24, radius: 20 };
const LIST_TOP = 84;
const LIST_BOTTOM = PANEL.y + PANEL.height - 10;
/** Rows visible at once; the rest scroll with the mouse wheel. */
const VISIBLE_ROWS = 8;
const ROW_HEIGHT = (LIST_BOTTOM - LIST_TOP) / VISIBLE_ROWS;
/** Previews are drawn smaller so every full-height stickman fits one under another. */
const PREVIEW_SCALE = 0.4;
const PREVIEW_X = 132;
const TEXT_X = 262;
const DISPLAY_FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const BODY_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
/** UI palette (index.html tokens). */
const COLORS = { panel: 0xf6f1e4, panelEdge: 0xded3ba, panelSunk: 0xebe3d0, ink: 0x2c3a38, inkSoft: 0x66756f, accent: 0x3f6965 } as const;

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
  /** Flying animations get no ground line under them. */
  flying?: boolean;
  /** Scale overrides for animations that spread wide (default PREVIEW_SCALE / ZOOM_SCALE). */
  previewScale?: number;
  zoomScale?: number;
};

/** Preview tiles: dark slate so the white skeletons read; the armored archer gets the sky. */
const DEFAULT_BACKDROP = 0x2c4448;
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
      description: 'Whole-body club swing: winds the club up behind the head leaning back, strikes down with a forward lunge and dip, then recovers smoothly to the stance (no jump at either end).',
      render: (sprite) => drawStickman(sprite, 0, { idleBlend: 1, armed: true, attackPhase: this.attackPhase, originY: 0 }),
    },
    {
      id: 'dragon-rider',
      title: 'Dragon rider (flying)',
      description: 'A red dragon beating its wings in a loop (the far wing a beat behind), bobbing up on each downstroke with its neck and tail undulating; the stickman rider sits in the saddle with the reins and a raised spear.',
      backdrop: SKY_BACKDROP,
      flying: true,
      previewScale: 0.17,
      zoomScale: 1.15,
      offsetX: 25,
      render: (sprite) => drawDragonRider(sprite, this.cheerTime),
    },
    {
      id: 'runner-run',
      title: 'Runner: run with a short club',
      description: 'Runners sprint in with the full run cycle, carrying the short club they swing from below.',
      render: (sprite) => drawStickman(sprite, this.runPhase, { running: true, armed: true, attackStyle: 'uppercut', originY: 0 }),
    },
    {
      id: 'brute-walk',
      title: 'Brute: walk with a long club',
      description: 'Brutes are half again as tall in the game and carry a long club in both hands (shown at normal size here).',
      render: (sprite) => drawStickman(sprite, this.pausingWalk.phase, { idleBlend: this.pausingWalk.idleBlend, armed: true, attackStyle: 'twoHanded', originY: 0 }),
    },
    {
      id: 'enemy-attack-two-handed',
      title: 'Enemy two-handed attack',
      description: 'A longer club gripped with both hands: a big wind-up far behind the head, then a heavy chop into a deep lunge.',
      render: (sprite) => drawStickman(sprite, 0, { idleBlend: 1, armed: true, attackStyle: 'twoHanded', attackPhase: this.attackPhase, originY: 0 }),
    },
    {
      id: 'enemy-attack-uppercut',
      title: 'Enemy uppercut attack',
      description: 'A short club swung from below: crouched wind-up low behind the hip, then up and forward while rising and stepping in.',
      render: (sprite) => drawStickman(sprite, 0, { idleBlend: 1, armed: true, attackStyle: 'uppercut', attackPhase: this.attackPhase, originY: 0 }),
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
      // Pieces fly up to ~350 units back and ~210 up (measured over many seeds): framed to fit.
      offsetX: 155,
      previewScale: 0.3,
      zoomScale: 1,
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
    {
      id: 'cheer-jump',
      title: 'Cheer: jump',
      description: 'Victory hop: crouches, springs up with both arms thrown into a V and lands softly. Enemies cheer like this when they win.',
      render: (sprite) => drawStickmanCheer(sprite, 'cheerJump', this.cheerTime, 0, { club: true }),
    },
    {
      id: 'cheer-fist',
      title: 'Cheer: fist pump',
      description: 'Pumps the club overhead with the other hand on the hip, dipping at the knees with each "yes!".',
      render: (sprite) => drawStickmanCheer(sprite, 'cheerFist', this.cheerTime, 0, { club: true }),
    },
    {
      id: 'cheer-wave',
      title: 'Cheer: wave',
      description: 'Both arms up, waving side to side while swaying and bouncing on the toes.',
      render: (sprite) => drawStickmanCheer(sprite, 'cheerWave', this.cheerTime, 0, { club: true }),
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
  private cheerTime = 0;
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
    if (SHOW_HITBOX_DEBUG) {
      // Debug console hook (?debug), like GameScene's: e.g. set attackPhase with the ticker stopped.
      (window as unknown as { __towerGuard?: unknown }).__towerGuard = { scene: this };
      this.onExit(() => {
        delete (window as unknown as { __towerGuard?: unknown }).__towerGuard;
      });
    }
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
    this.cheerTime += deltaMs;
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
    const meadow = new Container();
    meadow.sortableChildren = true;
    new Background(meadow, BATTLEGROUNDS.greenMeadow);
    root.addChild(meadow);
    root.addChild(new Graphics()
      .roundRect(PANEL.x, PANEL.y + 5, PANEL.width, PANEL.height, PANEL.radius).fill({ color: COLORS.panelEdge })
      .roundRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, PANEL.radius).fill({ color: COLORS.panel, alpha: 0.97 }));
    root.addChild(AnimationLabScene.text('Animation lab', 26, COLORS.ink, 700, 36, 22, DISPLAY_FONT));
    root.addChild(AnimationLabScene.text(
      'Every stickman animation, one per row. Click a row to zoom in.',
      12, COLORS.inkSoft, 400, 36, 56,
    ));
  }

  private createRow(preview: PreviewRow, index: number): void {
    const { title, description, backdrop = DEFAULT_BACKDROP } = preview;
    const top = LIST_TOP + index * ROW_HEIGHT;
    const row = new Container();
    row.position.set(0, top);
    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.hitArea = new Rectangle(PANEL.x + 10, 0, PANEL.width - 20, ROW_HEIGHT);
    row.on('pointertap', () => this.zoomTo(preview));

    const highlight = new Graphics().roundRect(PANEL.x + 10, 1, PANEL.width - 34, ROW_HEIGHT - 2, 12).fill({ color: COLORS.panelSunk });
    highlight.alpha = 0;
    row.addChild(highlight);
    row.on('pointerover', () => { highlight.alpha = 1; });
    row.on('pointerout', () => { highlight.alpha = 0; });
    row.addChild(new Graphics().moveTo(PANEL.x + 20, ROW_HEIGHT).lineTo(PANEL.x + PANEL.width - 34, ROW_HEIGHT)
      .stroke({ width: 1, color: COLORS.panelEdge }));

    row.addChild(new Graphics().roundRect(PREVIEW_X - 62, 4, 124, ROW_HEIGHT - 8, 9).fill({ color: backdrop }));
    const sprite = new Graphics();
    this.listSprites.set(preview, sprite);
    // Clip the figure to its backdrop so wide animations (e.g. flying body parts) stay inside it.
    const clip = new Graphics().roundRect(PREVIEW_X - 62, 4, 124, ROW_HEIGHT - 8, 9).fill({ color: 0xffffff });
    row.addChild(clip);
    const [rowGround, rowFigure] = AnimationLabScene.createFigure(
      sprite,
      PREVIEW_X + (preview.offsetX ?? 0) * (preview.previewScale ?? PREVIEW_SCALE),
      ROW_HEIGHT / 2,
      preview.previewScale ?? PREVIEW_SCALE,
      PREVIEW_X - 55,
      PREVIEW_X + 55,
    );
    rowFigure.mask = clip;
    rowGround.visible = !preview.flying;
    row.addChild(rowGround, rowFigure);

    row.addChild(new Graphics().circle(46, ROW_HEIGHT / 2, 11).fill({ color: COLORS.accent }));
    const number = AnimationLabScene.text(`${index + 1}`, 11, 0xffffff, 700, 46, ROW_HEIGHT / 2, DISPLAY_FONT);
    number.anchor.set(0.5);
    row.addChild(number);
    row.addChild(AnimationLabScene.text(title, 15, COLORS.ink, 700, TEXT_X, ROW_HEIGHT / 2 - 19, DISPLAY_FONT));
    row.addChild(AnimationLabScene.text(description, 12, COLORS.inkSoft, 400, TEXT_X, ROW_HEIGHT / 2 + 2));

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
    const clip = new Graphics().roundRect(40, top, ZOOM_TEXT_X - 70, height, 12).fill({ color: 0xffffff });
    this.zoomView.addChild(clip);
    const [zoomGround, zoomFigure] = AnimationLabScene.createFigure(
      this.zoomSprite,
      ZOOM_FIGURE_X - 30 + (preview.offsetX ?? 0) * (preview.zoomScale ?? ZOOM_SCALE),
      top + height * 0.6,
      preview.zoomScale ?? ZOOM_SCALE,
      60,
      ZOOM_TEXT_X - 50,
    );
    zoomFigure.mask = clip;
    zoomGround.visible = !preview.flying;
    this.zoomView.addChild(zoomGround, zoomFigure);
    this.zoomView.addChild(AnimationLabScene.text(`Animation ${index + 1} of ${this.rows.length}`, 13, COLORS.accent, 700, ZOOM_TEXT_X, top + 8, DISPLAY_FONT));
    this.zoomView.addChild(AnimationLabScene.wrapped(preview.title, 26, ZOOM_TEXT_X, top + 30, GAME_WIDTH - ZOOM_TEXT_X - 44, COLORS.ink, 700, DISPLAY_FONT));
    this.zoomView.addChild(AnimationLabScene.wrapped(preview.description, 14, ZOOM_TEXT_X, top + 104, GAME_WIDTH - ZOOM_TEXT_X - 44));
    this.zoomView.addChild(AnimationLabScene.wrapped('Esc or “All animations” returns to the list.', 12, ZOOM_TEXT_X, top + height - 24, GAME_WIDTH - ZOOM_TEXT_X - 44, COLORS.inkSoft));
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
      .roundRect(PANEL.x + PANEL.width - 16, LIST_TOP, 5, trackHeight, 2.5).fill({ color: COLORS.panelSunk })
      .roundRect(PANEL.x + PANEL.width - 16, thumbY, 5, thumbHeight, 2.5).fill({ color: COLORS.accent });
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
      .stroke({ width: 2, color: 0x6d8f86 });
    return [ground, figure];
  }

  private static wrapped(
    content: string, size: number, x: number, y: number, width: number,
    color: number = COLORS.inkSoft, weight: 400 | 700 = 400, font = BODY_FONT,
  ): Text {
    const text = AnimationLabScene.text(content, size, color, weight, x, y, font);
    text.style.wordWrap = true;
    text.style.wordWrapWidth = width;
    text.style.lineHeight = Math.round(size * 1.45);
    return text;
  }

  private static text(content: string, size: number, color: number, weight: 400 | 700, x: number, y: number, font = BODY_FONT): Text {
    const text = new Text({
      text: content,
      style: { fill: color, fontSize: size, fontFamily: font, fontWeight: weight === 700 ? (font === DISPLAY_FONT ? '600' : '700') : '400' },
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
