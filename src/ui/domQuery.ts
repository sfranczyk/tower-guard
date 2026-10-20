/** The element matching `selector` inside `root`; a missing one is a template bug, so it throws. */
export const queryIn = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }
  return element;
};

/** Clicks on the element matching `selector` inside `root` call `handler`. */
export const onClickIn = (root: ParentNode, selector: string, handler: () => void): void => {
  queryIn(root, selector).addEventListener('click', handler);
};
