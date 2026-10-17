import { Texture, type Graphics } from 'pixi.js';
import arrowAsset from '../../assets/arrow.svg';
import arrowExplosiveAsset from '../../assets/arrow-explosive.svg';
import arrowPiercingAsset from '../../assets/arrow-piercing.svg';
import arrowShrapnelAsset from '../../assets/arrow-shrapnel.svg';
import arrowPinningAsset from '../../assets/arrow-pinning.svg';
import arrowFireAsset from '../../assets/arrow-fire.svg';
import arrowFrostAsset from '../../assets/arrow-frost.svg';
import arrowVortexAsset from '../../assets/arrow-vortex.svg';
import { ARROW_KINDS, ARROW_LOOKS, ARROW_STYLES, arrowSvg, type ArrowLook } from './arrowDesigns';
import { standBody } from './bodyPoses';
import { raiderLook } from './enemySkins';
import { drawHumanoid } from './skinKit';
import { DESIGN_GROUND_Y } from './designSkeleton';
import type { DesignEntry, DesignView } from './catalog';

const CURRENT: Record<ArrowLook, string> = {
  normal: arrowAsset, piercing: arrowPiercingAsset, explosive: arrowExplosiveAsset, shrapnel: arrowShrapnelAsset,
  pinning: arrowPinningAsset, fire: arrowFireAsset, frost: arrowFrostAsset, vortex: arrowVortexAsset,
};

/** The game draws arrow images at half size (Arrow.scale). */
const GAME_SCALE = 0.5;
/** The close-up above the scene. */
const CLOSE_UP_SCALE = 1.5;
/** Images are rasterised this many times over, sharp in the close-up. */
const RASTER = 8;

const textures = new Map<string, Texture | null>();

/** The image at `src` (a URL or SVG markup) as a texture, or undefined while it loads. */
const svgTexture = (src: string): Texture | undefined => {
  const cached = textures.get(src);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  textures.set(src, null);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth * RASTER;
    canvas.height = image.naturalHeight * RASTER;
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    textures.set(src, Texture.from(canvas));
  };
  image.src = src.startsWith('<svg') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}` : src;
  return undefined;
};

/** Draws the texture centred on (x, y), turned by `angle`, `scale` × its SVG size. */
const drawArrow = (g: Graphics, texture: Texture, x: number, y: number, angle: number, scale: number): void => {
  const width = (texture.width / RASTER) * scale;
  const height = (texture.height / RASTER) * scale;
  g.context.save();
  g.context.translate(x, y);
  g.context.rotate(angle);
  g.texture(texture, 0xffffff, -width / 2, -height / 2, width, height);
  g.context.restore();
};

/**
 * A close-up on top; below, at the game's size, one in flight, one stuck in the ground and a raider for scale.
 */
const arrowView = (label: string, src: string): DesignView => ({
  label,
  draw: (g, timeMs) => {
    g.clear();
    g.context.save();
    g.context.translate(58, 0);
    drawHumanoid(g, standBody('overhead'), raiderLook(timeMs));
    g.context.restore();
    const texture = svgTexture(src);
    if (!texture) {
      return;
    }
    drawArrow(g, texture, -16, -66, 0, CLOSE_UP_SCALE);
    drawArrow(g, texture, -38, -18, -0.12, GAME_SCALE);
    // Stuck tip first, a few units deep.
    const length = (texture.width / RASTER) * GAME_SCALE;
    const angle = 0.6;
    const depth = 3;
    drawArrow(g, texture, 6 - Math.cos(angle) * (length / 2 - depth), DESIGN_GROUND_Y - Math.sin(angle) * (length / 2 - depth), angle, GAME_SCALE);
  },
});

/** All six close up, one under another (the card's tile). */
const lineupView = (sources: string[]): DesignView => ({
  label: 'Now, then 1–5',
  draw: (g) => {
    g.clear();
    sources.forEach((src, index) => {
      const texture = svgTexture(src);
      if (texture) {
        drawArrow(g, texture, 0, -80 + index * 24, 0, CLOSE_UP_SCALE);
      }
    });
  },
});

/** Tab Arrows: one card per arrow, today's look first, then the five styles (ARROW_STYLES). */
export const ARROW_ENTRIES: DesignEntry[] = ARROW_LOOKS.map((look) => {
  const sources = [CURRENT[look], ...ARROW_STYLES.map((style) => arrowSvg(look, style))];
  return {
    id: `arrow-${look}`,
    name: ARROW_KINDS[look].name,
    tagline: 'Today\'s arrow and five smaller ones',
    description: `Now: today's image (src/assets). Then the same arrow in five styles, every head smaller: ${ARROW_STYLES
      .map((style, index) => `${index + 1}. ${style.name} (length ${style.length} vs ~64, head ×${style.head})`).join(', ')}. `
      + 'On top a close-up, below at the game\'s size: in flight, stuck in the ground, and a raider for scale.',
    views: [
      lineupView(sources),
      ...sources.map((src, index) => arrowView(index === 0 ? 'Now' : `${index}. ${ARROW_STYLES[index - 1].name}`, src)),
    ],
  };
});
