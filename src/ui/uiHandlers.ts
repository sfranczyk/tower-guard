import type { AudioSettings } from '../audio/audioSettings';
import type { SoundId } from '../audio/SoundManager';
import type { Loadout } from '../data/loadout';
import type { Team } from '../data/moba';
import type { SandboxSettings } from '../data/sandbox';
import type { AllyType, ProjectileType } from '../types';
import type { KeepSide } from '../core/keepSide';

/** What the HTML UI reports to the running scene: scenes assign `ui.handlers.*` (DomUi). */
export interface UiHandlers {
  start?: () => void;
  openAnimationLab?: () => void;
  openSoundLab?: () => void;
  openDesignLab?: () => void;
  toggleTuning?: () => void;
  /** The end screen's "View battlefield" (true) or "Back to results" (false). */
  viewBattlefield?: (viewing: boolean) => void;
  /** Animation and design lab: back to the main menu. */
  labMenu?: () => void;
  /** Animation lab: leave the zoomed view and return to the list. */
  labBack?: () => void;
  toggleOptions?: () => void;
  /** MOBA shop: buy the next level of an upgrade, move `step` vault gold (true: deposit), close it. */
  shopBuy?: (id: string) => void;
  shopVault?: (deposit: boolean, step: number) => void;
  /** Settings drawer: which side of the screen the player's keep is on. */
  keepSideChange?: (side: KeepSide) => void;
  shopClose?: () => void;
  /** The pause dialog's "Resume", "Restart level" and "Main menu" buttons. */
  pauseResume?: () => void;
  pauseRestart?: () => void;
  pauseMenu?: () => void;
  /** The pause dialog's quiver (shown while the bowman is in the keep) was changed. */
  pauseLoadout?: (loadout: Loadout) => void;
  selectProjectile?: (type: ProjectileType) => void;
  summonAlly?: (type: AllyType) => void;
  cycleAllyOrder?: () => void;
  /** `level`: the level being edited (its battleground is shown behind the form). */
  sandboxChange?: (settings: SandboxSettings, level: number) => void;
  sandboxStart?: () => void;
  sandboxBack?: () => void;
  openCoop?: () => void;
  /** The menu's MOBA: the co-op lobby with teams (or a practice match alone). */
  openMoba?: () => void;
  /** MOBA lobby: a match alone (no room). */
  mobaPractice?: () => void;
  coopHost?: () => void;
  coopJoin?: (code: string) => void;
  coopSetup?: () => void;
  coopLeave?: () => void;
  coopLoadout?: (loadout: Loadout) => void;
  /** MOBA lobby: switch to this team. */
  coopTeam?: (team: Team) => void;
  trajectoryChange?: (enabled: boolean) => void;
  cursorCircleChange?: (enabled: boolean) => void;
  /** Damage numbers over the enemies' heads toggled in the settings drawer. */
  damageNumbersChange?: (enabled: boolean) => void;
  bannerMarkersChange?: (enabled: boolean) => void;
  /** Number of shots that keep their trail (0..3) picked in the settings drawer. */
  arrowTrailsChange?: (count: number) => void;
  /** A music or effects toggle/volume (0..1) changed in the settings drawer. */
  audioChange?: (changes: Partial<AudioSettings>) => void;
  soundLabPlay?: (id: SoundId, variant?: number) => void;
  soundLabToggleMusic?: () => void;
  soundLabMusicSeam?: () => void;
  soundLabAudioChange?: (changes: Partial<AudioSettings>) => void;
  soundLabBack?: () => void;
}
