import { Container, Graphics, Text } from 'pixi.js';

const FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const OUTLINE = 0x1b1a20;
/** Container space (the bowman is drawn at 1/3): the name this far over his head, the plus this far right of the bar. */
const NAME = { fontSize: 45, aboveHead: 30 };
const PLUS = { size: 30, thickness: 9, gap: 12, color: 0x6fd36b };

/**
 * What a bowman shows besides his body and health bar: his player's name over his head (online, while Ctrl is held,
 * scenes/BattleNameTags.ts) and a green "+" right of the health bar while he regenerates (MOBA).
 */
export class BowmanTags {
  private readonly name = new Text({
    text: '',
    resolution: 2,
    style: { fontFamily: FONT, fontWeight: '700', fontSize: NAME.fontSize, fill: 0xfff6dc, stroke: { color: OUTLINE, width: 9, join: 'round' } },
  });
  private readonly plus = new Graphics();

  public constructor(parent: Container) {
    this.name.anchor.set(0.5, 1);
    this.name.visible = false;
    this.plus.visible = false;
    const { size, thickness } = PLUS;
    const half = size / 2;
    const arm = thickness / 2;
    // Outline first, then the green cross over it.
    this.plus
      .rect(-half - 3, -arm - 3, size + 6, thickness + 6).fill(OUTLINE)
      .rect(-arm - 3, -half - 3, thickness + 6, size + 6).fill(OUTLINE)
      .rect(-half, -arm, size, thickness).fill(PLUS.color)
      .rect(-arm, -half, thickness, size).fill(PLUS.color);
    parent.addChild(this.name, this.plus);
  }

  /** The name over his head (undefined: none). */
  public setName(name: string | undefined): void {
    this.name.visible = name !== undefined;
    if (name !== undefined && this.name.text !== name) {
      this.name.text = name;
    }
  }

  public setRegenerating(regenerating: boolean): void {
    this.plus.visible = regenerating;
  }

  /** Placed on the body as drawn now: `centre` x, `top` of his head, and the health bar's centre y and width. */
  public place(centre: number, top: number, bar: { y: number; width: number }): void {
    this.name.position.set(centre, top - NAME.aboveHead);
    this.plus.position.set(centre + bar.width / 2 + PLUS.gap + PLUS.size / 2, bar.y);
  }

  /** Hidden with the health bar (a fallen bowman, the menu's). */
  public setShown(shown: boolean): void {
    this.name.renderable = shown;
    this.plus.renderable = shown;
  }
}
