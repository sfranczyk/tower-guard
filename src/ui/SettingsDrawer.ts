import type { AudioSettings } from '../audio/audioSettings';
import type { UiHandlers } from './uiHandlers';
import { queryIn } from './domQuery';

/**
 * The settings drawer's options (aim preview, cursor circle, damage numbers, banner markers, friendly fire, arrow
 * trails, music and effects): changes go to `handlers.*Change`, the scenes set the shown values (`set*Option`).
 */
export class SettingsDrawer {
  private readonly trajectoryInput: HTMLInputElement;
  private readonly cursorCircleInput: HTMLInputElement;
  private readonly damageNumbersInput: HTMLInputElement;
  private readonly bannerMarkersInput: HTMLInputElement;
  private readonly friendlyFireInput: HTMLInputElement;
  private readonly trailButtons: HTMLButtonElement[];
  private readonly soundInput: HTMLInputElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly musicInput: HTMLInputElement;
  private readonly musicVolumeInput: HTMLInputElement;

  public constructor(root: ParentNode, handlers: UiHandlers) {
    this.trajectoryInput = queryIn<HTMLInputElement>(root, '[data-trajectory]');
    this.cursorCircleInput = queryIn<HTMLInputElement>(root, '[data-cursor-circle]');
    this.damageNumbersInput = queryIn<HTMLInputElement>(root, '[data-damage-numbers]');
    this.bannerMarkersInput = queryIn<HTMLInputElement>(root, '[data-banner-markers]');
    this.friendlyFireInput = queryIn<HTMLInputElement>(root, '[data-friendly-fire]');
    this.trailButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-trail-count]'));
    this.soundInput = queryIn<HTMLInputElement>(root, '[data-sound]');
    this.volumeInput = queryIn<HTMLInputElement>(root, '[data-volume]');
    this.musicInput = queryIn<HTMLInputElement>(root, '[data-music]');
    this.musicVolumeInput = queryIn<HTMLInputElement>(root, '[data-music-volume]');

    this.trajectoryInput.addEventListener('change', () => handlers.trajectoryChange?.(this.trajectoryInput.checked));
    this.cursorCircleInput.addEventListener('change', () => handlers.cursorCircleChange?.(this.cursorCircleInput.checked));
    this.damageNumbersInput.addEventListener('change', () => handlers.damageNumbersChange?.(this.damageNumbersInput.checked));
    this.bannerMarkersInput.addEventListener('change', () => handlers.bannerMarkersChange?.(this.bannerMarkersInput.checked));
    this.friendlyFireInput.addEventListener('change', () => handlers.friendlyFireChange?.(this.friendlyFireInput.checked));
    this.trailButtons.forEach((button) => button.addEventListener('click', () => {
      handlers.arrowTrailsChange?.(Number(button.dataset.trailCount));
      // Drop focus so Space (shrapnel burst) doesn't press it again.
      button.blur();
    }));
    const audioChange = (changes: Partial<AudioSettings>): void => handlers.audioChange?.(changes);
    this.soundInput.addEventListener('change', () => audioChange({ effectsEnabled: this.soundInput.checked }));
    this.volumeInput.addEventListener('input', () => audioChange({ effectsVolume: Number(this.volumeInput.value) / 100 }));
    this.musicInput.addEventListener('change', () => audioChange({ musicEnabled: this.musicInput.checked }));
    this.musicVolumeInput.addEventListener('input', () => audioChange({ musicVolume: Number(this.musicVolumeInput.value) / 100 }));
  }

  public setTrajectoryOption(showTrajectory: boolean): void {
    this.trajectoryInput.checked = showTrajectory;
  }

  public setCursorCircleOption(showCursorCircle: boolean): void {
    this.cursorCircleInput.checked = showCursorCircle;
  }

  public setBannerMarkersOption(enabled: boolean): void {
    this.bannerMarkersInput.checked = enabled;
  }

  public setDamageNumbersOption(enabled: boolean): void {
    this.damageNumbersInput.checked = enabled;
  }

  public setFriendlyFireOption(enabled: boolean): void {
    this.friendlyFireInput.checked = enabled;
  }

  public setArrowTrailsOption(count: number): void {
    this.trailButtons.forEach((button) => {
      const active = Number(button.dataset.trailCount) === count;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', `${active}`);
    });
  }

  public setAudioOptions(settings: Readonly<AudioSettings>): void {
    this.soundInput.checked = settings.effectsEnabled;
    this.volumeInput.value = `${Math.round(settings.effectsVolume * 100)}`;
    this.musicInput.checked = settings.musicEnabled;
    this.musicVolumeInput.value = `${Math.round(settings.musicVolume * 100)}`;
  }
}
