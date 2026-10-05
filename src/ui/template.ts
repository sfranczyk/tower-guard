/**
 * Static DOM markup. Elements are looked up by their data-* attributes in DomUi.
 * The HUD bars sit above and below the canvas so they never cover the play field;
 * the overlay (menus, settings drawer, end screen) is drawn on top of the canvas.
 */
export const OVERLAY_TEMPLATE = `
      <section class="screen" data-menu>
        <div class="menu-card">
          <div class="eyebrow">Medieval defense / sandbox</div>
          <h1>Tower Guard</h1>
          <p>Protect the keep, control your position and fire with precision.</p>
          <button class="primary-button" data-start>Start game <span>Space</span></button>
          <button class="secondary-button" data-open-test>Open animation test panel</button>
        </div>
      </section>
      <section class="test-screen" data-test>
        <button class="secondary-button" data-lab-back hidden>← All animations</button>
        <button class="secondary-button" data-open-game>Battle setup</button>
      </section>
      <div class="drawer" data-drawer hidden>
        <div class="drawer-header"><h2>Game settings</h2><button class="icon-button" data-close-options aria-label="Close settings">×</button></div>
        <label class="field toggle-field"><span class="hud-label">Trajectory preview</span><input data-trajectory type="checkbox" checked></label>
        <label class="field toggle-field"><span class="hud-label">Music</span><input data-music type="checkbox" checked></label>
        <label class="field"><span class="hud-label">Music volume</span><input data-music-volume type="range" min="0" max="100" step="5" value="35"></label>
        <label class="field toggle-field"><span class="hud-label">Sound effects</span><input data-sound type="checkbox" checked></label>
        <label class="field"><span class="hud-label">Effects volume</span><input data-volume type="range" min="0" max="100" step="5" value="70"></label>
      </div>
      <section class="screen sandbox-screen" data-sandbox hidden>
        <div class="sandbox-card" data-sandbox-form></div>
      </section>
      <section class="screen" data-end hidden>
        <div class="end-card"><h2 data-end-title>Victory</h2><p data-end-copy>Press Space to return to the main menu.</p><button class="primary-button" data-end-button>Return to menu</button></div>
      </section>
`;

export const HUD_TOP_TEMPLATE = `
  <div class="hud-stats">
    <div class="hud-stat"><span class="hud-label">Keep</span><strong data-tower-health>570 HP</strong></div>
    <div class="hud-stat"><span class="hud-label">Bowman</span><strong data-bowman-health>100 HP</strong></div>
    <div class="hud-stat"><span class="hud-label">Enemies</span><strong data-enemy-count>0 / 10</strong></div>
    <div class="hud-stat"><span class="hud-label">Wave <span data-wave>1 / 1</span></span><strong data-battleground>Green Meadow</strong></div>
  </div>
  <div class="projectile-bar" data-projectiles>
    <button class="projectile-button active" data-projectile="normal"><b>1</b> Normal</button>
    <button class="projectile-button" data-projectile="explosive"><b>2</b> Explosive</button>
    <button class="projectile-button" data-projectile="piercing"><b>3</b> Piercing</button>
  </div>
  <div class="hud-actions">
    <button class="icon-button" data-options aria-label="Open settings">⚙</button>
  </div>
`;

export const HUD_BOTTOM_TEMPLATE = `
  <div class="status-line" data-status>Drag from the bowman and release to fire</div>
`;
