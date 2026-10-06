import { Application, Assets, type Texture } from 'pixi.js';
import arrowAsset from './assets/arrow.svg';
import arrowExplosiveAsset from './assets/arrow-explosive.svg';
import arrowPiercingAsset from './assets/arrow-piercing.svg';
import arrowShrapnelAsset from './assets/arrow-shrapnel.svg';
import { SoundManager } from './audio/SoundManager';
import { GAME_HEIGHT, GAME_WIDTH, MAX_RENDER_RESOLUTION } from './config';
import { setViewWidth } from './core/viewport';
import type { GameTextures } from './core/Scene';
import { SceneManager } from './core/SceneManager';
import { DomUi } from './ui/DomUi';

const loadTextures = async (): Promise<GameTextures> => {
  const [normal, piercing, explosive, shrapnel] = await Promise.all([
    Assets.load<Texture>(arrowAsset),
    Assets.load<Texture>(arrowPiercingAsset),
    Assets.load<Texture>(arrowExplosiveAsset),
    Assets.load<Texture>(arrowShrapnelAsset),
  ]);
  // Shrapnel fragments are small normal arrows (drawn at a smaller scale).
  return { arrows: { normal, piercing, explosive, shrapnel, fragment: normal } };
};

const bootstrap = async (): Promise<void> => {
  const app = new Application();
  await app.init({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: 0x000000,
    antialias: true,
    // DomUi sizes the canvas with CSS; the resolution follows the shown size (see onCanvasFit below).
    autoDensity: false,
    resolution: Math.max(1, window.devicePixelRatio || 1),
  });

  const host = document.getElementById('game') ?? document.body;
  host.innerHTML = '';
  host.appendChild(app.canvas);

  const sound = new SoundManager();
  const [textures] = await Promise.all([loadTextures(), sound.load()]);
  const ui = new DomUi(host, app.canvas);
  // The view widens with the window (core/viewport.ts), and it's drawn at its on-screen pixel size (CSS
  // scale × devicePixelRatio), so a big window or browser zoom stays sharp.
  ui.onCanvasFit = ({ scale, viewWidth }) => {
    const resolution = Math.min(MAX_RENDER_RESOLUTION, Math.max(1, scale * (window.devicePixelRatio || 1)));
    if (Math.abs(resolution - app.renderer.resolution) > 0.01 || viewWidth !== app.screen.width) {
      app.renderer.resize(viewWidth, GAME_HEIGHT, resolution);
    }
    setViewWidth(viewWidth);
  };
  ui.fitCanvas();
  new SceneManager(app, ui, textures, sound).start();
  void sound.loadMusic();
};

void bootstrap();
