# Plan: mobile version

Goal: Tower Guard playable on a phone (and tablet) in the browser, landscape, with touch, at 60 fps on a mid-range
phone, including online co-op. Desktop stays exactly as it is. This is a plan only; nothing here is built yet.

## Where we stand today

What already helps:

- **Aiming is pointer events** (`managers/InputManager.ts`): `pointerdown` on the canvas, `pointermove` / `pointerup` /
  `pointercancel` on the window, pointer capture, the pull measured on screen. A single finger already draws and looses
  the bow. The quiver page's drag and drop (`ui/quiverDrag.ts`) is pointer events too.
- **The view already adapts** (`core/viewport.ts`, `DomUi.fitCanvas`): fixed height `GAME_HEIGHT` 680, width from
  `GAME_WIDTH` 1455 (~2.14:1) up to `MAX_VIEW_WIDTH`, renderer resolution = CSS scale × devicePixelRatio
  (`MAX_RENDER_RESOLUTION` 4), overlays zoom with `--ui-scale`. Phones in landscape are ~2.1–2.2:1, close to our ratio.
- **The HUD is HTML** (`ui/Hud.ts`, weapon/ally/order slots are `<button>`s), so it can take taps as is.

What breaks on a phone:

| Area | Today | Problem on mobile |
|---|---|---|
| Movement | A/D or arrows, Shift sprint, W jump, S leave keep | no keyboard at all |
| Weapons, soldiers | 1–3, Z/X/C, V (HUD slots also clickable) | slots get small at phone scale; names only in `title` tooltips (no hover on touch) |
| Pause, settings, end screen | Esc, I, Space, O | no keys; some flows only mention keys |
| Page | `viewport` meta without `viewport-fit`, `min-height: 100vh`, `PAGE_MARGIN` 16 px, rounded canvas, HUD bars above and below | on a 390 px tall landscape phone the HUD bars plus margins eat ~25 % of the height; `100vh` jumps with the URL bar; notch not handled; pinch zoom, long-press menu, text selection and pull-to-refresh all fire on the canvas |
| Scale | `fitView` never goes narrower than 1455 game px; `UI_SCALE.min` 0.6 | an iPhone 15 (852×393, ~734 px wide inside the safe area) gets scale ~0.5: overlays and HUD text below readable size |
| Aiming by touch | one tracked drag, `maxDragDistance` 200 game px | a second finger (e.g. on a walk button) moves the aim; the finger covers the aim circles; full draw is only ~100 CSS px on a phone |
| Audio | `AudioContext.resume()` on the first `pointerdown`/`keydown` (`audio/SoundManager.ts`) | a touch `pointerdown` is not a user activation (only `pointerup`/`touchend`/`click` are), so iOS and Android stay silent; iOS mutes Web Audio with the ringer switch; iOS suspends ("interrupted") on calls and app switches and doesn't resume by itself |
| Memory | the theme (3.3 MB mp3, 228 s stereo) is decoded fully into an `AudioBuffer` | ~80 MB of float PCM, risky on iOS Safari's per-tab memory limit |
| Performance | `ticker.add` uncapped, MSAA on, ~120 Graphics/ticker sites, stickmen redrawn per frame | 120 Hz phones run the whole loop twice as often; mid-range GPUs at DPR 2.5–3 with MSAA; no way to see fps on a phone |
| Co-op | PeerJS public broker, default ICE (STUN only), no reconnect, a hidden tab stops the loop | cellular CGNAT often needs TURN; a phone host locking the screen or switching app freezes the room; joining by typing a 5-char code on a phone keyboard |
| Lab/dev views | mouse wheel scrolls (`DesignLabScene`, `AnimationLabScene`) | no wheel; low priority (dev tools) |

## Decisions the plan assumes (see open questions)

1. **Landscape only.** In portrait we show a "Turn your phone" card over a paused game rather than a portrait layout.
   The game is a 2:1 side view; portrait would show a third of the field.
2. **Same simulation, same numbers.** Mobile is a different shell (layout, controls, quality), not a different game.
   Co-op between a phone and a desktop must work.
3. **Touch mode is a session state**, not a separate build: `ctx.session.touch` turns on when the device reports a
   coarse pointer (`matchMedia('(pointer: coarse)')`) or on the first touch, and can be forced with `?touch` (desktop
   testing) or switched in the settings drawer ("Touch controls: auto / on / off"). Until phase 4 is done it is only
   reachable with `?touch` (trunk rule: unfinished work stays off the menu).
4. **Controls layout**: left thumb walks (◀ ▶ hold buttons, sprint by sliding outward or double-tap-hold, jump and
   keep buttons above them), right thumb aims by dragging anywhere on the field, as now. Weapons, soldiers and orders
   stay the HUD slots, enlarged; a pause button joins the HUD.

## Phases

Each phase is one short-lived branch and PR (under a day), `npm run verify` + CI green, merged to master, checked on
the `/dev/` page on a real phone. Effort: S ≈ half a day, M ≈ a day, L ≈ two PRs.

### 0. Measuring and test harness (S, risk low)

- `?fps`: a small fps / frame-time / draw-call meter (DOM, top corner) so a phone shows what it does.
- `?touch` URL flag in `core/urlState.ts` (forces touch mode on desktop) and `ctx.session.touch`.
- `scripts/mobile-smoke.mjs` (Playwright via `playwright-core`, the pre-installed Chromium, devDependency only): loads
  the dev server with device emulation (`devices['Pixel 7 landscape']`, `devices['iPhone 13 landscape']`: viewport,
  DPR, `hasTouch`, `isMobile`, mobile UA), checks no page errors, that the canvas and HUD fit the viewport, and saves one
  screenshot per device at 0.5 scale. Not in CI at first (CI has no browser step today); run on demand.

### 1. Page shell: viewport, safe areas, gestures, orientation (S–M, risk low)

- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover,
  interactive-widget=resizes-content">`, `theme-color`, `apple-mobile-web-app-capable`.
- Height from `100dvh` (and `visualViewport` in `fitCanvas`, so the URL bar showing/hiding refits); safe-area padding
  with `env(safe-area-inset-*)` around `#game`; `PAGE_MARGIN` 0 and no rounded corners when the screen is small.
- On the stage: `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`,
  `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none` on body, `contextmenu` prevented on the canvas.
  Form fields keep normal touch behaviour.
- Orientation: portrait → "Turn your phone" overlay and auto-pause in battle (`BattleControls.setPaused`).
- Fullscreen button in the menu and pause dialog (touch mode only): `requestFullscreen()` then
  `screen.orientation.lock('landscape')` where supported (Android Chrome, iPad). iPhone Safari has no element
  fullscreen; there the PWA (phase 8) is the fullscreen path, and the button is hidden.

### 2. Layout and HUD for small screens (M, risk medium)

- `fitView` gets a mobile variant (pure, tested): allow a view narrower than `GAME_WIDTH` down to a new
  `MIN_VIEW_WIDTH` (proposal ~1200) so a phone with a notch scales by height instead of shrinking everything. This
  shows a bit less of the field ahead, so the aim camera's look-ahead (`CAMERA_LOOK`) needs a look; numbers in
  `config/world.ts`, tunable.
- **Compact HUD** (`body.compact` when the canvas would be under ~480 CSS px tall): one slim bar instead of two, or the
  weapon/soldier slots as columns in the side bars beside the canvas (phones are wider than tall enough that a
  ~70 px column on each side costs little). The rule "never over the play field" holds; the status line moves into
  the pause dialog or a short toast.
- Tap targets ≥ 44 CSS px (Apple) / 48 dp (Android) for HUD slots, menu buttons, steppers, toggles; `UI_SCALE.min` lowered
  only where text stays ≥ 12 CSS px.
- Tooltips: everything that only says itself in `title` (weapon names, soldier names, setup cards) gets a visible
  label or a long-press info bubble in touch mode. Key hints (`weapon-key` corners, "Space", "Esc") hide in touch mode.

### 3. Touch aiming (M, risk medium)

- `InputManager` tracks pointers by `pointerId`: the first pointer down on the free field owns the aim; other pointers
  are ignored by the aim (they go to the walk buttons) and lifting them doesn't loose or cancel the shot.
- The full draw distance measured in CSS px on touch (e.g. 140 CSS px at any scale), so a full shot is a comfortable
  thumb pull; a tiny pull (< ~12 CSS px) cancels instead of shooting a dud.
- The aim circles and trajectory preview drawn offset from the finger (or at the bowman) so the thumb doesn't hide them;
  the trajectory preview defaults on in touch mode (open question).
- Cancel aim: drag back to the start point, or a second tap of the aim finger area — decide in the lab.
- Pure part (pointer arbitration, pull → aim) in `input/touchAim.ts` with tests; the lab gets a touch-aim row.

### 4. Touch controls overlay (M–L, risk medium: feel)

- `ui/TouchControls.ts` (DOM, inside `#ui-root`, only in touch mode, bottom-left over the ground band, semi-transparent):
  ◀ ▶ (hold to walk, slide outward past the button = sprint), jump, keep (enter/leave, replaces S), and a pause button
  in the HUD. Laid out in safe-area-aware CSS, sizes in `config/` and `?tune`.
- It feeds the same input path as the keyboard: a `VirtualKeys` state merged into `InputManager.isDown`, so
  `LocalInput`, `RecordingInput` (co-op guest) and everything downstream need no change.
- HUD slots already take taps (weapon pick, soldier summon, order). End screen and pause dialog: every key-only action
  gets a button (Space → the end card's button, O → nothing on mobile).
- After this phase, touch mode turns on automatically on coarse-pointer devices (the flag becomes the override).

### 5. Audio on mobile (S, risk low–medium)

- Unlock on `pointerup`, `touchend`, `click` and `keydown` (user-activation events), and also start the music only
  then; keep listening until `context.state === 'running'`.
- iOS ringer switch: set `navigator.audioSession.type = 'playback'` where it exists (Safari 17+), so sound plays with the
  switch on silent like other games; otherwise document that the switch mutes it.
- `visibilitychange` / `statechange`: suspend when hidden, resume (on the next tap if needed) when visible or after
  `interrupted` (calls, Siri).
- The theme: stream it through an `<audio>` element + `MediaElementAudioSourceNode` (loop points by `currentTime`), or
  decode a mono 22 kHz copy on mobile; either removes ~80 MB of PCM. Effects (0.1 MB) stay as buffers.

### 6. Menus, setup and panels by touch (M, risk low)

- Sandbox form, quiver page, settings drawer, co-op lobby, end screen at phone size: scrollable cards inside the
  safe area, sticky buttons kept visible, number steppers big enough, the room code field with
  `inputmode="text" autocapitalize="characters" autocomplete="off"`.
- Design and animation labs: touch-drag scrolling in place of the wheel (dev tools, can wait).

### 7. Performance on mid-range phones (M, risk medium: unknown until measured)

Target: steady 60 fps in a full battle level (many enemies, weather, fire) on a ~2022 mid-range phone (Pixel 6a,
Galaxy A54, iPhone 11/SE 3) and no thermal throttling in a 10-minute level.

- Measure first with phase 0's meter and Chrome remote DevTools / Safari Web Inspector; fix what the profile shows.
- Likely wins: cap the loop at 60 (`ticker.maxFPS = 60`, and the simulation uses `deltaMS` already); render resolution
  cap 2 on mobile (`MAX_RENDER_RESOLUTION` per mode); MSAA off on mobile (chosen at `app.init`, so at boot by pointer
  type) or off when resolution ≥ 2; cache static scenery (keeps, mountains) with `cacheAsTexture` like the clouds;
  fewer per-frame `Graphics.clear()` redraws for idle stickmen.
- A **Quality** setting in the drawer (Auto / High / Low): Low = resolution 1–1.5, no AA, arrow trails 0, fewer weather
  particles and gibs. Auto drops a step after a few seconds under ~50 fps.
- Pause the loop and audio when the tab is hidden (solo); co-op see next phase.

### 8. PWA / installable (M, risk medium: stale caches)

- `manifest.webmanifest` (name, icons 192/512 + maskable, `display: fullscreen`, `orientation: landscape`,
  background/theme colours), apple-touch-icon. Installed, it runs fullscreen and landscape on iPhone too.
- A service worker for offline play (solo): precache the built assets (hashed names from webpack, e.g.
  `workbox-webpack-plugin` `GenerateSW`), network-first for `index.html`, "New version — reload" toast on update.
- `/` and `/dev/` share one origin: give each its own manifest `id`/`scope` and register the production worker with
  scope `/` but have it skip `/dev/` requests (or register only `/dev/`'s own worker under `/dev/`), so the dev page is
  never served stale production files. `scripts/build-pages.sh` writes both.
- Optional, can come last or be dropped if the open question says no.

### 9. Co-op on mobile networks (M–L, risk high)

- **TURN**: PeerJS today uses only STUN; between two phones on cellular (CGNAT, symmetric NAT) a direct WebRTC
  connection often fails. Add `config.iceServers` with a TURN server. GitHub Pages is static, so TURN credentials would
  be public; options: a free-tier provider with a domain-restricted key (e.g. metered.ca), or a tiny worker (e.g.
  Cloudflare Worker + Cloudflare TURN) that issues short-lived credentials. Needs a decision and maybe a small budget.
- Clear errors: a connect timeout (~10 s) with "Couldn't reach the host — are you both online? Mobile data sometimes
  blocks this" instead of hanging.
- **Backgrounding**: a phone host that locks the screen freezes the room (rAF stops). On `visibilitychange` the host
  pauses everyone with a notice (`HostSync.sendPause`, reason "host away"); a guest that goes hidden is shown as away.
  Reconnect after a short drop (already on the "Not yet" list in `net/CLAUDE.md`): rejoin the same seat within ~30 s.
- Bandwidth/latency: measure frame size (`frame` every 50 ms, JSON) and send rate on a throttled profile (Chrome
  "Fast 4G", 150 ms RTT, 1 % loss); if it is over ~30 KB/s, trim snapshots (delta, rounding) before anything else.
- Joining: a share button (`navigator.share`) with a link `?join=CODE` that opens the lobby with the code filled.

### 10. Real-device pass and release (S, risk low)

- Device matrix: one recent iPhone (Safari), one older iPhone (SE / 11), one mid-range Android (Chrome), one tablet;
  each through the checklist below on `/dev/`. Then `/release`.

## Testing approach

- **Pure logic** (fit with safe areas and `MIN_VIEW_WIDTH`, pointer arbitration, pull → aim, quality auto-step) gets
  `*.test.ts` next to it, run by `npm run verify`.
- **Headless Chromium with device emulation** (phase 0 script): Playwright device descriptors for viewport, DPR,
  `hasTouch`, `isMobile`; taps with `page.touchscreen.tap`; drags and two-finger cases through CDP
  `Input.dispatchTouchEvent` (`touchStart` / `touchMove` / `touchEnd` with several `touchPoints`), because Playwright has
  no touch-drag API. State checked through `window.__towerGuard.scene` (`?debug`), not screenshots; one screenshot per
  device to look at the layout. Portrait → landscape by `page.setViewportSize`. Network: CDP
  `Network.emulateNetworkConditions` for co-op over `?net=local` between two pages. CPU: CDP
  `Emulation.setCPUThrottlingRate` 4× as a rough mid-range stand-in (fps numbers are only indicative; the real phone
  decides).
- **Real devices on `/dev/`** after each merged phase (it redeploys on every push to master): Android via
  `chrome://inspect` remote DevTools, iPhone via Safari Web Inspector on a Mac (or the `?fps` meter alone). Checklist:
  fits and fills the screen with the notch left/right, no zoom/scroll/selection on the field, rotate to portrait and back,
  sound after the first tap with the ringer on and off, a full level at 60 fps without heat, lock/unlock mid-battle,
  co-op phone ↔ desktop on Wi-Fi and phone ↔ phone on mobile data, install to the home screen (phase 8).

## Order and dependencies

0 → 1 → 2 → 3 → 4 make the game playable on a phone (touch mode auto-on after 4). 5 can go any time after 0 and is
small and high value (do it early). 6 and 7 follow; 7 may move up if phase 0 shows bad fps. 8 and 9 are independent of
each other and can run in parallel threads. Rough total: 9–12 working days.

| Phase | Effort | Risk |
|---|---|---|
| 0 Harness, `?fps`, `?touch` | S | low |
| 1 Page shell | S–M | low |
| 2 Layout, HUD | M | medium |
| 3 Touch aiming | M | medium |
| 4 Touch controls | M–L | medium |
| 5 Audio | S | low–medium |
| 6 Menus by touch | M | low |
| 7 Performance | M | medium |
| 8 PWA | M | medium |
| 9 Co-op on mobile | M–L | high |
| 10 Device pass | S | low |

## Open questions

1. **Devices**: which phones do you have to test on (iPhone, Android, both)? Is iPhone a must for the first release?
   Are tablets in scope?
2. **Portrait**: OK to support landscape only, with a "turn your phone" card?
3. **Narrower view on phones** (`MIN_VIEW_WIDTH` ~1200 instead of 1455): it shows a little less of the field ahead,
   in exchange for a bigger picture. Acceptable, or should phones see exactly what desktop sees (smaller)?
4. **Controls**: ◀ ▶ buttons for the left thumb (proposed), a virtual joystick, or tap-to-walk-there? Sprint as
   slide-out, a toggle, or always-on running on mobile?
5. **Trajectory preview** on by default in touch mode (it is off on desktop)? It makes the small-screen aim fair, but
   changes difficulty.
6. **PWA / offline**: worth it, or skip phase 8 for now?
7. **TURN for co-op**: OK to use a third-party TURN service (free tier, key visible in the page) or a small Cloudflare
   Worker for short-lived credentials? Or accept that some mobile networks can't connect?
8. Should a phone and a desktop play co-op together (assumed yes), and should the phone ever host?
