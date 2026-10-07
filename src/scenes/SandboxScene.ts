import { Container } from 'pixi.js';
import { BACKDROP_WIDTH, ENEMY_KEEP_HEALTH } from '../config';
import { Scene, newRun } from '../core/Scene';
import { centeredCameraX } from '../core/viewport';
import { saveSandbox } from '../core/sandboxStorage';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { normalizeSandbox, type SandboxSettings } from '../data/sandbox';
import { Background } from '../rendering/Background';

/**
 * Sandbox setup: number of waves, enemies and battleground per wave, bowman and keep health.
 * The form is HTML (DomUi); the canvas behind it previews the first wave's battleground.
 */
export class SandboxScene extends Scene {
  private preview?: Container;
  private previewId?: string;

  public update(): void {
    if (this.preview) {
      this.preview.x = -centeredCameraX();
    }
  }

  public enter(): void {
    const { ui, session } = this.ctx;
    ui.showScreen('sandbox');
    ui.renderSandbox(session.sandbox);
    this.showPreview(session.sandbox);

    ui.handlers.sandboxChange = (settings) => this.applySettings(settings);
    ui.handlers.sandboxStart = () => this.startRun();
    // Co-op host: back to the lobby (the partner stays connected).
    ui.handlers.sandboxBack = () => this.ctx.goTo(this.ctx.session.net ? 'coop' : 'menu');
    this.onExit(() => {
      ui.handlers.sandboxChange = undefined;
      ui.handlers.sandboxStart = undefined;
      ui.handlers.sandboxBack = undefined;
    });

    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        this.ctx.goTo('menu');
      }
    });
  }

  private applySettings(settings: SandboxSettings): void {
    const normalized = normalizeSandbox(settings);
    const waveCountChanged = normalized.waveCount !== this.ctx.session.sandbox.waveCount;
    this.ctx.session.sandbox = normalized;
    saveSandbox(normalized);
    if (waveCountChanged) {
      // Show or hide wave rows.
      this.ctx.ui.renderSandbox(normalized);
    }
    this.showPreview(normalized);
  }

  /** Draws the first wave's battleground behind the form. */
  private showPreview(settings: SandboxSettings): void {
    const id = settings.waves[0].battleground;
    if (id === this.previewId) {
      return;
    }
    this.ctx.ui.setTheme(BATTLEGROUNDS[id].ui);
    this.preview?.destroy({ children: true });
    this.preview = new Container();
    this.preview.sortableChildren = true;
    new Background(this.preview, BATTLEGROUNDS[id], BACKDROP_WIDTH);
    this.ctx.root.addChild(this.preview);
    this.previewId = id;
  }

  private startRun(): void {
    const { session } = this.ctx;
    session.run = newRun(session.sandbox, session.playerCount, ENEMY_KEEP_HEALTH);
    this.ctx.goTo('game');
  }
}
