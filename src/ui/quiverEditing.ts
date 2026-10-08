import { LOADOUT_SLOTS, clearSlot, isArrowType, placeArrow, type Loadout } from '../data/loadout';
import { QuiverDrag, type QuiverDragSource, type QuiverDropTarget } from './quiverDrag';

/** A quiver being edited: its arrows and the slot the next picked arrow goes into. */
export interface QuiverEdit {
  loadout: Loadout;
  slot: number;
}

/** What a click or drop did: the new state, and whether the arrows changed (else only the selected slot moved). */
export interface QuiverEditResult extends QuiverEdit {
  changed: boolean;
}

/**
 * A click on the Quiver markup (`quiverPage`): a slot's × empties it, a slot is selected, an arrow card goes into
 * the selected slot (and the selection moves on, so filling the quiver is one click per arrow). Undefined when the
 * click wasn't on the quiver.
 */
export const quiverClick = (target: HTMLElement, { loadout, slot }: QuiverEdit): QuiverEditResult | undefined => {
  const slotClear = target.closest<HTMLElement>('[data-slot-clear]');
  const slotButton = target.closest<HTMLElement>('[data-slot]');
  const arrow = target.closest<HTMLElement>('[data-arrow]');
  if (slotClear) {
    const cleared = Number(slotClear.dataset.slotClear);
    return { loadout: clearSlot(loadout, cleared), slot: cleared, changed: true };
  }
  if (slotButton) {
    return { loadout, slot: Number(slotButton.dataset.slot), changed: false };
  }
  if (arrow && isArrowType(arrow.dataset.arrow)) {
    return { loadout: placeArrow(loadout, slot, arrow.dataset.arrow), slot: (slot + 1) % LOADOUT_SLOTS, changed: true };
  }
  return undefined;
};

/** An arrow card or a slot's arrow dropped on a slot (placed there, swapping), or a slot's back on the list (emptied). */
export const quiverDrop = (source: QuiverDragSource, target: QuiverDropTarget, { loadout }: QuiverEdit): QuiverEditResult | undefined => {
  const type = 'arrow' in source ? source.arrow : loadout[source.slot];
  if (target === 'arrows') {
    return 'slot' in source ? { loadout: clearSlot(loadout, source.slot), slot: source.slot, changed: true } : undefined;
  }
  return type ? { loadout: placeArrow(loadout, target.slot, type), slot: target.slot, changed: true } : undefined;
};

/**
 * Wires quiver editing (clicks and drag and drop) on `root`: `current` gives the quiver as it is now (undefined
 * while none is shown), and `apply` gets every edit.
 */
export const editQuiverIn = (root: HTMLElement, current: () => QuiverEdit | undefined, apply: (result: QuiverEditResult) => void): void => {
  root.addEventListener('click', (event) => {
    const state = current();
    const result = state && quiverClick(event.target as HTMLElement, state);
    if (result) {
      apply(result);
    }
  });
  new QuiverDrag(root, (source, target) => {
    const state = current();
    const result = state && quiverDrop(source, target, state);
    if (result) {
      apply(result);
    }
  });
};
