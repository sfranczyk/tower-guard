import { ARROW_INFO, type ArrowType } from '../data/loadout';
import type { AllyType } from '../types';
import { ICON_ALLIES, ICON_LEVEL, ICON_ORDERS, ICON_WEAPONS } from './icons';

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
            <button class="secondary-button" data-open-moba>Online team battle</button>
            <button class="secondary-button" data-menu-settings>Settings</button>
            <button class="dev-toggle" data-dev-toggle aria-expanded="false">Dev tools ▾</button>
            <div class="dev-tools" data-dev-tools hidden>
              <button class="secondary-button small-button" data-open-test>Animation lab</button>
              <button class="secondary-button small-button" data-open-sound-lab>Sound lab</button>
              <button class="secondary-button small-button" data-open-design-lab>Design lab</button>
              <button class="secondary-button small-button" data-open-tuning>Tuning panel</button>
            </div>
          </div>
        </div>
      </section>
      <section class="test-screen" data-test>
        <button class="secondary-button small-button" data-lab-menu>← Menu</button>
        <button class="secondary-button small-button" data-lab-back hidden>← All animations</button>
      </section>
      <section class="screen end-screen" data-pause hidden>
        <div class="end-card">
          <h2 data-pause-title>Paused</h2>
          <p data-pause-copy>The battle waits for you.</p>
          <div class="pause-body">
          <div class="pause-quiver" data-pause-quiver></div>
          <div class="pause-actions">
            <button class="primary-button" data-pause-resume>Resume <span class="key-hint">Esc</span></button>
            <button class="secondary-button" data-pause-restart title="Full health for the bowmen, the level's enemies anew; the keep stays as it is">Restart level</button>
            <button class="secondary-button" data-pause-settings>Settings</button>
            <button class="secondary-button" data-pause-menu>Main menu</button>
          </div>
          </div>
        </div>
      </section>
      <div class="drawer" data-drawer hidden>
        <div class="drawer-header"><h2>Settings</h2><button class="round-button" data-close-options aria-label="Close settings">×</button></div>
        <div class="drawer-body">
        <h3 class="drawer-group">Sound</h3>
        <label class="field toggle-field"><span>Music</span><input data-music type="checkbox" checked></label>
        <label class="field"><span>Music volume</span><input data-music-volume type="range" min="0" max="100" step="5" value="35"></label>
        <label class="field toggle-field"><span>Sound effects</span><input data-sound type="checkbox" checked></label>
        <label class="field"><span>Effects volume</span><input data-volume type="range" min="0" max="100" step="5" value="70"></label>
        <h3 class="drawer-group">HUD</h3>
        <label class="field toggle-field" title="How much each arrow hit takes off, over the enemy's head"><span>Hit visibility</span><input data-damage-numbers type="checkbox" checked></label>
        <label class="field toggle-field" data-banner-markers-row hidden title="Where both banners are, in the HUD, and a marker at the edge for one carried out of view"><span>Banner markers</span><input data-banner-markers type="checkbox" checked></label>
        <h3 class="drawer-group">Aim helpers</h3>
        <div class="field toggle-field"><span>Arrow trails</span><div class="segmented" data-arrow-trails role="radiogroup" aria-label="Arrow trails">
          <button class="chip-button" data-trail-count="0" role="radio">0</button><button class="chip-button" data-trail-count="1" role="radio">1</button><button class="chip-button" data-trail-count="2" role="radio">2</button><button class="chip-button" data-trail-count="3" role="radio">3</button>
        </div></div>
        <label class="field toggle-field"><span>Trajectory preview</span><input data-trajectory type="checkbox"></label>
        <label class="field toggle-field" title="The aim circles at the drag start too, not just at the bow"><span>Aim cursor helper</span><input data-cursor-circle type="checkbox"></label>
        </div>
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
          <div class="end-actions">
            <button class="secondary-button" data-end-view>View battlefield</button>
            <button class="primary-button" data-end-button>Return to menu</button>
          </div>
        </div>
        <button class="secondary-button end-back" data-end-back>Back to results</button>
      </section>
`;

/** Weapon slots (the quiver from the battle setup): icon only (name in the tooltip), key in the corner, shots ready / held
 * underneath, a shade over the slot while the next one loads, draining downward as with the soldiers (DomUi.updateWeaponCooldowns). */
export const weaponSlots = (loadout: readonly (ArrowType | null)[]): string => loadout.map((type, index) => {
  if (!type) {
    return `<div class="weapon"><div class="weapon-slot empty" aria-hidden="true"><span class="weapon-key">${index + 1}</span></div><span class="weapon-ammo">–</span></div>`;
  }
  const { name, summary } = ARROW_INFO[type];
  return `<div class="weapon"><button class="weapon-slot" data-projectile="${type}" title="${name}: ${summary} (${index + 1})" aria-label="${name}">`
    + `<span class="weapon-key">${index + 1}</span>${ICON_WEAPONS[type]}<span class="slot-shade"><i class="slot-wait" data-wait></i></span></button>`
    + `<span class="weapon-ammo" data-ammo="${type}"></span></div>`;
}).join('');

/** The keys that summon each soldier and cycle their order (GameScene). */
export const ALLY_KEYS: Readonly<Record<AllyType, string>> = { squire: 'Z', allyKnight: 'X', medic: 'C' };
export const ORDER_KEY = 'V';

/** The soldiers' slots (icon, key, "ready · standing / allowed" under it, a shade for the next one's training) and the order button. */
export const allySlots = (allies: ReadonlyArray<{ type: AllyType; label: string }>): string => allies.map(({ type, label }) =>
  `<div class="weapon"><button class="weapon-slot" data-ally="${type}" title="Summon a ${label.toLowerCase()} (${ALLY_KEYS[type]})" aria-label="Summon a ${label.toLowerCase()}">`
  + `<span class="weapon-key">${ALLY_KEYS[type]}</span>${ICON_ALLIES[type]}<span class="slot-shade"><i class="slot-wait" data-ally-wait="${type}"></i></span></button>`
  + `<span class="weapon-ammo" data-ally-count="${type}" title="Ready · standing / allowed">0 · 0/0</span></div>`).join('')
  + `<div class="weapon order-slot"><button class="weapon-slot" data-ally-order title="Orders (${ORDER_KEY})" aria-label="Orders">`
  + `<span class="weapon-key">${ORDER_KEY}</span><span data-order-icon>${ICON_ORDERS.hold}</span></button>`
  + `<span class="weapon-ammo" data-order-label>Hold</span></div>`;

export const HUD_TOP_TEMPLATE = `
  <div class="hud-chip">${ICON_LEVEL}<div><div class="chip-label">Level <span data-level-number>1 / 1</span></div><div class="survival-clock" data-survival-clock hidden></div><div class="pips" data-enemy-pips></div><div class="meter" hidden><i data-level-bar></i></div><div class="chip-value" data-enemy-count>0 of 0 defeated</div><div class="chip-value moba-purse" data-moba-purse hidden></div><div class="chip-value banner-line" data-banners hidden></div></div></div>
  <div class="weapons" data-projectiles></div>
  <div class="weapons allies" data-allies hidden></div>
`;

export const HUD_BOTTOM_TEMPLATE = `
  <div class="status-banner" data-status>Drag from the bowman and release to fire</div>
`;
