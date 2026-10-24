import { Container } from 'pixi.js';
import { BACKDROP_WIDTH, GAME_HEIGHT } from '../config';
import { Scene } from '../core/Scene';
import { centeredCameraX } from '../core/viewport';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import Bowman from '../objects/bowman/Bowman';
import Tower from '../objects/Tower';
import { Background } from '../rendering/Background';
import { groundAt } from '../systems/terrain';
import { MenuRange } from './menuRange';

/** The menu shows the middle of the battlefield (centred in the view), with both keeps pulled into view. */
const MENU_KEEPS = { player: 190, enemy: 1010 } as const;
const MENU_BOWMAN_X = 285;
const MENU_SUN = { x: 975, y: 95 };
/** Practice targets the bowman shoots at. */
const MENU_TARGETS = [640, 935];

/** Main menu over a live battlefield (drifting clouds, the enemy keep in ruins, the bowman practising at targets). */
export class MenuScene extends Scene {
  private background?: Background;
  private world?: Container;
  private keeps: Tower[] = [];
  private bowman?: Bowman;
  private range?: MenuRange;
  private optionsVisible = false;

  public enter(): void {
    const { ui } = this.ctx;
    // Back from a MOBA match or lobby: "Start game" and "Co-op online" are the normal battle again.
    this.ctx.session.moba = false;
    this.ctx.session.teams = undefined;
    // The sun moves out from behind the logo, over the enemy keep.
    const meadow = BATTLEGROUNDS.greenMeadow;
    const battleground = { ...meadow, sun: meadow.sun && { ...meadow.sun, ...MENU_SUN } };
    ui.showScreen('menu');
    ui.setTheme(battleground.ui);
    this.createScenery(battleground);

    ui.handlers.toggleOptions = () => this.setOptionsVisible(!this.optionsVisible);
    this.onExit(() => {
      ui.handlers.toggleOptions = undefined;
    });

    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape' && this.optionsVisible) {
        this.setOptionsVisible(false);
      } else if (!this.optionsVisible && (event.code === 'Digit1' || event.code === 'Space')) {
        this.ctx.goTo('sandbox');
      }
    });
  }

  public update(deltaMs: number): void {
    if (this.world) {
      this.world.x = -centeredCameraX();
    }
    this.background?.update(deltaMs);
    this.keeps.forEach((keep) => keep.update(deltaMs));
    this.range?.update(deltaMs);
  }

  private createScenery(battleground: (typeof BATTLEGROUNDS)[keyof typeof BATTLEGROUNDS]): void {
    const world = new Container();
    world.sortableChildren = true;
    this.world = world;
    this.ctx.root.addChild(world);
    this.background = new Background(world, battleground, BACKDROP_WIDTH);
    const hillColor = battleground.hills[0];
    this.keeps = [
      new Tower(MENU_KEEPS.player, groundAt(MENU_KEEPS.player), { hillColor, enemy: false, showHealth: false }),
      new Tower(MENU_KEEPS.enemy, groundAt(MENU_KEEPS.enemy), { hillColor, enemy: true, showHealth: false, abandoned: true }, 100, 0),
    ];
    this.bowman = new Bowman(MENU_BOWMAN_X, groundAt(MENU_BOWMAN_X), { x: 0, y: 0, width: BACKDROP_WIDTH, height: GAME_HEIGHT }, {
      armorColors: battleground.player,
      showHealth: false,
    });
    world.addChild(...this.keeps, this.bowman);
    this.range = new MenuRange(world, this.bowman, this.ctx.textures, MENU_TARGETS);
  }

  private setOptionsVisible(visible: boolean): void {
    this.optionsVisible = visible;
    this.ctx.ui.setOptionsVisible(visible);
  }
}
