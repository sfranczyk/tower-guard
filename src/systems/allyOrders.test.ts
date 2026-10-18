import { describe, expect, it } from 'vitest';
import { ALLIES, ENEMY_TOWER_X } from '../config';
import { escortPost, nextOrder, orderPost, pickFoe } from './allyOrders';

describe('orderPost', () => {
  it('holds the line, falls back to the keep or advances to the enemy keep, rank by rank', () => {
    expect(orderPost('hold')).toBe(ALLIES.holdX);
    expect(orderPost('hold', 2)).toBe(ALLIES.holdX - 2 * ALLIES.spacing);
    expect(orderPost('retreat')).toBe(ALLIES.retreatX);
    expect(orderPost('advance')).toBeLessThan(ENEMY_TOWER_X);
    expect(orderPost('advance')).toBeGreaterThan(ALLIES.holdX);
  });
});

describe('nextOrder', () => {
  it('cycles hold → advance → retreat → hold', () => {
    expect(nextOrder('hold')).toBe('advance');
    expect(nextOrder('advance')).toBe('retreat');
    expect(nextOrder('retreat')).toBe('hold');
  });
});

describe('pickFoe', () => {
  const post = ALLIES.holdX;

  it('holding the line, fights the nearest enemy near the post and lets the others come', () => {
    const near = post + ALLIES.engageRange - 10;
    expect(pickFoe(post, post, 'hold', [post + ALLIES.engageRange + 200, near], 40)).toBe(1);
    expect(pickFoe(post, post, 'hold', [post + ALLIES.engageRange + 50], 40)).toBeUndefined();
  });

  it('advancing, goes for any enemy ahead', () => {
    expect(pickFoe(500, post, 'advance', [1500, 900], 40)).toBe(1);
    expect(pickFoe(500, post, 'advance', [300], 40)).toBeUndefined();
  });

  it('falling back, fights only what reaches him', () => {
    expect(pickFoe(230, ALLIES.retreatX, 'retreat', [400], 40)).toBeUndefined();
    expect(pickFoe(230, ALLIES.retreatX, 'retreat', [400, 260], 40)).toBe(1);
  });
});

describe('escortPost', () => {
  it('puts the escort between the bearer and the enemy, rank by rank', () => {
    expect(escortPost(500)).toBe(500 + ALLIES.spacing);
    expect(escortPost(500, 2)).toBe(500 + 3 * ALLIES.spacing);
  });
});
