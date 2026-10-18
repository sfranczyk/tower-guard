import { Graphics, type Container } from 'pixi.js';
import { BANNERS } from '../config';
import { ENEMY_KINDS, isAllyType } from '../data/enemyKinds';
import type Enemy from '../objects/enemy/Enemy';
import { BANNER_POLE, bannerColors, drawBanner } from '../rendering/banner';
import { BANNER_SIDES, Banners, canCarryBanner, type BannerAt, type BannerEvent, type BannerSide } from '../systems/banners';
import { groundAt } from '../systems/terrain';

export interface BattleBannersDeps {
  world: Container;
  /** Every soldier and ground enemy now on the field (alive or not). */
  units(): readonly Enemy[];
  /** The view's left edge and width in the world (edge markers). */
  view(): { left: number; width: number };
  /** Banner markers (settings drawer): the HUD line and the edge markers. */
  markers(): boolean;
  /** A status line for what happened to a banner. */
  status(text: string): void;
}

/** How far in from the view's edge a marker sits, and its size. */
const MARKER_INSET = 14;
const MARKER_SIZE = 9;
/** Where a carried banner's pole stands on its carrier: behind the back, the foot this high above the feet (× size). */
const CARRY_BACK = 7;
const CARRY_FOOT = 16;
/** Above a mounted carrier the pole rises from the saddle. */
const MOUNTED_FOOT = 46;
/** A fallen banner's cloth, squashed flat on the ground. */
const DROPPED_FLAT = 0.35;

const STATUS: Record<BannerEvent<Enemy>['kind'], Record<BannerSide, string>> = {
  taken: { player: 'Our banner is taken! Stop the carrier', enemy: 'The enemy banner is ours! Bring it home' },
  dropped: { player: 'Our banner has fallen · pick it up', enemy: 'The enemy banner has fallen' },
  returned: { player: 'Our banner is back at the keep', enemy: 'The enemy has taken its banner back' },
  captured: { player: 'Our banner is lost', enemy: 'Banner captured!' },
};

/**
 * The run's Banners option in a level (solo only): both banners (systems/banners.ts, stepped each frame from the
 * soldiers and ground enemies), drawn at their keeps, on their carriers or on the ground; a carrier on horseback slows
 * to BANNERS.riderSpeedFactor. With markers on, a carried banner out of view gets a marker at the view's edge.
 */
export class BattleBanners {
  public readonly field: Banners<Enemy>;
  private readonly flags: Record<BannerSide, Graphics>;
  private readonly markers = new Graphics();
  private clockMs = 0;

  public constructor(private readonly deps: BattleBannersDeps) {
    this.field = new Banners<Enemy>({
      team: (unit) => (isAllyType(unit.kind) ? 'player' : 'enemy'),
      canCarry: (unit) => unit.isAlive() && !unit.isDown && !unit.isCelebrating && canCarryBanner(ENEMY_KINDS[unit.kind].archetype),
      alive: (unit) => unit.isAlive(),
    });
    this.flags = { player: new Graphics(), enemy: new Graphics() };
    BANNER_SIDES.forEach((side) => {
      // Level with the keeps and stickmen; on a carrier it takes his.
      this.flags[side].zIndex = 1;
      deps.world.addChild(this.flags[side]);
    });
    this.markers.zIndex = 5;
    deps.world.addChild(this.markers);
  }

  /** The level's result by banner, once one is brought home. */
  public get outcome(): 'won' | 'lost' | undefined {
    return this.field.outcome;
  }

  /** For the HUD. */
  public state(side: BannerSide): BannerAt {
    return this.field.place(side).at;
  }

  public update(deltaMs: number): void {
    this.clockMs += deltaMs;
    this.field.step(this.deps.units()).forEach((event) => {
      if (event.by) {
        event.by.carrySpeed = event.kind === 'taken' && event.by.rider ? BANNERS.riderSpeedFactor : 1;
      }
      this.deps.status(STATUS[event.kind][event.side]);
    });
    BANNER_SIDES.forEach((side) => this.place(side));
    this.drawMarkers();
  }

  private place(side: BannerSide): void {
    const flag = this.flags[side];
    const place = this.field.place(side);
    drawBanner(flag, side, this.clockMs / 1000);
    if (place.at === 'carried') {
      const { by } = place;
      const facing = by.figure.facing;
      flag.position.set(by.x - facing * CARRY_BACK * by.size, by.y - (by.rider ? MOUNTED_FOOT : CARRY_FOOT) * by.size);
      // The cloth streams behind him.
      flag.scale.set(-facing * by.size * 0.9, by.size * 0.9);
      flag.rotation = -facing * 0.12;
      flag.zIndex = by.zIndex;
      return;
    }
    const x = this.field.x(side);
    flag.zIndex = 1;
    if (place.at === 'dropped') {
      // Lying on the ground, the pole towards its keep, the cloth flattened on the grass.
      flag.position.set(x, groundAt(x) - 2);
      flag.scale.set(side === 'player' ? DROPPED_FLAT : -DROPPED_FLAT, 1);
      flag.rotation = side === 'player' ? -Math.PI / 2 : Math.PI / 2;
      return;
    }
    flag.position.set(x, groundAt(x));
    flag.scale.set(side === 'player' ? 1 : -1, 1);
    flag.rotation = 0;
  }

  /** A carried banner out of view: a small flag-coloured arrowhead at that edge of the view. */
  private drawMarkers(): void {
    const g = this.markers;
    g.clear();
    if (!this.deps.markers()) {
      return;
    }
    const { left, width } = this.deps.view();
    BANNER_SIDES.forEach((side) => {
      if (this.field.place(side).at !== 'carried') {
        return;
      }
      const x = this.field.x(side);
      const toRight = x > left + width;
      if (x >= left && !toRight) {
        return;
      }
      const edge = toRight ? left + width - MARKER_INSET : left + MARKER_INSET;
      const y = groundAt(edge) - BANNER_POLE;
      const dir = toRight ? 1 : -1;
      g.poly([edge + dir * MARKER_SIZE, y, edge - dir * MARKER_SIZE * 0.6, y - MARKER_SIZE, edge - dir * MARKER_SIZE * 0.6, y + MARKER_SIZE])
        .fill({ color: bannerColors(side)[0] })
        .stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
    });
  }
}
