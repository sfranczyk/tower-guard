import { MEADOW_TREES } from '../config';

/** Which tree design (design lab, tab Trees) stands in each slot of the Green Meadow's row: pure, the same every time. */

export type MeadowTreeId = keyof typeof MEADOW_TREES;

/** A steady 0..1 per slot (integer hash), negative slots included. */
const slotRoll = (slot: number): number => {
  let h = Math.imul(slot ^ 0x5bd1e995, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

const weightedPick = (slot: number): MeadowTreeId => {
  const entries = Object.entries(MEADOW_TREES) as Array<[MeadowTreeId, number]>;
  let roll = slotRoll(slot) * entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  for (const [id, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll < 0) {
      return id;
    }
  }
  return 'current';
};

/** Picked by the MEADOW_TREES weights; the same variant (other than the current tree) never stands twice in a row. */
export const meadowTreeAt = (slot: number): MeadowTreeId => {
  const id = weightedPick(slot);
  return id !== 'current' && weightedPick(slot - 1) === id ? 'current' : id;
};
