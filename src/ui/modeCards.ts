/** One card of a mode picker: a square picture, the mode's name and its description (`text`) under it. */
export interface ModeCard {
  /** The data attribute that picks it, e.g. `data-pick-mode="battle"`. */
  attribute: string;
  thumbnail: string;
  label: string;
  text: string;
}

/**
 * The mode pickers (the single-player setup's and the online room's): cards side by side, each a square picture, the
 * mode's name and its description under it. `footer` is an optional row of buttons below.
 */
export const modeCards = (cards: readonly ModeCard[], footer = ''): string => `<div class="mode-picker" style="--mode-count: ${cards.length}">
  <div class="mode-cards">
    ${cards.map(({ attribute, thumbnail, label, text }, index) => `<button type="button" class="mode-card" data-mode-index="${index}" ${attribute}>
      ${thumbnail}
      <strong>${label}</strong>
      <span class="mode-text">${text}</span>
    </button>`).join('')}
  </div>
  ${footer}
</div>`;
