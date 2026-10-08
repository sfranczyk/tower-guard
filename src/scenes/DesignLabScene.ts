import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { BACKDROP_WIDTH, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Scene } from '../core/Scene';
import { centeredCameraX, viewWidth } from '../core/viewport';
import { DESIGN_LAB_PARAM, getUrlParam, setUrlParam } from '../core/urlState';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { Background } from '../rendering/Background';
import { DESIGN_SECTIONS, type DesignEntry, type DesignSection, type DesignView } from '../rendering/designs/catalog';
import { DESIGN_GROUND_Y } from '../rendering/designs/designSkeleton';

/** Same cream panel over the meadow as the animation lab. */
const PANEL = { x: 14, y: 12, width: GAME_WIDTH - 28, height: GAME_HEIGHT - 24, radius: 20 };
const CONTENT = { left: 34, top: 88, bottom: PANEL.y + PANEL.height - 14 };
const GRID = { columns: 4, gap: 12, cardHeight: 206, tileHeight: 148 };
const CARD_WIDTH = (PANEL.width - 2 * (CONTENT.left - PANEL.x) - GRID.gap * (GRID.columns - 1)) / GRID.columns;
const ZOOM = { columns: 3, gap: 10, width: 736 };
const ZOOM_TEXT_X = CONTENT.left + ZOOM.width + 24;
const TABS = { x: 560, y: 22, width: 104, height: 30, gap: 8 };
const DISPLAY_FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const BODY_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const COLORS = { panel: 0xf6f1e4, panelEdge: 0xded3ba, panelSunk: 0xebe3d0, ink: 0x2c3a38, inkSoft: 0x66756f, accent: 0x3f6965 } as const;
const SKY = 0x9cc9dc;
const GRASS = 0x6f9a4d;
const SOIL = 0x8b6b45;
/** Spacing of the grass tufts that scroll under a walking figure. */
const TUFT_SPACING = 26;
/** Ground this far above a tile's bottom edge. */
const GROUND_MARGIN = 16;

interface Figure {
  view: DesignView;
  sprite: Graphics;
  ground?: Graphics;
  /** Half the width of ground to draw, in the figure's own units. */
  halfWidth: number;
}

/**
 * New looks: the game's enemies redesigned over their own animations, proposals for the player and
 * ideas for new enemies, in tabs. Clicking one zooms into all its animations (with the current look
 * for comparison). The tab or zoomed design is kept in the URL (?designs=<section or design id>).
 */
export class DesignLabScene extends Scene {
  private readonly content = new Container();
  private readonly tabs = new Container();
  private readonly page = new Container();
  private readonly intro = text('', 12, COLORS.inkSoft, false, 36, 58);
  private meadow?: Container;
  private figures: Figure[] = [];
  private section: DesignSection = DESIGN_SECTIONS[0];
  private zoomed?: DesignEntry;
  private time = 0;

  public enter(): void {
    this.ctx.ui.showScreen('animationLab');
    const meadow = new Container();
    meadow.sortableChildren = true;
    new Background(meadow, BATTLEGROUNDS.greenMeadow, BACKDROP_WIDTH);
    this.meadow = meadow;
    this.ctx.root.addChild(meadow, this.content);

    this.content.addChild(new Graphics()
      .roundRect(PANEL.x, PANEL.y + 5, PANEL.width, PANEL.height, PANEL.radius).fill({ color: COLORS.panelEdge })
      .roundRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, PANEL.radius).fill({ color: COLORS.panel, alpha: 0.97 }));
    this.content.addChild(text('Design lab', 26, COLORS.ink, true, 36, 20), this.intro, this.tabs, this.page);

    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        if (this.zoomed) {
          this.show(this.section);
        } else {
          this.ctx.goTo('menu');
        }
      }
    });
    const wanted = getUrlParam(DESIGN_LAB_PARAM);
    const section = DESIGN_SECTIONS.find((candidate) => candidate.id === wanted);
    const entrySection = DESIGN_SECTIONS.find((candidate) => candidate.entries.some((entry) => entry.id === wanted));
    this.show(section ?? entrySection ?? DESIGN_SECTIONS[0], entrySection?.entries.find((entry) => entry.id === wanted));
  }

  public update(deltaMs: number): void {
    this.time += deltaMs;
    this.content.x = (viewWidth() - GAME_WIDTH) / 2;
    if (this.meadow) {
      this.meadow.x = -centeredCameraX();
    }
    this.figures.forEach((figure) => this.drawFigure(figure));
  }

  /** Shows a tab's grid, or one of its designs zoomed in. */
  private show(section: DesignSection, entry?: DesignEntry): void {
    this.section = section;
    this.zoomed = entry;
    setUrlParam(DESIGN_LAB_PARAM, entry?.id ?? section.id);
    this.figures = [];
    this.page.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.intro.text = entry ? `${section.tab} · Esc or click to return` : section.intro;
    this.drawTabs();
    if (entry) {
      this.createZoom(entry);
    } else {
      section.entries.forEach((item, index) => this.createCard(item, index));
    }
  }

  private drawTabs(): void {
    this.tabs.removeChildren().forEach((child) => child.destroy({ children: true }));
    DESIGN_SECTIONS.forEach((section, index) => {
      const active = section === this.section;
      const x = TABS.x + index * (TABS.width + TABS.gap);
      const tab = new Container();
      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.hitArea = new Rectangle(x, TABS.y, TABS.width, TABS.height);
      tab.on('pointertap', () => this.show(section));
      tab.addChild(new Graphics().roundRect(x, TABS.y, TABS.width, TABS.height, TABS.height / 2)
        .fill({ color: active ? COLORS.accent : COLORS.panelSunk }));
      const label = text(section.tab, 14, active ? 0xffffff : COLORS.ink, true, x + TABS.width / 2, TABS.y + TABS.height / 2);
      label.anchor.set(0.5);
      tab.addChild(label);
      this.tabs.addChild(tab);
    });
  }

  private createCard(entry: DesignEntry, index: number): void {
    const x = CONTENT.left + (index % GRID.columns) * (CARD_WIDTH + GRID.gap);
    const y = CONTENT.top + Math.floor(index / GRID.columns) * (GRID.cardHeight + GRID.gap);
    const card = new Container();
    card.position.set(x, y);
    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.hitArea = new Rectangle(0, 0, CARD_WIDTH, GRID.cardHeight);
    card.on('pointertap', () => this.show(this.section, entry));
    const edge = new Graphics().roundRect(0, 0, CARD_WIDTH, GRID.cardHeight, 14).stroke({ width: 2, color: COLORS.accent });
    edge.alpha = 0;
    card.on('pointerover', () => { edge.alpha = 1; });
    card.on('pointerout', () => { edge.alpha = 0; });
    card.addChild(new Graphics().roundRect(0, 0, CARD_WIDTH, GRID.cardHeight, 14).fill({ color: COLORS.panelSunk }), edge);
    this.createTile(card, entry, entry.views[0], 6, 6, CARD_WIDTH - 12, GRID.tileHeight);

    card.addChild(new Graphics().circle(18, GRID.tileHeight + 24, 10).fill({ color: COLORS.accent }));
    const number = text(`${index + 1}`, 11, 0xffffff, true, 18, GRID.tileHeight + 24);
    number.anchor.set(0.5);
    card.addChild(number);
    card.addChild(text(entry.name, 15, COLORS.ink, true, 34, GRID.tileHeight + 13));
    card.addChild(text(entry.tagline, 11, COLORS.inkSoft, false, 12, GRID.tileHeight + 38));
    this.page.addChild(card);
  }

  /** Every animation of a design in tiles (three to a row, dragons one), with its name and description beside them. */
  private createZoom(entry: DesignEntry): void {
    const zoom = new Container();
    zoom.eventMode = 'static';
    zoom.cursor = 'pointer';
    zoom.hitArea = new Rectangle(PANEL.x, CONTENT.top - 10, PANEL.width, CONTENT.bottom - CONTENT.top + 10);
    zoom.on('pointertap', () => this.show(this.section));
    // Dragons are wide: one per row, across the whole width.
    const columns = entry.flying ? 1 : entry.views.length > 6 ? 4 : ZOOM.columns;
    const rows = Math.ceil(entry.views.length / columns);
    const width = (ZOOM.width - ZOOM.gap * (columns - 1)) / columns;
    const height = (CONTENT.bottom - CONTENT.top - ZOOM.gap * (rows - 1)) / rows;
    entry.views.forEach((view, index) => {
      const x = CONTENT.left + (index % columns) * (width + ZOOM.gap);
      const y = CONTENT.top + Math.floor(index / columns) * (height + ZOOM.gap);
      this.createTile(zoom, entry, view, x, y, width, height);
      const label = text(view.label, 12, view.label === 'Now' || view.label === 'Old' ? 0xffffff : COLORS.ink, true, x + 18, y + 10);
      zoom.addChild(new Graphics().roundRect(x + 8, y + 7, label.width + 20, 22, 11)
        .fill({ color: view.label === 'Now' || view.label === 'Old' ? COLORS.inkSoft : COLORS.panel, alpha: 0.92 }), label);
    });
    const textWidth = PANEL.x + PANEL.width - ZOOM_TEXT_X - 24;
    const name = wrapped(entry.name, 24, ZOOM_TEXT_X, CONTENT.top - 2, textWidth, COLORS.ink, true);
    const tagline = wrapped(entry.tagline, 14, ZOOM_TEXT_X, name.y + name.height + 6, textWidth, COLORS.accent, true);
    const description = wrapped(entry.description, 13, ZOOM_TEXT_X, tagline.y + tagline.height + 10, textWidth, COLORS.inkSoft);
    zoom.addChild(name, tagline, description);
    this.page.addChild(zoom);
  }

  /** A sky tile with the figure (and its ground, unless it flies), clipped to the tile. */
  private createTile(parent: Container, entry: DesignEntry, view: DesignView, x: number, y: number, width: number, height: number): void {
    parent.addChild(new Graphics().roundRect(x, y, width, height, 10).fill({ color: SKY }));
    const clip = new Graphics().roundRect(x, y, width, height, 10).fill({ color: 0xffffff });
    const holder = new Container();
    holder.mask = clip;
    const sprite = new Graphics();
    const figure: Figure = { view, sprite, halfWidth: 0 };
    if (entry.flying) {
      const scale = Math.min(width / 440, height / 300) * (view.scale ?? 1);
      holder.scale.set(scale);
      holder.position.set(x + width / 2 + (view.offsetX ?? entry.offsetX ?? 0) * scale, y + height / 2 + 10 * scale);
    } else {
      // Tall enough for a club raised overhead, wide enough for a fall onto the back.
      const scale = Math.min(height / 180, width / 130) * (view.scale ?? 1);
      holder.scale.set(scale);
      holder.position.set(x + width / 2 + (view.offsetX ?? entry.offsetX ?? 0) * scale, y + height - GROUND_MARGIN - DESIGN_GROUND_Y * scale);
      figure.ground = new Graphics();
      // Wide enough to reach both edges of the tile, however far the figure is shifted.
      figure.halfWidth = width / 2 / scale + Math.abs(view.offsetX ?? entry.offsetX ?? 0) + 4;
      holder.addChild(figure.ground);
    }
    holder.addChild(sprite);
    parent.addChild(clip, holder);
    this.figures.push(figure);
  }

  private drawFigure(figure: Figure): void {
    const { view, ground, halfWidth } = figure;
    view.draw(figure.sprite, this.time);
    if (!ground) {
      return;
    }
    const scroll = (this.time * (view.speed ?? 0)) % TUFT_SPACING;
    ground.clear()
      .rect(-halfWidth, DESIGN_GROUND_Y, halfWidth * 2, 80).fill({ color: SOIL })
      .rect(-halfWidth, DESIGN_GROUND_Y - 1, halfWidth * 2, 6).fill({ color: GRASS });
    for (let x = -halfWidth - scroll; x < halfWidth + TUFT_SPACING; x += TUFT_SPACING) {
      ground.poly([x, DESIGN_GROUND_Y, x + 3, DESIGN_GROUND_Y - 5, x + 6, DESIGN_GROUND_Y]).fill({ color: GRASS });
      ground.circle(x + 13, DESIGN_GROUND_Y + 12, 1.6).fill({ color: 0x6b5236 });
    }
  }
}

const text = (content: string, size: number, color: number, display: boolean, x: number, y: number): Text => {
  const label = new Text({
    text: content,
    style: { fill: color, fontSize: size, fontFamily: display ? DISPLAY_FONT : BODY_FONT, fontWeight: display ? '600' : '400' },
  });
  label.position.set(x, y);
  return label;
};

const wrapped = (content: string, size: number, x: number, y: number, width: number, color: number, display = false): Text => {
  const label = text(content, size, color, display, x, y);
  label.style.wordWrap = true;
  label.style.wordWrapWidth = width;
  label.style.lineHeight = Math.round(size * 1.45);
  return label;
};
