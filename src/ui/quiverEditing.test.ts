import { describe, expect, it } from 'vitest';
import type { Loadout } from '../data/loadout';
import { quiverDrop } from './quiverEditing';

const quiver: Loadout = ['normal', 'fire', null, null, null];

describe('quiverDrop', () => {
  it('puts a dragged arrow card in the slot it lands on', () => {
    expect(quiverDrop({ arrow: 'frost' }, { slot: 2 }, { loadout: quiver, slot: 0 }))
      .toEqual({ loadout: ['normal', 'fire', 'frost', null, null], slot: 2, changed: true });
  });

  it("swaps a slot's arrow with the one it lands on", () => {
    expect(quiverDrop({ slot: 0 }, { slot: 1 }, { loadout: quiver, slot: 0 })?.loadout).toEqual(['fire', 'normal', null, null, null]);
  });

  it('empties a slot dragged back onto the arrows, never the last one', () => {
    expect(quiverDrop({ slot: 1 }, 'arrows', { loadout: quiver, slot: 0 })?.loadout).toEqual(['normal', null, null, null, null]);
    expect(quiverDrop({ slot: 0 }, 'arrows', { loadout: ['normal', null, null, null, null], slot: 0 })?.loadout)
      .toEqual(['normal', null, null, null, null]);
    expect(quiverDrop({ arrow: 'frost' }, 'arrows', { loadout: quiver, slot: 0 })).toBeUndefined();
  });
});
