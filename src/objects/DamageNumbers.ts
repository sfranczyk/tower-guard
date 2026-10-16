import { Container, Text } from 'pixi.js';
import { DAMAGE_NUMBERS } from '../config';
import { damageLabel, damagePopupFrame, showsDamageNumber } from '../rendering/damagePopup';
import type { HitInfo } from './enemy/enemyTypes';

const FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const COLOR = 0xffffff;
const HEADSHOT_COLOR = 0xffd54a;
const OUTLINE = 0x1b1a20;
/** Numbers from hits close together spread sideways this far (px) so they don't sit on each other. */
const JITTER_X = 8;

interface Popup {
  text: Text;
  x: number;
  y: number;
  ageMs: number;
}

/** How much each arrow hit takes off, rising over the enemy's head and fading (on/off: settings drawer). */
export class DamageNumbers {
  private readonly layer = new Container();
  private readonly popups: Popup[] = [];

  public constructor(world: Container, private readonly enabled: () => boolean) {
    this.layer.zIndex = 5;
    world.addChild(this.layer);
  }

  /** A number over `foe`'s head (the top of what is drawn of it now: standing, mounted, falling or flying). */
  public show(foe: Container, amount: number, hit?: HitInfo): void {
    const label = damageLabel(amount);
    if (!label || !this.enabled() || !showsDamageNumber(hit?.cause) || !foe.parent) {
      return;
    }
    const bounds = foe.getBounds();
    const top = this.layer.toLocal({ x: bounds.x + bounds.width / 2, y: bounds.y });
    const headshot = hit?.cause === 'headshot';
    const text = new Text({
      text: label,
      resolution: 2,
      style: {
        fontFamily: FONT,
        fontWeight: '700',
        fontSize: headshot ? DAMAGE_NUMBERS.headshotFontSize : DAMAGE_NUMBERS.fontSize,
        fill: headshot ? HEADSHOT_COLOR : COLOR,
        stroke: { color: OUTLINE, width: 4, join: 'round' },
      },
    });
    text.anchor.set(0.5, 1);
    const popup = { text, x: top.x + (Math.random() * 2 - 1) * JITTER_X, y: top.y - DAMAGE_NUMBERS.aboveHead, ageMs: 0 };
    this.popups.push(popup);
    this.layer.addChild(text);
    this.place(popup);
  }

  public update(deltaMs: number): void {
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const popup = this.popups[i];
      popup.ageMs += deltaMs;
      if (popup.ageMs >= DAMAGE_NUMBERS.lifeMs) {
        popup.text.destroy();
        this.popups.splice(i, 1);
      } else {
        this.place(popup);
      }
    }
  }

  private place(popup: Popup): void {
    const frame = damagePopupFrame(popup.ageMs, DAMAGE_NUMBERS.lifeMs, DAMAGE_NUMBERS.rise);
    popup.text.position.set(popup.x, popup.y - frame.rise);
    popup.text.alpha = frame.alpha;
    popup.text.scale.set(frame.scale);
  }
}
