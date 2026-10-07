import { Container, type Application } from 'pixi.js';
import type { SoundManager } from '../audio/SoundManager';
import type { DomUi } from '../ui/DomUi';
import { AnimationLabScene } from '../scenes/AnimationLabScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import { SandboxScene } from '../scenes/SandboxScene';
import { SoundLabScene } from '../scenes/SoundLabScene';
import { DEFAULT_ARROW_TRAILS, ENEMY_KEEP_HEALTH, MAX_ARROW_TRAILS } from '../config';
import { loadSandbox } from './sandboxStorage';
import { newRun, type GameContext, type GameTextures, type Scene, type SceneName } from './Scene';
import { COOP_PARAM, LAB_PARAM, SOUND_LAB_PARAM, getUrlParam, setUrlParam } from './urlState';

/** Owns the active scene, switches between scenes and forwards ticker updates. */
export class SceneManager {
  private readonly ctx: GameContext;
  private current?: Scene;

  public constructor(app: Application, ui: DomUi, textures: GameTextures, sound: SoundManager) {
    const sandbox = loadSandbox();
    // Co-op (two bowmen) for now with ?coop in the URL; the online lobby will set it later.
    const playerCount = getUrlParam(COOP_PARAM) !== null ? 2 : 1;
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
        run: newRun(sandbox, playerCount, ENEMY_KEEP_HEALTH),
        playerCount,
        showTrajectory: false,
        arrowTrails: DEFAULT_ARROW_TRAILS,
      },
      goTo: (scene) => this.goTo(scene),
    };

    ui.handlers.start = () => this.goTo('sandbox');
    ui.handlers.openGame = () => this.goTo('sandbox');
    ui.handlers.openAnimationLab = () => this.goTo('animationLab');
    ui.handlers.openSoundLab = () => this.goTo('soundLab');
    // The settings drawer works wherever it's opened (menu or game).
    ui.handlers.trajectoryChange = (enabled) => {
      this.ctx.session.showTrajectory = enabled;
    };
    ui.handlers.arrowTrailsChange = (count) => {
      this.ctx.session.arrowTrails = Math.max(0, Math.min(MAX_ARROW_TRAILS, Math.round(count)));
      ui.setArrowTrailsOption(this.ctx.session.arrowTrails);
    };
    ui.handlers.audioChange = (changes) => sound.updateSettings(changes);
    ui.setTrajectoryOption(this.ctx.session.showTrajectory);
    ui.setArrowTrailsOption(this.ctx.session.arrowTrails);
    ui.setAudioOptions(sound.settings);

    app.ticker.add((ticker) => this.current?.update(ticker.deltaMS));
  }

  /** Opens the animation lab or sound panel when the URL says so (e.g. after a refresh), otherwise the menu. */
  public start(): void {
    if (getUrlParam(LAB_PARAM) !== null) {
      this.goTo('animationLab');
    } else {
      this.goTo(getUrlParam(SOUND_LAB_PARAM) !== null ? 'soundLab' : 'menu');
    }
  }

  public goTo(name: SceneName): void {
    if (name !== 'animationLab') {
      setUrlParam(LAB_PARAM, null);
    } else if (getUrlParam(LAB_PARAM) === null) {
      setUrlParam(LAB_PARAM, '');
    }
    setUrlParam(SOUND_LAB_PARAM, name === 'soundLab' ? '' : null);
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
      case 'soundLab':
        return new SoundLabScene(this.ctx);
      case 'game':
        return new GameScene(this.ctx);
    }
  }
}
