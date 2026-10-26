/** One big card of a mode picker: a picture, the mode's name and what it is. */
export interface ModeCard {
  /** The data attribute that picks it, e.g. `data-pick-mode="battle"`. */
  attribute: string;
  thumbnail: string;
  label: string;
  text: string;
}

/**
 * The mode pickers' cards (the single-player setup's and the online room's), side by side in one row; they stretch to the
 * height of the window's frame.
 */
export const modeCards = (cards: readonly ModeCard[]): string => `<div class="mode-cards" style="--mode-count: ${cards.length}">
  ${cards.map(({ attribute, thumbnail, label, text }) => `<button type="button" class="mode-card" ${attribute}>
    ${thumbnail}
    <strong>${label}</strong>
    <span>${text}</span>
  </button>`).join('')}
</div>`;
