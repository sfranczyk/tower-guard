import { describe, expect, it } from 'vitest';
import { createCloudShape, layoutClouds, mixColor, type CloudKind } from './clouds';

const KINDS: CloudKind[] = ['cumulus', 'stratus', 'cirrus', 'puff'];

describe('cloud shapes', () => {
  it('stay within their width and above their base', () => {
    KINDS.forEach((kind) => {
      [1, 2, 3].forEach((seed) => {
        const shape = createCloudShape(kind, 200, seed);
        expect(shape.blobs.length).toBeGreaterThan(2);
        shape.blobs.forEach((blob) => {
          expect(Math.abs(blob.x) + blob.rx, `${kind} ${blob.layer} width`).toBeLessThanOrEqual(shape.width * 0.62);
          expect(blob.y - blob.ry, `${kind} ${blob.layer} top`).toBeGreaterThanOrEqual(-shape.height * 1.3);
          expect(blob.y + blob.ry, `${kind} ${blob.layer} base`).toBeLessThanOrEqual(shape.height * 0.3 + 1);
        });
      });
    });
  });

  it('are deterministic per seed and differ between seeds', () => {
    expect(createCloudShape('cumulus', 180, 7)).toEqual(createCloudShape('cumulus', 180, 7));
    expect(createCloudShape('cumulus', 180, 7)).not.toEqual(createCloudShape('cumulus', 180, 8));
  });
});

describe('layoutClouds', () => {
  const clouds = layoutClouds(1200, 42);

  it('uses every kind and spreads clouds over the whole sky', () => {
    expect(new Set(clouds.map((cloud) => cloud.shape.kind))).toEqual(new Set(KINDS));
    const xs = clouds.map((cloud) => cloud.x).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(200);
    expect(xs[xs.length - 1]).toBeGreaterThan(1000);
  });

  it('puts high clouds above low ones and drifts them slower', () => {
    const average = (kind: CloudKind, key: 'y' | 'speed'): number => {
      const ofKind = clouds.filter((cloud) => cloud.shape.kind === kind);
      return ofKind.reduce((sum, cloud) => sum + cloud[key], 0) / ofKind.length;
    };
    expect(average('cirrus', 'y')).toBeLessThan(average('cumulus', 'y'));
    expect(average('cirrus', 'speed')).toBeLessThan(average('cumulus', 'speed'));
  });

  it('is the same sky for the same seed', () => {
    expect(layoutClouds(1200, 42)).toEqual(clouds);
  });
});

describe('mixColor', () => {
  it('blends per channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x102030, 0x102030, 0.3)).toBe(0x102030);
    expect(mixColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });
});
