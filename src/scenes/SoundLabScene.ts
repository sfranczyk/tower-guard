import { Container } from 'pixi.js';
import { MUSIC_LOOP_END_S } from '../config';
import { MUSIC_INFO, SOUND_INFO } from '../audio/soundCatalog';
import type { SoundId } from '../audio/SoundManager';
import { Scene } from '../core/Scene';
import { centeredCameraX } from '../core/viewport';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { Background } from '../rendering/Background';

/** Time before the loop point that "Hear the loop seam" jumps to. */
const SEAM_LEAD_S = 4;

/**
 * Sound test panel: plays every effect (and each of its variants), the theme with a jump to its loop
 * seam, and adjusts the volumes. The panel is HTML (DomUi); a battleground is drawn behind it.
 */
export class SoundLabScene extends Scene {
  private background?: Container;

  public enter(): void {
    const { ui, sound } = this.ctx;
    ui.showScreen('soundLab');
    ui.setTheme(BATTLEGROUNDS.greenMeadow.ui);
    const background = new Container();
    background.sortableChildren = true;
    new Background(background, BATTLEGROUNDS.greenMeadow);
    this.ctx.root.addChild(background);
    this.background = background;

    const rows = (Object.keys(SOUND_INFO) as SoundId[]).map((id) => ({ id, ...SOUND_INFO[id], durations: sound.variantDurations(id) }));
    ui.renderSoundLab(rows, MUSIC_INFO, sound.settings);

    ui.handlers.soundLabPlay = (id, variant) => sound.preview(id, variant);
    ui.handlers.soundLabToggleMusic = () => sound.updateSettings({ musicEnabled: !sound.musicState.playing });
    ui.handlers.soundLabMusicSeam = () => {
      if (!sound.musicState.playing) {
        sound.updateSettings({ musicEnabled: true });
      }
      sound.seekMusic(MUSIC_LOOP_END_S - SEAM_LEAD_S);
    };
    ui.handlers.soundLabAudioChange = (changes) => sound.updateSettings(changes);
    ui.handlers.soundLabBack = () => this.ctx.goTo('menu');
    this.onExit(() => {
      ui.handlers.soundLabPlay = undefined;
      ui.handlers.soundLabToggleMusic = undefined;
      ui.handlers.soundLabMusicSeam = undefined;
      ui.handlers.soundLabAudioChange = undefined;
      ui.handlers.soundLabBack = undefined;
    });

    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        this.ctx.goTo('menu');
      }
    });
  }

  public update(): void {
    if (this.background) {
      this.background.x = -centeredCameraX();
    }
    this.ctx.ui.updateSoundLabMusic(this.ctx.sound.musicState);
  }
}
