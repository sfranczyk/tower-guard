/** Static DOM overlay markup. Elements are looked up by their data-* attributes in DomUi. */
export const UI_TEMPLATE = `
      <section class="screen" data-menu>
        <div class="menu-card">
          <div class="eyebrow">Medieval defense / level 01</div>
          <h1>Tower Guard</h1>
          <p>Protect the keep, control your position and fire with precision.</p>
          <button class="primary-button" data-start>Begin defense <span>1 / Space</span></button>
          <button class="secondary-button" data-open-test>Open animation test panel</button>
        </div>
      </section>
      <section class="test-screen" data-test>
        <div class="test-header">
          <div>
            <div class="eyebrow">Animation workshop / prototype</div>
            <h1>Character test panel</h1>
          <p>Compare the movement cycles and the archer's bow silhouette.</p>
          </div>
          <button class="secondary-button" data-open-game>Open game</button>
        </div>
        <div class="test-panel">
          <div class="test-panel-heading">
            <div><span class="eyebrow">Active character</span><strong>Archer stickman</strong></div>
          <span class="test-badge">ANIMATION LAB</span>
          </div>
          <p>All previews use the same stickman proportions as the in-game characters.</p>
          <div class="test-selection">
            <button class="character-chip active">Archer</button>
            <button class="character-chip enemy-chip">Enemy</button>
          </div>
          <div class="test-readout" data-test-joint>Animation previews and archer model</div>
          <div class="test-animation-note">Walking, sprinting and club attack cycles are shown below.</div>
        </div>
      </section>
      <section class="game-ui" data-game-ui hidden>
        <div class="topbar">
           <div class="metrics">
             <div class="metric-card"><span class="metric-label">Keep health</span><strong class="metric-value" data-tower-health>570 HP</strong></div>
             <div class="metric-card"><span class="metric-label">Bowman health</span><strong class="metric-value" data-bowman-health>100 HP</strong></div>
             <div class="metric-card"><span class="metric-label">Wave / enemies</span><strong class="metric-value" data-enemy-count>0 / 10</strong></div>
             <div class="metric-card"><span class="metric-label">Level · gold</span><strong class="metric-value"><span data-level>1</span> · <span data-gold>0</span></strong></div>
           </div>
          <div class="toolbar">
            <div><div class="toolbar-label">Aim power</div><div class="toolbar-title"><span data-force>0%</span> · The First Wave</div></div>
            <button class="icon-button" data-options aria-label="Open settings">⚙</button>
          </div>
        </div>
           <div class="projectile-bar" data-projectiles>
             <button class="projectile-button active" data-projectile="normal"><b>1</b> Normal</button>
             <button class="projectile-button" data-projectile="explosive"><b>2</b> Explosive</button>
             <button class="projectile-button" data-projectile="piercing"><b>3</b> Piercing</button>
           </div>
           <div class="status-bar" data-status>Drag from the bowman and release to fire</div>
        <div class="drawer" data-drawer hidden>
          <div class="drawer-header"><h2>Game settings</h2><button class="icon-button" data-close-options aria-label="Close settings">×</button></div>
          <div class="field"><div class="field-row"><span class="toolbar-label">Arrow gravity</span><strong class="field-value" data-gravity-value>700</strong></div><input data-gravity type="range" min="80" max="1000" step="1" value="700"></div>
          <div class="field"><div class="field-row"><span class="toolbar-label">Bow tension</span><strong class="field-value" data-tension-value>100%</strong></div><input data-tension type="range" min="0" max="1" step=".01" value="1"></div>
        </div>
      </section>
      <section class="screen" data-end hidden>
        <div class="end-card"><h2 data-end-title>Victory</h2><p data-end-copy>Press Space to return to the main menu.</p><button class="primary-button" data-end-button>Return to menu</button></div>
      </section>
`;
