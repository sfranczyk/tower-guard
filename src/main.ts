import { Application, Assets, type Texture } from 'pixi.js';
import arrowAsset from './assets/arrow.svg';
import towerAsset from './assets/tower.svg';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import type { GameTextures } from './core/Scene';
import { SceneManager } from './core/SceneManager';
import { DomUi } from './ui/DomUi';

const loadTextures = async (): Promise<GameTextures> => {
  const [tower, arrow] = await Promise.all([
    Assets.load<Texture>(towerAsset),
    Assets.load<Texture>(arrowAsset),
  ]);
  return { tower, arrow };
};

/** Letterboxes the fixed-resolution canvas to fit the window. */
const fitCanvasToWindow = (canvas: HTMLCanvasElement): void => {
  const resize = (): void => {
    const ratio = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
    canvas.style.width = `${Math.max(1, Math.floor(GAME_WIDTH * ratio))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(GAME_HEIGHT * ratio))}px`;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.imageRendering = 'auto';
  };
  resize();
  window.addEventListener('resize', resize);
};

const bootstrap = async (): Promise<void> => {
  const app = new Application();
  await app.init({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: 0x000000,
    antialias: true,
    autoDensity: true,
    resolution: Math.max(1, window.devicePixelRatio || 1),
  });

  const host = document.getElementById('game') ?? document.body;
  host.innerHTML = '';
  host.appendChild(app.canvas);

  const textures = await loadTextures();
  fitCanvasToWindow(app.canvas);
  const ui = new DomUi(host);
  new SceneManager(app, ui, textures).goTo('menu');
};

void bootstrap();
