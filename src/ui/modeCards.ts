/** One card of a mode picker: a square picture and the mode's name; `text` shows under the row while it is hovered. */
export interface ModeCard {
  /** The data attribute that picks it, e.g. `data-pick-mode="battle"`. */
  attribute: string;
  thumbnail: string;
  label: string;
  text: string;
}

/**
 * The mode pickers (the single-player setup's and the online room's): square cards side by side, no text on them. The
 * description of the hovered (or focused) card fills a line under the row; that line's space is always reserved, so the
 * picker never moves (the hints stack in one grid cell; CSS `:has` shows the one for the card under the pointer). `footer`
 * is an optional row of buttons below.
 */
export const modeCards = (cards: readonly ModeCard[], footer = ''): string => `<div class="mode-picker" style="--mode-count: ${cards.length}">
  <div class="mode-cards">
    ${cards.map(({ attribute, thumbnail, label }, index) => `<button type="button" class="mode-card" data-mode-index="${index}" ${attribute}>
      ${thumbnail}
      <strong>${label}</strong>
    </button>`).join('')}
  </div>
  <div class="mode-hints">
    ${cards.map(({ text }, index) => `<p class="mode-hint" data-mode-index="${index}">${text}</p>`).join('')}
  </div>
  ${footer}
</div>`;
