import { Container, type Application } from 'pixi.js';
import type { SoundManager } from '../audio/SoundManager';
import type { DomUi } from '../ui/DomUi';
import { AnimationLabScene } from '../scenes/AnimationLabScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import { SandboxScene } from '../scenes/SandboxScene';
import { ENEMY_KEEP_HEALTH } from '../config';
import { loadSandbox } from './sandboxStorage';
import type { GameContext, GameTextures, Scene, SceneName } from './Scene';
import { LAB_PARAM, getUrlParam, setUrlParam } from './urlState';

/** Owns the active scene, switches between scenes and forwards ticker updates. */
export class SceneManager {
  private readonly ctx: GameContext;
  private current?: Scene;

  public constructor(app: Application, ui: DomUi, textures: GameTextures, sound: SoundManager) {
    const sandbox = loadSandbox();
    const root = new Container();
    root.sortableChildren = true;
    app.stage.addChild(root);

    this.ctx = {
      app,
      root,
      ui,
      textures,
      sound,
      session: {
        sandbox,
        run: { waveIndex: 0, bowmanHealth: sandbox.bowmanHealth, keepHealth: sandbox.keepHealth, enemyKeepHealth: ENEMY_KEEP_HEALTH },
        showTrajectory: true,
      },
      goTo: (scene) => this.goTo(scene),
    };

    ui.handlers.start = () => this.goTo('sandbox');
    ui.handlers.openGame = () => this.goTo('sandbox');
    ui.handlers.openAnimationLab = () => this.goTo('animationLab');

    app.ticker.add((ticker) => this.current?.update(ticker.deltaMS));
  }

  /** Opens the animation lab when the URL says so (e.g. after a refresh), otherwise the menu. */
  public start(): void {
    this.goTo(getUrlParam(LAB_PARAM) !== null ? 'animationLab' : 'menu');
  }

  public goTo(name: SceneName): void {
    if (name !== 'animationLab') {
      setUrlParam(LAB_PARAM, null);
    } else if (getUrlParam(LAB_PARAM) === null) {
      setUrlParam(LAB_PARAM, '');
    }
    this.current?.exit();
    this.ctx.root.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.current = this.createScene(name);
    this.current.enter();
  }

  private createScene(name: SceneName): Scene {
    switch (name) {
      case 'menu':
        return new MenuScene(this.ctx);
      case 'sandbox':
        return new SandboxScene(this.ctx);
      case 'animationLab':
        return new AnimationLabScene(this.ctx);
      case 'game':
        return new GameScene(this.ctx);
    }
  }
}
