import { ARROW_INFO, ARROW_TYPES, arrowCount, type ArrowType, type Loadout } from '../data/loadout';
import { ICON_WEAPONS } from './icons';

/**
 * The battle setup's Quiver page: the five weapon slots (keys 1–5) and the arrows to fill them with.
 * Pick a slot, then an arrow, or drag an arrow (or a slot's arrow) onto a slot (`QuiverDrag`); an arrow already in
 * another slot swaps places with it. Markup only, SandboxForm handles the clicks (`data-slot`, `data-slot-clear`, `data-arrow`).
 */
export const quiverPage = (loadout: Loadout, selectedSlot: number): string => {
  const canClear = arrowCount(loadout) > 1;
  return `<div class="quiver-editor">
    <div class="quiver-row">
      <div class="sandbox-section-label">Quiver · keys 1–${loadout.length}</div>
      <div class="quiver-slots">${loadout.map((type, index) => quiverSlot(type, index, index === selectedSlot, canClear)).join('')}</div>
    </div>
    <div class="arrow-cards">${ARROW_TYPES.map((type) => arrowCard(type, loadout.indexOf(type))).join('')}</div>
  </div>`;
};

const quiverSlot = (type: ArrowType | null, index: number, selected: boolean, canClear: boolean): string => {
  const name = type ? ARROW_INFO[type].name : 'Empty';
  return `<div class="quiver-slot-wrap">
    <button type="button" class="weapon-slot quiver-slot${type ? '' : ' empty'}${selected ? ' selected' : ''}" data-slot="${index}"
      aria-pressed="${selected}" aria-label="Slot ${index + 1}: ${name}" title="${name}">
      <span class="weapon-key">${index + 1}</span>${type ? ICON_WEAPONS[type] : ''}
    </button>
    ${type && canClear ? `<button type="button" class="quiver-clear" data-slot-clear="${index}" aria-label="Empty slot ${index + 1}">×</button>` : ''}
  </div>`;
};

const arrowCard = (type: ArrowType, slot: number): string => {
  const { name, summary } = ARROW_INFO[type];
  return `<button type="button" class="arrow-card${slot >= 0 ? ' packed' : ''}" data-arrow="${type}">
    ${ICON_WEAPONS[type]}
    <span class="arrow-text"><strong>${name}</strong><small>${summary}</small></span>
    ${slot >= 0 ? `<span class="arrow-slot" title="In slot ${slot + 1}">${slot + 1}</span>` : ''}
  </button>`;
};
