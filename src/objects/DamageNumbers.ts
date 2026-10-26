import { Container, Graphics, Text } from 'pixi.js';
import { DAMAGE_NUMBERS } from '../config';
import { damageLabel, damagePopupFrame, showsDamageNumber, stackedPopupBottom } from '../rendering/damagePopup';
import type { HitInfo } from './enemy/enemyTypes';

const FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const COLOR = 0xffffff;
/** A critical hit (headshot). */
const HEADSHOT_COLOR = 0xff3b30;
/** A hit on a player's bowman. */
const PLAYER_HIT_COLOR = 0x4aa8ff;
const OUTLINE = 0x1b1a20;
/** MOBA gold popups: gained, lost; the coin beside them. */
const GOLD_COLOR = 0xffc93c;
const GOLD_LOST_COLOR = 0xff6b5a;
const COIN_RADIUS = 8;

interface Popup {
  view: Container;
  x: number;
  y: number;
  /** Its size at scale 1, for stacking. */
  width: number;
  height: number;
  ageMs: number;
}

/** A gold coin (its bottom at y 0, centred on x 0), for the gold popups. */
const coin = (): Graphics => new Graphics()
  .circle(0, -COIN_RADIUS - 2, COIN_RADIUS).fill(0xf2b417).stroke({ color: OUTLINE, width: 2 })
  .circle(0, -COIN_RADIUS - 2, COIN_RADIUS - 3.5).stroke({ color: 0xffe07a, width: 1.5 });

/** How much each arrow hit takes off, rising over the enemy's head and fading (on/off: settings window). */
export class DamageNumbers {
  private readonly layer = new Container();
  private readonly popups: Popup[] = [];

  /** `mirrored`: the battle view is flipped (core/keepSide.ts); the popups flip back so they read the right way. */
  public constructor(world: Container, private readonly enabled: () => boolean, private readonly mirrored: () => boolean = () => false) {
    this.layer.zIndex = 5;
    world.addChild(this.layer);
  }

  /** A number over `foe`'s head (the top of what is drawn of it now: standing, mounted, falling or flying). */
  public show(foe: Container, amount: number, hit?: HitInfo): void {
    const label = damageLabel(amount);
    if (!label || !this.enabled() || !showsDamageNumber(hit?.cause) || !foe.parent) {
      return;
    }
    const headshot = hit?.cause === 'headshot';
    this.spawn(this.label(label, headshot ? DAMAGE_NUMBERS.headshotFontSize : DAMAGE_NUMBERS.fontSize, headshot ? HEADSHOT_COLOR : COLOR), this.topOf(foe));
  }

  /** A player's bowman lost `amount` health: a blue number over his head. */
  public showPlayerHit(bowman: Container, amount: number): void {
    const label = damageLabel(amount);
    if (!label || !this.enabled() || !bowman.parent) {
      return;
    }
    this.spawn(this.label(label, DAMAGE_NUMBERS.fontSize, PLAYER_HIT_COLOR), this.topOf(bowman));
  }

  /** MOBA: gold won (or lost) by a last hit, with a coin, rising over where the victim fell (always shown, for the player it is for). */
  public showGold(at: { x: number; y: number }, delta: number): void {
    if (delta === 0) {
      return;
    }
    const text = this.label(`${delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta))}`, DAMAGE_NUMBERS.headshotFontSize, delta > 0 ? GOLD_COLOR : GOLD_LOST_COLOR);
    const view = new Container();
    const icon = coin();
    // The number, then the coin on its right ("+5 ●"), centred together.
    const gap = 3;
    const width = text.width + gap + COIN_RADIUS * 2;
    text.anchor.set(0, 1);
    text.x = -width / 2;
    icon.x = width / 2 - COIN_RADIUS;
    view.addChild(text, icon);
    this.spawn(view, at);
  }

  private label(text: string, fontSize: number, fill: number): Text {
    const label = new Text({
      text,
      resolution: 2,
      style: { fontFamily: FONT, fontWeight: '700', fontSize, fill, stroke: { color: OUTLINE, width: 4, join: 'round' } },
    });
    label.anchor.set(0.5, 1);
    return label;
  }

  private topOf(target: Container): { x: number; y: number } {
    const bounds = target.getBounds();
    return this.layer.toLocal({ x: bounds.x + bounds.width / 2, y: bounds.y });
  }

  /** Over `at`, lifted above the popups there it would cover (a killing blow's number and its gold stack up). */
  private spawn(view: Container, at: { x: number; y: number }): void {
    const { width, height } = view.getLocalBounds();
    const others = this.popups.map((other) => {
      const bottom = other.view.y;
      return { x: other.x, width: other.width, top: bottom - other.height, bottom };
    });
    const y = stackedPopupBottom(at.x, at.y - DAMAGE_NUMBERS.aboveHead, width, height, others, DAMAGE_NUMBERS.stackGap);
    const popup = { view, x: at.x, y, width, height, ageMs: 0 };
    this.popups.push(popup);
    this.layer.addChild(view);
    this.place(popup);
  }

  public update(deltaMs: number): void {
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const popup = this.popups[i];
      popup.ageMs += deltaMs;
      if (popup.ageMs >= DAMAGE_NUMBERS.lifeMs) {
        popup.view.destroy({ children: true });
        this.popups.splice(i, 1);
      } else {
        this.place(popup);
      }
    }
  }

  private place(popup: Popup): void {
    const frame = damagePopupFrame(popup.ageMs, DAMAGE_NUMBERS.lifeMs, DAMAGE_NUMBERS.rise);
    popup.view.position.set(popup.x, popup.y - frame.rise);
    popup.view.alpha = frame.alpha;
    popup.view.scale.set(this.mirrored() ? -frame.scale : frame.scale, frame.scale);
  }
}
