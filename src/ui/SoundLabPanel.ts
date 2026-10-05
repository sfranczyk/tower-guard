import type { AudioSettings } from '../audio/audioSettings';
import type { SoundId } from '../audio/SoundManager';

export interface SoundLabRow {
  id: SoundId;
  title: string;
  description: string;
  source: string;
  /** Duration of each variant (seconds). */
  durations: number[];
}

export interface SoundLabMusic {
  title: string;
  description: string;
  source: string;
}

export interface SoundLabMusicState {
  playing: boolean;
  position: number;
  duration: number;
}

export interface SoundLabCallbacks {
  play(id: SoundId, variant?: number): void;
  toggleMusic(): void;
  musicSeam(): void;
  audioChange(changes: Partial<AudioSettings>): void;
  back(): void;
}

const seconds = (value: number): string => `${value.toFixed(2)} s`;
const clock = (value: number): string => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The sound test panel: every effect (each variant playable), the theme with a seam test, volumes. */
export class SoundLabPanel {
  public constructor(private readonly root: HTMLElement, callbacks: SoundLabCallbacks) {
    root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) {
        return;
      }
      const { soundPlay, soundVariant } = button.dataset;
      if (soundPlay) {
        callbacks.play(soundPlay as SoundId, soundVariant === undefined ? undefined : Number(soundVariant));
      } else if (button.hasAttribute('data-music-toggle')) {
        callbacks.toggleMusic();
      } else if (button.hasAttribute('data-music-seam')) {
        callbacks.musicSeam();
      } else if (button.hasAttribute('data-sound-lab-back')) {
        callbacks.back();
      }
    });
    root.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      const value = Number(input.value) / 100;
      if (input.hasAttribute('data-lab-effects-volume')) {
        callbacks.audioChange({ effectsVolume: value });
      } else if (input.hasAttribute('data-lab-music-volume')) {
        callbacks.audioChange({ musicVolume: value });
      }
    });
  }

  public render(rows: readonly SoundLabRow[], music: SoundLabMusic, settings: Readonly<AudioSettings>): void {
    const effectRows = rows.map((row) => {
      const variants = row.durations.length > 1
        ? row.durations.map((duration, index) =>
          `<button class="chip-button" data-sound-play="${row.id}" data-sound-variant="${index}" title="${seconds(duration)}">${index + 1}</button>`).join('')
        : '';
      const length = row.durations.length > 1
        ? `${row.durations.length} takes, ${seconds(Math.min(...row.durations))}–${seconds(Math.max(...row.durations))}`
        : row.durations.length === 1 ? seconds(row.durations[0]) : 'not loaded';
      return `
        <div class="sound-row">
          <div class="sound-info">
            <strong>${escapeHtml(row.title)}</strong>
            <span>${escapeHtml(row.description)}</span>
            <small>${escapeHtml(row.source)} · ${length}</small>
          </div>
          <div class="sound-actions">
            <button class="secondary-button" data-sound-play="${row.id}">▶ ${row.durations.length > 1 ? 'Random' : 'Play'}</button>
            ${variants ? `<div class="sound-variants">${variants}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    this.root.innerHTML = `
      <div class="eyebrow">Sound test panel</div>
      <h2>Sounds</h2>
      <div class="sound-volumes">
        <label class="field"><span class="hud-label">Effects volume</span><input data-lab-effects-volume type="range" min="0" max="100" step="5" value="${Math.round(settings.effectsVolume * 100)}"></label>
        <label class="field"><span class="hud-label">Music volume</span><input data-lab-music-volume type="range" min="0" max="100" step="5" value="${Math.round(settings.musicVolume * 100)}"></label>
      </div>
      <div class="sound-row">
        <div class="sound-info">
          <strong>${escapeHtml(music.title)}</strong>
          <span>${escapeHtml(music.description)}</span>
          <small>${escapeHtml(music.source)} · <span data-music-clock>0:00 / 0:00</span></small>
          <div class="music-progress"><div data-music-progress></div></div>
        </div>
        <div class="sound-actions">
          <button class="secondary-button" data-music-toggle>▶ Play</button>
          <button class="secondary-button" data-music-seam title="Jumps 4 s before the loop point">Hear the loop seam</button>
        </div>
      </div>
      ${effectRows}
      <div class="sandbox-actions">
        <button class="secondary-button" data-sound-lab-back>Back</button>
      </div>`;
  }

  /** Called every frame: play/stop label, position and progress bar of the theme. */
  public updateMusic(state: SoundLabMusicState): void {
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-music-toggle]');
    const clockElement = this.root.querySelector('[data-music-clock]');
    const progress = this.root.querySelector<HTMLElement>('[data-music-progress]');
    if (toggle) {
      toggle.textContent = state.playing ? '■ Stop' : '▶ Play';
    }
    if (clockElement) {
      clockElement.textContent = `${clock(state.position)} / ${clock(state.duration)}`;
    }
    if (progress) {
      progress.style.width = `${state.duration > 0 ? (state.position / state.duration) * 100 : 0}%`;
    }
  }
}
