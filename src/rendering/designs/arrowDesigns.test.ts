import { describe, expect, it } from 'vitest';
import { ARROW_LOOKS, ARROW_STYLES, arrowSvg } from './arrowDesigns';

describe('arrowSvg', () => {
  it('builds every arrow in every style as a well-formed SVG as long as the style says', () => {
    for (const look of ARROW_LOOKS) {
      for (const style of ARROW_STYLES) {
        const svg = arrowSvg(look, style);
        expect(svg).toMatch(/^<svg [^>]*width="(\d+)"/);
        expect(Number(/width="(\d+(?:\.\d+)?)"/.exec(svg)?.[1])).toBe(style.length + 4);
        expect(svg).not.toContain('NaN');
        expect(svg).not.toContain('undefined');
        expect(svg.endsWith('</svg>')).toBe(true);
      }
    }
  });
});
