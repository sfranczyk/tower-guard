import { Application, Assets, type Texture } from 'pixi.js';
import arrowAsset from './assets/arrow.svg';
import arrowExplosiveAsset from './assets/arrow-explosive.svg';
import arrowPiercingAsset from './assets/arrow-piercing.svg';
import { SoundManager } from './audio/SoundManager';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import type { GameTextures } from './core/Scene';
import { SceneManager } from './core/SceneManager';
import { DomUi } from './ui/DomUi';

const loadTextures = async (): Promise<GameTextures> => {
  const [normal, piercing, explosive] = await Promise.all([
    Assets.load<Texture>(arrowAsset),
    Assets.load<Texture>(arrowPiercingAsset),
    Assets.load<Texture>(arrowExplosiveAsset),
  ]);
  return { arrows: { normal, piercing, explosive } };
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

  const sound = new SoundManager();
  const [textures] = await Promise.all([loadTextures(), sound.load()]);
  const ui = new DomUi(host, app.canvas);
  new SceneManager(app, ui, textures, sound).start();
  void sound.loadMusic();
};

void bootstrap();
