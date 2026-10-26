/**
 * Writes for things the HUD sets every frame: each touches the DOM only when the value changed (a write, even of the
 * same text, replaces nodes and invalidates the page's style and layout). A missing element is skipped.
 */
const shownHtml = new WeakMap<Element, string>();

export const setText = (element: HTMLElement | null | undefined, text: string): void => {
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
};

/** Compared with what was last written here (the browser's own serialisation can differ from it). */
export const setHtml = (element: HTMLElement | null | undefined, html: string): void => {
  if (element && shownHtml.get(element) !== html) {
    shownHtml.set(element, html);
    element.innerHTML = html;
  }
};

/** A 0..1 share as a percentage height (a slot's loading shade, a bar). */
export const setHeightShare = (element: HTMLElement | null | undefined, share: number): void => {
  const height = `${Math.round(share * 100)}%`;
  if (element && element.style.height !== height) {
    element.style.height = height;
  }
};
