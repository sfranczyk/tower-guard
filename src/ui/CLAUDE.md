# HTML UI (src/ui)

- Style: the landscape look: flat shapes, cream panels, chunky gold/cream buttons (`primary-button`,
  `secondary-button`), the Fredoka display font, flat SVG icons (`icons.ts`), markup in `template.ts`, styles in
  `index.html`. Game text is English. Accent and backdrop follow the map (`DomUi.setTheme`, battleground `ui`).
- **HUD** (`Hud.ts`): sits *outside* the canvas (bar above: level progress left, weapons centred;
  status line below); `DomUi.fitCanvas()` scales the canvas into the remaining space. Never place HUD elements over the
  play field. Keep and bowman health are bars in the world (Tower, `Bowman.setHealthRatio`), not in the HUD. Weapons are square slots (`LOADOUT_SLOTS` = 3,
  `weaponSlots`): icon only (name in the tooltip), key in the corner, shots ready/held underneath; while one loads a shade
  drains downward like the soldiers' pause (`.slot-shade`/`.slot-wait`, `DomUi.updateWeaponCooldowns`; `ARROW_COOLDOWN` / `ARROW_CHARGES` in config/arrows, `systems/arrowCooldowns.ts`, per
  `Player`, checked in `BattlePlayers.update`; while the chosen arrow loads the bow isn't drawn and the aim circles are grey, `canDrawBow` in scenes/PlayerControl); built from the quiver (`DomUi.setLoadout`). Right of them the soldiers' slots (`allySlots`, `ICON_ALLIES`: key, `alive/limit`, a shade for
  the pause) and the order button (`ICON_ORDERS`): `DomUi.setAllies` once, `updateAllies` every frame. Banners: a line under the level chip (`DomUi.updateBanners`, `ICON_BANNERS`), off with the drawer's "Banner markers" (`session.bannerMarkers`).
- **Overlays on the canvas** (menu, sandbox/sound panels, end screen, pause dialog `[data-pause]` (`PauseView`: restart button, the quiver editor while in the keep) placed under the
  settings drawer and the tuning panel, settings drawer) are laid out for a canvas at
  scale 1 and zoom with it (`--ui-scale`, set in `fitCanvas`, `UI_SCALE` limits); the sandbox's buttons stay pinned
  at the bottom of its card.
- **Sandbox form** (`SandboxForm.ts`): level tabs (map thumbnail, enemy count, add/remove, 1–5), the selected level's
  battleground (map cards, `mapThumbnail.ts`: a tiny SVG landscape from the palette) and enemies (a card per type with
  − / +, type icons), bowman/keep health, difficulty and Banners on/off in one strip under the page tabs (`.sandbox-options`: two pairs that wrap only whole). Second page, Quiver (`quiverPage.ts`): fill the three slots
  (click a slot then an arrow, or drag: `quiverDrag.ts`; editing shared with co-op: `quiverEditing.ts`).
  Mode switch Battle / Survival right of the page tabs (`data-mode`); survival levels: time stepper and kind toggles
  (`survivalEditor.ts`), no Banners. HUD in survival: the clock "m:ss to dawn" (`HudValues.clockMs`) and the defeated count.
- **Settings drawer** (handlers in `SceneManager`; menu, and in battle from the pause dialog: "Settings" or I, Esc closes it first): sound/music toggles and volumes
  (persisted), trajectory preview (off by default), arrow trails (0–3, `DEFAULT_ARROW_TRAILS` = 1), cursor circle,
  damage numbers (on), friendly fire; these live in `ctx.session` for the browser session.
- `CoopPanel.ts`: the co-op lobby (net/CLAUDE.md). `SoundLabPanel.ts`: the sound test panel.
- Dev views (animation, design, sound lab) all have "← Menu" in their panel's top-right corner.
- **Tuning panel** (`TuningPanel.ts`, `?tune` or menu → Dev tools → "Tuning panel"; a collapsible side panel over the
  canvas's right edge): every `tunable` group from `core/tuning.ts` (registry, pure, tested) as sliders + numbers,
  reset per value/group, changed marks, saved in localStorage, "Copy changes" gives paste-ready source. Local only.
  To make a constant tunable: move it into a group (`export const WAVES = tunable('WAVES', 'Waves', { ... })` in
  config/), read `WAVES.key` at use time, never copy it into a module-level const. Enemy health/speed per type:
  `data/enemyTuning.ts` (read at spawn).
