import { Container, type Application } from 'pixi.js';
import type { SoundManager } from '../audio/SoundManager';
import type { DomUi } from '../ui/DomUi';
import { AnimationLabScene } from '../scenes/AnimationLabScene';
import { CoopScene } from '../scenes/CoopScene';
import { DesignLabScene } from '../scenes/DesignLabScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import { SandboxScene } from '../scenes/SandboxScene';
import { SoundLabScene } from '../scenes/SoundLabScene';
import { DEFAULT_ARROW_TRAILS, MAX_ARROW_TRAILS } from '../config';
import { loadSandbox } from './sandboxStorage';
import { newRun, type GameContext, type GameTextures, type Scene, type SceneName } from './Scene';
import { COOP_PARAM, DESIGN_LAB_PARAM, LAB_PARAM, MOBA_PARAM, SOUND_LAB_PARAM, TUNE_PARAM, getDevUrlParam, setUrlParam } from './urlState';

/** Owns the active scene, switches between scenes and forwards ticker updates. */
export class SceneManager {
  private readonly ctx: GameContext;
  private current?: Scene;

  public constructor(app: Application, ui: DomUi, textures: GameTextures, sound: SoundManager) {
    const sandbox = loadSandbox();
    // A local co-op test: ?coop gives two bowmen, ?coop=3 or ?coop=4 more (the others driven from the console).
    const coop = getDevUrlParam(COOP_PARAM);
    const playerCount = coop === null ? 1 : Math.max(2, Math.min(4, Number(coop) || 2));
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
        run: newRun(sandbox, playerCount),
        playerCount,
        moba: getDevUrlParam(MOBA_PARAM) !== null,
        showTrajectory: false,
        showCursorCircle: false,
        showDamageNumbers: true,
        bannerMarkers: true,
        arrowTrails: DEFAULT_ARROW_TRAILS,
      },
      goTo: (scene) => this.goTo(scene),
    };

    ui.handlers.start = () => this.goTo('sandbox');
    ui.handlers.labMenu = () => this.goTo('menu');
    ui.handlers.openCoop = () => this.goTo('coop');
    ui.handlers.openAnimationLab = () => this.goTo('animationLab');
    ui.handlers.openSoundLab = () => this.goTo('soundLab');
    ui.handlers.openDesignLab = () => this.goTo('designLab');
    ui.handlers.toggleTuning = () => {
      ui.setTuningOpen(!ui.isTuningOpen);
      setUrlParam(TUNE_PARAM, ui.isTuningOpen ? '' : null);
    };
    // The settings drawer works wherever it's opened (menu or game).
    ui.handlers.trajectoryChange = (enabled) => {
      this.ctx.session.showTrajectory = enabled;
    };
    ui.handlers.cursorCircleChange = (enabled) => {
      this.ctx.session.showCursorCircle = enabled;
    };
    ui.handlers.bannerMarkersChange = (enabled) => {
      this.ctx.session.bannerMarkers = enabled;
    };
    ui.handlers.damageNumbersChange = (enabled) => {
      this.ctx.session.showDamageNumbers = enabled;
    };
    ui.handlers.arrowTrailsChange = (count) => {
      this.ctx.session.arrowTrails = Math.max(0, Math.min(MAX_ARROW_TRAILS, Math.round(count)));
      ui.settings.setArrowTrailsOption(this.ctx.session.arrowTrails);
    };
    ui.handlers.audioChange = (changes) => sound.updateSettings(changes);
    ui.settings.setTrajectoryOption(this.ctx.session.showTrajectory);
    ui.settings.setCursorCircleOption(this.ctx.session.showCursorCircle);
    ui.settings.setDamageNumbersOption(this.ctx.session.showDamageNumbers);
    ui.settings.setBannerMarkersOption(this.ctx.session.bannerMarkers);
    ui.settings.setArrowTrailsOption(this.ctx.session.arrowTrails);
    ui.settings.setAudioOptions(sound.settings);

    app.ticker.add((ticker) => this.current?.update(ticker.deltaMS));
  }

  /** Opens the animation lab, design lab or sound panel when the URL says so (e.g. after a refresh), otherwise the menu. */
  public start(): void {
    this.ctx.ui.setTuningOpen(getDevUrlParam(TUNE_PARAM) !== null);
    if (getDevUrlParam(LAB_PARAM) !== null) {
      this.goTo('animationLab');
    } else if (getDevUrlParam(DESIGN_LAB_PARAM) !== null) {
      this.goTo('designLab');
    } else if (this.ctx.session.moba) {
      // Straight into a MOBA battle on the setup's first map (dev: the mode has no menu entry yet).
      this.goTo('game');
    } else {
      this.goTo(getDevUrlParam(SOUND_LAB_PARAM) !== null ? 'soundLab' : 'menu');
    }
  }

  public goTo(name: SceneName): void {
    if (name !== 'animationLab') {
      setUrlParam(LAB_PARAM, null);
    } else if (getDevUrlParam(LAB_PARAM) === null) {
      setUrlParam(LAB_PARAM, '');
    }
    setUrlParam(SOUND_LAB_PARAM, name === 'soundLab' ? '' : null);
    if (name !== 'designLab') {
      setUrlParam(DESIGN_LAB_PARAM, null);
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
      case 'coop':
        return new CoopScene(this.ctx);
      case 'sandbox':
        return new SandboxScene(this.ctx);
      case 'animationLab':
        return new AnimationLabScene(this.ctx);
      case 'soundLab':
        return new SoundLabScene(this.ctx);
      case 'designLab':
        return new DesignLabScene(this.ctx);
      case 'game':
        return new GameScene(this.ctx);
    }
  }
}
