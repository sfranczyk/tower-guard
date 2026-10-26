import { Container, Graphics, Text } from 'pixi.js';
import { drawHealthBar } from '../../rendering/healthBar';
import type { Vec2 } from '../../types';

const FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const OUTLINE = 0x1b1a20;
/** Container space (the bowman is drawn at 1/3): the name this far over his head, the plus this far right of the bar. */
const NAME = { fontSize: 45, aboveHead: 30 };
const PLUS = { size: 30, thickness: 9, gap: 12, color: 0x6fd36b };
/** Health bar under his feet (container space, drawn at 1/3: the enemies' size on screen). */
const HEALTH_BAR = { width: 60, height: 8, belowFeet: 22 };

/**
 * What a bowman shows besides his body (`bowman.tags`): the health bar under his feet (`setHealthRatio`, from the
 * battle's Player health; off in the menu), his player's name over his head (online, toggled by Ctrl,
 * scenes/BattleNameTags.ts) and a green "+" right of the health bar while he regenerates (MOBA).
 */
export class BowmanTags {
  private readonly healthBar = new Graphics();
  private healthRatio = 1;
  private readonly name = new Text({
    text: '',
    resolution: 2,
    style: { fontFamily: FONT, fontWeight: '700', fontSize: NAME.fontSize, fill: 0xfff6dc, stroke: { color: OUTLINE, width: 9, join: 'round' } },
  });
  private readonly plus = new Graphics();

  public constructor(parent: Container, private readonly showHealth: boolean) {
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
    parent.addChild(this.healthBar, this.name, this.plus);
  }

  /** The name over his head (undefined: none); `mirrored`: the battle view is flipped, the name flips back to read right. */
  public setName(name: string | undefined, mirrored = false): void {
    this.name.visible = name !== undefined;
    this.name.scale.x = mirrored ? -1 : 1;
    if (name !== undefined && this.name.text !== name) {
      this.name.text = name;
    }
  }

  public setRegenerating(regenerating: boolean): void {
    this.plus.visible = regenerating;
  }

  /** His health share (0..1) for the bar under his feet. */
  public setHealthRatio(ratio: number): void {
    this.healthRatio = ratio;
  }

  /** Under his feet as he is drawn now (`points`: his body points; standing, falling, flailing), the name over his head; hidden once dead. */
  public place(points: readonly Vec2[], alive: boolean): void {
    const shown = this.showHealth && alive;
    this.healthBar.visible = shown;
    this.name.renderable = shown;
    this.plus.renderable = shown;
    if (!shown) {
      return;
    }
    const bottom = Math.max(0, ...points.map((point) => point.y));
    const top = Math.min(0, ...points.map((point) => point.y));
    const centre = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    this.healthBar.position.set(centre, bottom + HEALTH_BAR.belowFeet);
    drawHealthBar(this.healthBar, this.healthRatio, HEALTH_BAR.width, HEALTH_BAR.height);
    this.name.position.set(centre, top - NAME.aboveHead);
    this.plus.position.set(centre + HEALTH_BAR.width / 2 + PLUS.gap + PLUS.size / 2, this.healthBar.y);
  }
}
