import { Scene } from '../core/Scene';

export class MenuScene extends Scene {
  public enter(): void {
    this.ctx.session.levelNumber = 1;
    this.ctx.session.gold = 0;
    this.ctx.ui.showScreen('menu');

    this.listenWindow('keydown', (event) => {
      if (event.code === 'Digit1' || event.code === 'Space') {
        this.ctx.goTo('game');
      }
    });
  }
}
