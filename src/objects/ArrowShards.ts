import { Rectangle, Sprite, Texture, type Container } from 'pixi.js';
import { ARROW_SHARDS } from '../config';
import { breakArrow, shardAlpha, stepShard, type ArrowShard } from '../systems/arrowShards';
import { groundAt } from '../systems/terrain';
import type { Vec2 } from '../types';
import type Arrow from './Arrow';

/** Pixels above the ground line where a shard comes to rest (as arrows stick into the ground). */
const REST_ABOVE_GROUND = 2;

/** The pieces of arrows broken by a blast: each half drawn from its part of the arrow's own texture. */
export class ArrowShards {
  private pieces: { shard: ArrowShard; sprite: Sprite }[] = [];

  public constructor(private readonly world: Container) {}

  /** Snaps `arrow` (which the caller then puts away) in two, the halves flying off from `blast`. */
  public break(arrow: Arrow, blast: Vec2): void {
    const { texture } = arrow;
    const length = texture.width * Math.abs(arrow.scale.x);
    const shards = breakArrow({ position: { x: arrow.x, y: arrow.y }, rotation: arrow.rotation, length }, blast, ARROW_SHARDS);
    shards.forEach((shard) => {
      const { frame } = texture;
      const part = new Texture({
        source: texture.source,
        frame: new Rectangle(frame.x + frame.width * shard.from, frame.y, frame.width * (shard.to - shard.from), frame.height),
      });
      const sprite = new Sprite(part);
      sprite.anchor.set(0.5);
      sprite.scale.copyFrom(arrow.scale);
      sprite.tint = arrow.tint;
      sprite.zIndex = arrow.zIndex;
      this.place(sprite, shard);
      this.world.addChild(sprite);
      this.pieces.push({ shard, sprite });
    });
  }

  public update(deltaMs: number): void {
    this.pieces = this.pieces.filter(({ shard, sprite }) => {
      stepShard(shard, deltaMs, ARROW_SHARDS, (x) => groundAt(x) - REST_ABOVE_GROUND);
      const alpha = shardAlpha(shard, ARROW_SHARDS);
      if (alpha <= 0) {
        sprite.destroy({ texture: true });
        return false;
      }
      this.place(sprite, shard);
      sprite.alpha = alpha;
      return true;
    });
  }

  private place(sprite: Sprite, shard: ArrowShard): void {
    sprite.position.set(shard.position.x, shard.position.y);
    sprite.rotation = shard.rotation;
  }
}
