import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { BACKDROP_WIDTH, GAME_HEIGHT, GAME_WIDTH, SHOW_HITBOX_DEBUG } from '../config';
import { Scene } from '../core/Scene';
import { centeredCameraX, viewWidth } from '../core/viewport';
import { LAB_PARAM, getUrlParam, setUrlParam } from '../core/urlState';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { Background } from '../rendering/Background';
import { LAB_CATEGORIES, LabClock, type LabCategory, type LabRow } from './labRows';

/** The cream panel the lab sits on (same look as the HTML panels), over the meadow. */
const PANEL = { x: 14, y: 12, width: GAME_WIDTH - 28, height: GAME_HEIGHT - 24, radius: 20 };
const TABS = { x: 300, y: 22, width: 104, height: 30, gap: 8 };
const LIST_TOP = 84;
const LIST_BOTTOM = PANEL.y + PANEL.height - 10;
/** Rows visible at once; the rest scroll with the mouse wheel. */
const VISIBLE_ROWS = 7;
const ROW_HEIGHT = (LIST_BOTTOM - LIST_TOP) / VISIBLE_ROWS;
/** Previews are drawn smaller so every full-height stickman fits one under another. */
const PREVIEW_SCALE = 0.4;
const PREVIEW_X = 132;
const TEXT_X = 262;
const DISPLAY_FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const BODY_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
/** UI palette (index.html tokens). */
const COLORS = { panel: 0xf6f1e4, panelEdge: 0xded3ba, panelSunk: 0xebe3d0, ink: 0x2c3a38, inkSoft: 0x66756f, accent: 0x3f6965 } as const;
/** Tiles: dark slate so the white skeleton reads; dragons get the sky. */
const GROUND_BACKDROP = 0x2c4448;
const SKY_BACKDROP = 0x80b8d1;

const ZOOM_SCALE = 2.4;
const ZOOM_FIGURE_X = 280;
const ZOOM_TEXT_X = 520;

/**
 * Every animation once, on the bare skeleton, in tabs by what it is for (labRows.ts). Clicking a row zooms
 * into it; the tab or zoomed animation is kept in the URL (?lab=<category or row id>) so it survives a refresh.
 */
export class AnimationLabScene extends Scene {
  private readonly clock = new LabClock();
  private category: LabCategory = LAB_CATEGORIES[0];
  private readonly listSprites = new Map<LabRow, Graphics>();
  private readonly tabs = new Container();
  private readonly intro = AnimationLabScene.text('', 12, COLORS.inkSoft, 400, 36, 56);
  private readonly list = new Container();
  private readonly zoomView = new Container();
  private zoomSprite = new Graphics();
  private zoomed?: LabRow;
  /** The panel and everything on it, centred in views wider than GAME_WIDTH (the meadow fills the rest). */
  private readonly content = new Container();
  private meadow?: Container;
  private scrollY = 0;
  private readonly listMask = new Graphics().rect(0, LIST_TOP, GAME_WIDTH, LIST_BOTTOM - LIST_TOP).fill({ color: 0xffffff });
  private readonly scrollbar = new Graphics();

  public enter(): void {
    const { ui } = this.ctx;
    ui.showScreen('animationLab');
    if (SHOW_HITBOX_DEBUG) {
      // Debug console hook (?debug), like GameScene's.
      (window as unknown as { __towerGuard?: unknown }).__towerGuard = { scene: this };
      this.onExit(() => {
        delete (window as unknown as { __towerGuard?: unknown }).__towerGuard;
      });
    }
    this.createBackdrop();
    this.list.mask = this.listMask;
    this.content.addChild(this.tabs, this.intro, this.listMask, this.list, this.scrollbar, this.zoomView);
    this.listenWindow('wheel', (event) => {
      if (!this.zoomed) {
        this.scrollTo(this.scrollY + event.deltaY * 0.5);
      }
    });

    ui.handlers.labBack = () => this.zoomTo(undefined);
    this.onExit(() => {
      ui.handlers.labBack = undefined;
    });
    this.listenWindow('keydown', (event) => {
      if (event.code !== 'Escape') {
        return;
      }
      if (this.zoomed) {
        this.zoomTo(undefined);
      } else {
        this.ctx.goTo('menu');
      }
    });

    const wanted = getUrlParam(LAB_PARAM);
    const category = LAB_CATEGORIES.find((candidate) => candidate.id === wanted);
    const rowCategory = LAB_CATEGORIES.find((candidate) => candidate.rows.some((row) => row.id === wanted));
    this.showCategory(category ?? rowCategory ?? LAB_CATEGORIES[0]);
    this.zoomTo(rowCategory?.rows.find((row) => row.id === wanted));
  }

  public update(deltaMs: number): void {
    this.content.x = (viewWidth() - GAME_WIDTH) / 2;
    if (this.meadow) {
      this.meadow.x = -centeredCameraX();
    }
    this.clock.update(deltaMs);
    this.draw();
  }

  private createBackdrop(): void {
    const { root } = this.ctx;
    const meadow = new Container();
    meadow.sortableChildren = true;
    new Background(meadow, BATTLEGROUNDS.greenMeadow, BACKDROP_WIDTH);
    root.addChild(meadow, this.content);
    this.meadow = meadow;
    this.content.addChild(new Graphics()
      .roundRect(PANEL.x, PANEL.y + 5, PANEL.width, PANEL.height, PANEL.radius).fill({ color: COLORS.panelEdge })
      .roundRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, PANEL.radius).fill({ color: COLORS.panel, alpha: 0.97 }));
    this.content.addChild(AnimationLabScene.text('Animation lab', 26, COLORS.ink, 700, 36, 22, DISPLAY_FONT));
  }

  /** Shows a tab's rows (and leaves any zoomed animation). */
  private showCategory(category: LabCategory): void {
    this.category = category;
    this.intro.text = category.intro;
    this.drawTabs();
    this.list.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.listSprites.clear();
    category.rows.forEach((row, index) => this.createRow(row, index));
    this.scrollTo(0);
    this.zoomTo(undefined);
  }

  private drawTabs(): void {
    this.tabs.removeChildren().forEach((child) => child.destroy({ children: true }));
    LAB_CATEGORIES.forEach((category, index) => {
      const active = category === this.category;
      const x = TABS.x + index * (TABS.width + TABS.gap);
      const tab = new Container();
      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.hitArea = new Rectangle(x, TABS.y, TABS.width, TABS.height);
      tab.on('pointertap', () => this.showCategory(category));
      tab.addChild(new Graphics().roundRect(x, TABS.y, TABS.width, TABS.height, TABS.height / 2)
        .fill({ color: active ? COLORS.accent : COLORS.panelSunk }));
      const label = AnimationLabScene.text(category.tab, 14, active ? 0xffffff : COLORS.ink, 700, x + TABS.width / 2, TABS.y + TABS.height / 2, DISPLAY_FONT);
      label.anchor.set(0.5);
      tab.addChild(label);
      this.tabs.addChild(tab);
    });
  }

  private createRow(preview: LabRow, index: number): void {
    const { title, description } = preview;
    const backdrop = preview.sky ? SKY_BACKDROP : GROUND_BACKDROP;
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
    row.addChild(AnimationLabScene.wrapped(description, 12, TEXT_X, ROW_HEIGHT / 2 + 2, PANEL.x + PANEL.width - 40 - TEXT_X));

    this.list.addChild(row);
  }

  /** Switches between the list (undefined) and one zoomed animation, and records it in the URL. */
  private zoomTo(preview: LabRow | undefined): void {
    this.zoomed = preview;
    this.list.visible = !preview;
    this.scrollbar.visible = !preview && this.maxScroll > 0;
    this.zoomView.visible = Boolean(preview);
    this.ctx.ui.setLabZoomed(Boolean(preview));
    setUrlParam(LAB_PARAM, preview?.id ?? this.category.id);

    this.zoomView.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.zoomSprite = new Graphics();
    if (!preview) {
      this.draw();
      return;
    }

    const index = this.category.rows.indexOf(preview);
    const top = LIST_TOP + 4;
    const height = GAME_HEIGHT - top - 16;
    this.zoomView.addChild(new Graphics()
      .roundRect(40, top, ZOOM_TEXT_X - 70, height, 12)
      .fill({ color: preview.sky ? SKY_BACKDROP : GROUND_BACKDROP }));
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
    const textWidth = GAME_WIDTH - ZOOM_TEXT_X - 44;
    this.zoomView.addChild(AnimationLabScene.text(`${this.category.tab} · ${index + 1} of ${this.category.rows.length}`, 13, COLORS.accent, 700, ZOOM_TEXT_X, top + 8, DISPLAY_FONT));
    this.zoomView.addChild(AnimationLabScene.wrapped(preview.title, 26, ZOOM_TEXT_X, top + 30, textWidth, COLORS.ink, 700, DISPLAY_FONT));
    this.zoomView.addChild(AnimationLabScene.wrapped(preview.description, 14, ZOOM_TEXT_X, top + 104, textWidth));
    this.zoomView.addChild(AnimationLabScene.wrapped('Esc or “All animations” returns to the list.', 12, ZOOM_TEXT_X, top + height - 24, textWidth, COLORS.inkSoft));
    this.draw();
  }

  private get maxScroll(): number {
    return Math.max(0, this.category.rows.length * ROW_HEIGHT - (LIST_BOTTOM - LIST_TOP));
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
      this.zoomed.render(this.zoomSprite, this.clock);
      return;
    }
    this.listSprites.forEach((sprite, row) => row.render(sprite, this.clock));
  }
}
