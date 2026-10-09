# HTML UI (src/ui)

- Style: the landscape look: flat shapes, cream panels, chunky gold/cream buttons (`primary-button`,
  `secondary-button`), the Fredoka display font, flat SVG icons (`icons.ts`), markup in `template.ts`, styles in
  `index.html`. Game text is English. Accent and backdrop follow the map (`DomUi.setTheme`, battleground `ui`).
- **HUD** (`Hud.ts`): sits *outside* the canvas (bar above, status line below); `DomUi.fitCanvas()` scales the canvas
  into the remaining space. Never place HUD elements over the play field. Weapons are square slots (`LOADOUT_SLOTS` = 5,
  `weaponSlots`): icon only (name in the tooltip), key in the corner, ammo underneath (∞ for now); built from the quiver
  (`DomUi.setLoadout`).
- **Overlays on the canvas** (menu, sandbox/sound panels, end screen, settings drawer) are laid out for a canvas at
  scale 1 and zoom with it (`--ui-scale`, set in `fitCanvas`, `UI_SCALE` limits); the sandbox's buttons stay pinned
  at the bottom of its card.
- **Sandbox form** (`SandboxForm.ts`): level tabs (map thumbnail, enemy count, add/remove, 1–5), the selected level's
  battleground (map cards, `mapThumbnail.ts`: a tiny SVG landscape from the palette) and enemies (a card per type with
  − / +, type icons), bowman/keep health in the header. Second page, Quiver (`quiverPage.ts`): fill the five slots
  (click a slot then an arrow, or drag: `quiverDrag.ts`; editing shared with co-op: `quiverEditing.ts`).
- **Settings drawer** (handlers in `SceneManager`, works in menu and game): sound/music toggles and volumes
  (persisted), trajectory preview (off by default), arrow trails (0–3, `DEFAULT_ARROW_TRAILS` = 1), cursor circle,
  friendly fire; these live in `ctx.session` for the browser session.
- `CoopPanel.ts`: the co-op lobby (net/CLAUDE.md). `SoundLabPanel.ts`: the sound test panel.
- **Tuning panel** (`TuningPanel.ts`, `?tune` or menu → Dev tools → "Tuning panel"; a collapsible side panel over the
  canvas's right edge): every `tunable` group from `core/tuning.ts` (registry, pure, tested) as sliders + numbers,
  reset per value/group, changed marks, saved in localStorage, "Copy changes" gives paste-ready source. Local only.
  To make a constant tunable: move it into a group (`export const WAVES = tunable('WAVES', 'Waves', { ... })` in
  config.ts), read `WAVES.key` at use time, never copy it into a module-level const. Enemy health/speed per type:
  `data/enemyTuning.ts` (read at spawn).
