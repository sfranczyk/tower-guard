/** One card of a mode picker: a square picture with the mode's description (`text`) over its foot, and the mode's name. */
export interface ModeCard {
  /** The data attribute that picks it, e.g. `data-pick-mode="battle"`. */
  attribute: string;
  thumbnail: string;
  label: string;
  text: string;
}

/**
 * The mode pickers (the single-player setup's and the online room's): square cards side by side, each picture carrying
 * its mode's description on a dark band along its bottom. `footer` is an optional row of buttons below.
 */
export const modeCards = (cards: readonly ModeCard[], footer = ''): string => `<div class="mode-picker" style="--mode-count: ${cards.length}">
  <div class="mode-cards">
    ${cards.map(({ attribute, thumbnail, label, text }, index) => `<button type="button" class="mode-card" data-mode-index="${index}" ${attribute}>
      <span class="mode-art">${thumbnail}<span class="mode-text">${text}</span></span>
      <strong>${label}</strong>
    </button>`).join('')}
  </div>
  ${footer}
</div>`;
