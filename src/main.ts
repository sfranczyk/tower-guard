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
  const ui = new DomUi(host, app.canvas);
  new SceneManager(app, ui, textures).goTo('menu');
};

void bootstrap();
