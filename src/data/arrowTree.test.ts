import { describe, expect, it } from 'vitest';
import { ARROW_PATHS, ARROW_TREE, arrowLineage, arrowsOnPath } from './arrowTree';
import { ARROW_TYPES } from './loadout';

describe('arrow tree', () => {
  it('grows every arrow out of the normal one, without cycles', () => {
    for (const type of ARROW_TYPES) {
      const lineage = arrowLineage(type);
      expect(lineage[0]).toBe('normal');
      expect(new Set(lineage).size).toBe(lineage.length);
    }
    expect(arrowLineage('vortex')).toEqual(['normal', 'pinning', 'fire', 'frost', 'vortex']);
  });

  it('keeps each path connected: a parent sits on the same path or one before it', () => {
    for (const type of ARROW_TYPES) {
      const { path, parent } = ARROW_TREE[type];
      if (parent) {
        expect(ARROW_PATHS.indexOf(ARROW_TREE[parent].path)).toBeLessThanOrEqual(ARROW_PATHS.indexOf(path));
      }
    }
  });

  it('lists a path parents first and covers every arrow once', () => {
    expect(arrowsOnPath('craftsman', ARROW_TYPES)).toEqual(['pinning', 'shrapnel', 'fire', 'explosive']);
    expect(ARROW_PATHS.flatMap((path) => arrowsOnPath(path, ARROW_TYPES)).sort()).toEqual([...ARROW_TYPES].sort());
  });
});
