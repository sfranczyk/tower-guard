import { ARROW_INFO, type ArrowType } from '../data/loadout';
import { ICON_BOWMAN, ICON_GEAR, ICON_KEEP, ICON_WAVE, ICON_WEAPONS } from './icons';

/**
 * Static DOM markup. Elements are looked up by their data-* attributes in DomUi.
 * The HUD bars sit above and below the canvas so they never cover the play field;
 * the overlay (menus, settings drawer, end screen) is drawn on top of the canvas.
 */
export const OVERLAY_TEMPLATE = `
      <section class="screen menu-screen" data-menu>
        <div class="menu-stack">
          <h1 class="logo">Tower Guard</h1>
          <p class="tagline">Hold the keep. Read the wind. Loose the arrow.</p>
          <div class="menu-card">
            <button class="primary-button" data-start>Start game <span class="key-hint">Space</span></button>
            <button class="secondary-button" data-open-coop>Co-op online</button>
            <button class="secondary-button" data-menu-settings>Settings</button>
            <button class="dev-toggle" data-dev-toggle aria-expanded="false">Dev tools ▾</button>
            <div class="dev-tools" data-dev-tools hidden>
              <button class="secondary-button small-button" data-open-test>Animation lab</button>
              <button class="secondary-button small-button" data-open-sound-lab>Sound lab</button>
              <button class="secondary-button small-button" data-open-design-lab>Design lab</button>
            </div>
          </div>
        </div>
      </section>
      <section class="test-screen" data-test>
        <button class="secondary-button small-button" data-lab-back hidden>← All animations</button>
        <button class="secondary-button small-button" data-open-game>Battle setup</button>
      </section>
      <div class="drawer" data-drawer hidden>
        <div class="drawer-header"><h2>Settings</h2><button class="round-button" data-close-options aria-label="Close settings">×</button></div>
        <label class="field toggle-field"><span>Trajectory preview</span><input data-trajectory type="checkbox"></label>
        <label class="field toggle-field"><span>Aim circle at cursor</span><input data-cursor-circle type="checkbox" checked></label>
        <label class="field toggle-field" title="Your arrows, their blasts, fire, frost, vortices and pins hit bowmen too"><span>Friendly fire</span><input data-friendly-fire type="checkbox" checked></label>
        <div class="field toggle-field"><span>Arrow trails</span><div class="segmented" data-arrow-trails role="radiogroup" aria-label="Arrow trails">
          <button class="chip-button" data-trail-count="0" role="radio">0</button><button class="chip-button" data-trail-count="1" role="radio">1</button><button class="chip-button" data-trail-count="2" role="radio">2</button><button class="chip-button" data-trail-count="3" role="radio">3</button>
        </div></div>
        <label class="field toggle-field"><span>Music</span><input data-music type="checkbox" checked></label>
        <label class="field"><span>Music volume</span><input data-music-volume type="range" min="0" max="100" step="5" value="35"></label>
        <label class="field toggle-field"><span>Sound effects</span><input data-sound type="checkbox" checked></label>
        <label class="field"><span>Effects volume</span><input data-volume type="range" min="0" max="100" step="5" value="70"></label>
      </div>
      <section class="screen panel-screen" data-sound-lab hidden>
        <div class="panel-card sound-lab-card" data-sound-lab-panel></div>
      </section>
      <section class="screen panel-screen" data-coop hidden>
        <div class="panel-card coop-card" data-coop-panel></div>
      </section>
      <section class="screen panel-screen" data-sandbox hidden>
        <div class="panel-card" data-sandbox-form></div>
      </section>
      <section class="screen end-screen" data-end hidden>
        <div class="end-card">
          <h2 data-end-title>Victory</h2>
          <p data-end-copy>Press Space to return to the main menu.</p>
          <div class="end-stats" data-end-stats></div>
          <button class="primary-button" data-end-button>Return to menu</button>
        </div>
      </section>
`;

/** Weapon slots (the quiver from the battle setup): icon only (name in the tooltip), key in the corner, ammo underneath. */
export const weaponSlots = (loadout: readonly (ArrowType | null)[]): string => loadout.map((type, index) => {
  if (!type) {
    return `<div class="weapon"><div class="weapon-slot empty" aria-hidden="true"><span class="weapon-key">${index + 1}</span></div><span class="weapon-ammo">–</span></div>`;
  }
  const { name, summary } = ARROW_INFO[type];
  return `<div class="weapon"><button class="weapon-slot" data-projectile="${type}" title="${name}: ${summary} (${index + 1})" aria-label="${name}">`
    + `<span class="weapon-key">${index + 1}</span>${ICON_WEAPONS[type]}</button>`
    + `<span class="weapon-ammo" data-ammo="${type}">∞</span></div>`;
}).join('');

export const HUD_TOP_TEMPLATE = `
  <div class="hud-chip">${ICON_KEEP}<div><div class="chip-label">Keep</div><div class="meter"><i data-tower-bar></i></div><div class="chip-value" data-tower-health>600 / 600</div></div></div>
  <div class="hud-chip">${ICON_BOWMAN}<div><div class="chip-label" data-bowman-label>Bowman</div><div class="meter"><i data-bowman-bar></i></div><div class="chip-value" data-bowman-health>100 / 100</div></div></div>
  <div class="hud-chip" data-bowman2-chip hidden>${ICON_BOWMAN}<div><div class="chip-label">Player 2</div><div class="meter"><i data-bowman2-bar></i></div><div class="chip-value" data-bowman2-health>100 / 100</div></div></div>
  <div class="hud-chip">${ICON_WAVE}<div><div class="chip-label">Level <span data-wave>1 / 1</span></div><div class="pips" data-enemy-pips></div><div class="meter" hidden><i data-wave-bar></i></div><div class="chip-value" data-enemy-count>0 of 0 defeated</div></div></div>
  <div class="hud-spacer"></div>
  <div class="weapons" data-projectiles></div>
  <div class="hud-spacer"></div>
  <button class="round-button" data-options aria-label="Open settings">${ICON_GEAR}</button>
`;

export const HUD_BOTTOM_TEMPLATE = `
  <div class="status-banner" data-status>Drag from the bowman and release to fire</div>
`;
