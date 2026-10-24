# Tower Guard

2D side-view tower defense in the browser. The player is a stickman archer guarding the left keep; enemy waves walk in
from beyond the enemy keep on the right. PixiJS 8 + TypeScript (strict), bundled with webpack. Online co-op for two.

## Commands

- `npm run dev`: dev server on http://localhost:8080 (or `$PORT`). URL flags:
  - `?debug`: hitboxes; `window.__towerGuard.scene` is the running `GameScene`
    (e.g. `scene.enemies[0].takeDamage(999, { cause: 'headshot', fromX: 0 })`).
  - `?lab`, `?lab=<tab>` (e.g. `death`), `?lab=<id>` (e.g. `run`; ids in `scenes/labRows.ts`): animation lab.
  - `?designs`, `?designs=<tab or id>` (e.g. `player`, `raider`): design lab.
  - `?sounds`: sound test panel. `?coop` / `?coop=4`: local 2–4-bowman test. `?net=local`: co-op between tabs (host + up to 3).
- `npm run verify`: type-check + tests, prints only errors and failures (use this, not `check`/`test` separately).
- `npm run build`: production build to `dist/`.

## Layout

Each directory with a `CLAUDE.md` describes its features in detail; it loads when you read files there.

```
src/
  main.ts       bootstrap: Pixi app, textures, canvas fit, DomUi, SceneManager
  config/       all tuning constants by area (world, scenery, arrows, enemies, bowman, battle, audio); import `config`
  core/         Scene, SceneManager, GameContext/GameSession, viewport, camera, sandboxStorage, urlState
  scenes/       Menu, Sandbox, Game (+ BattleArrows, BattleCamera, levelEnd, PlayerControl), labs, Coop lobby
  systems/      gameplay logic: CombatSystem (+ EnemyAI, ArrowHits, ArrowMagic), waves, ballistics, vortex, …
  objects/      Pixi objects with state: DragonEnemy, Arrow, Tower, AfflictionLayer; enemy/ (Enemy + parts),
                bowman/ (Bowman + parts)
  rendering/    pure drawing and pose math: stickman, falls, cheers, gibs, dragons, horse, keep, designs/ (looks)
  data/         enemy catalogue and stats, projectiles, battlegrounds, sandbox, loadout
  net/          co-op (2–4 players): Transport, RoomHub, seats, HostSync, GuestSync, protocol, coopLink
  input/        PlayerInput (Local / Manual / Recording)
  managers/     InputManager (keyboard + drag-to-aim)
  ui/           DomUi (HTML overlay), Hud, SandboxForm, quiver page, CoopPanel, SoundLabPanel, icons, template
  audio/        SoundManager, MusicPlayer, settings, spatial mix
```

## Core rules

- **Run → Level → Wave**: a *run* is one game from setup to victory or defeat (`RunState`), 1–5 *levels* (own map and
  enemies, `LevelSetup`), each releasing its enemies in *waves* (`WaveDirector`). Same names in UI and code.
- **Scenes** never touch the DOM: they call `DomUi` and assign `ui.handlers.*`. Only menus, the settings drawer and the
  end screen overlay the canvas; the HUD sits outside it.
- **Coordinates**: the view is `viewWidth()`×`GAME_HEIGHT` (680, world y `VIEW_TOP`..`VIEW_BOTTOM`; never use `GAME_WIDTH` for anything spanning the screen), the
  battlefield `worldWidth()` (`systems/battlefield.ts`: 2400 in battle, 1800 in survival; keeps at `playerKeepX()` /
  `enemyKeepX()`, never the `PLAYER_TOWER_X` / `ENEMY_TOWER_X` defaults at run time). Anything touching the ground uses
  `groundAt(x)`, not `GROUND_Y`.
- **Flight**: one ballistics (`systems/ballistics.ts`) for arrows, the trajectory preview, the aim camera and enemy aim.
- **Enemies** are entries in `data/enemyKinds.ts`; gameplay asks `enemyArchetype(type)` / `enemyTraits(type)`, never
  the id.
- **Co-op is host-authoritative**: anything new the host decides (hits, states, effects) must reach the guest as an
  event or in the snapshot (`net/CLAUDE.md`).
- **Drawing**: stickmen through `drawStickman` / `BodyPose`, looks in `rendering/designs/`. Every new animation gets a
  lab row (`scenes/labRows.ts`), every new look a design-lab entry.

## Conventions

- Pure logic (math, collision, data) has no Pixi/DOM imports and a `*.test.ts` next to it.
- New tuning numbers go in `config/<area>.ts`, sandbox defaults in `data/sandbox.ts`.
- Files of roughly 150–400 lines; split by responsibility rather than growing `GameScene` or `Enemy`.
- Game text in the UI is English.
- Branching and releases: see below.

## Trunk and releases

Trunk-based: `master` is the trunk and is always releasable.

- Work lands on master in small commits, straight or through a branch that lives under a day (one feature or fix,
  merged as soon as `npm run verify` and CI pass; no long-lived branches). Unfinished work stays unreachable from the
  menu (URL flag, lab row, sandbox option) instead of waiting on a branch.
- CI (`.github/workflows/ci.yml`) verifies and builds every PR and branch push.
- Two pages from one GitHub Pages site (`.github/workflows/deploy-page.yml`, `scripts/build-pages.sh`):
  **development** at `/dev/` = master, redeployed on every push; **production** at `/` = the latest `v*` tag.
  Both share one origin, so localStorage (settings, sandbox, tuning) is shared too.
- Developer tools (labs, `?tune`, `?debug`, `?coop`, `?net=local`, the menu's Dev tools row) exist only in local and
  `/dev/` builds: production is built with `npm run build:release`, which turns `DEV_TOOLS` (`core/devTools.ts`) off.
  Read new dev-only URL flags with `getDevUrlParam`, gate other dev-only UI on `DEV_TOOLS`.
- Production changes only through `/release` (version tag on master, rollback = new higher tag). Never tag unasked.

## Working economically

Token use matters on this project. Follow these every session:

- **Find before reading**: grep for symbols; read files over ~300 lines with offset/limit around what you need.
- **Skills** hold the file checklists: `/new-enemy`, `/new-arrow`, `/new-animation`, `/verify`, `/release`. Use them instead of
  exploring the codebase to find where things go.
- **Plan first** (plan mode) when a feature touches more than ~3 files or adds a new system; small changes go straight in.
- **Effort**: for mechanical work (numbers, renames, small fixes) lower the session's effort/model yourself and say so;
  raise it again for design work.
- **Verify cheaply**: `npm run verify`; for visuals open the exact view (`?lab=<id>`, `?designs=<id>`, `?debug` +
  console setup) in a background tab, one screenshot at scale 0.5, check state with `javascript_tool` rather than
  screenshots. When a check needs several screenshots, run it in a subagent and keep only its verdict.
- **Feedback in one round**: after the first visible version of a feature, ask the user for all remarks at once.
  Tuning the user can do themselves goes through the tuning panel (`?tune`, see `ui/CLAUDE.md`), so give them the
  knobs rather than iterating on numbers.
- **Docs stay a map**: after a feature, add or fix 1–3 lines in the relevant `src/<dir>/CLAUDE.md` (what, where, key
  names). Explanations go in code comments. Touch this root file only for a new directory or a project-wide rule.
- **One feature per session**: when a feature is committed, or when the context-size hook warns, tell the user and
  offer to clear the session (only clear after they agree; leave a handoff note in the commit message or reply if work
  remains).
