/**
 * Dialog cards (setup, co-op lobby, sound lab) share one layout: a fixed top bar (the back button first, the title,
 * then the actions) over a body that scrolls on its own (`.panel-top`, `.panel-body` in index.html).
 */
export const panelTop = (back: string, title: string, actions = '', eyebrow = ''): string => `<div class="panel-top">
    ${back}
    <div class="panel-title">${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h2>${title}</h2></div>
    <div class="panel-actions">${actions}</div>
  </div>`;

/** Replaces a card's markup, keeping its body's scroll position (cards re-render on every change). */
export const renderPanel = (root: HTMLElement, html: string): void => {
  const scroll = root.querySelector('.panel-body')?.scrollTop ?? 0;
  root.innerHTML = html;
  const body = root.querySelector('.panel-body');
  if (body) {
    body.scrollTop = scroll;
  }
};
