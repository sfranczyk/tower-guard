import { Container, type Application } from 'pixi.js';
import type { DomUi } from '../ui/DomUi';
import { AnimationLabScene } from '../scenes/AnimationLabScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import type { GameContext, GameTextures, Scene, SceneName } from './Scene';

/** Owns the active scene, switches between scenes and forwards ticker updates. */
export class SceneManager {
  private readonly ctx: GameContext;
  private current?: Scene;

  public constructor(app: Application, ui: DomUi, textures: GameTextures) {
    const root = new Container();
    root.sortableChildren = true;
    app.stage.addChild(root);

    this.ctx = {
      app,
      root,
      ui,
      textures,
      session: { levelNumber: 1, gold: 0, bowTension: 1, showTrajectory: true },
      goTo: (scene) => this.goTo(scene),
    };

    ui.handlers.start = () => this.goTo('game');
    ui.handlers.openGame = () => this.goTo('game');
    ui.handlers.openAnimationLab = () => this.goTo('animationLab');

    app.ticker.add((ticker) => this.current?.update(ticker.deltaMS));
  }

  public goTo(name: SceneName): void {
    this.current?.exit();
    this.ctx.root.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.current = this.createScene(name);
    this.current.enter();
  }

  private createScene(name: SceneName): Scene {
    switch (name) {
      case 'menu':
        return new MenuScene(this.ctx);
      case 'animationLab':
        return new AnimationLabScene(this.ctx);
      case 'game':
        return new GameScene(this.ctx);
    }
  }
}
