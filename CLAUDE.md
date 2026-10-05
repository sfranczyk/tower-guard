# Tower Guard

2D side-view tower defense in the browser. The player is a stickman archer guarding the left keep;
enemy waves walk in from the enemy keep on the right. PixiJS 8 + TypeScript (strict), bundled with webpack.

## Commands

- `npm run dev`: dev server on http://localhost:8080 (add `?debug` to show hitboxes)
- `npm run check`: type-check (`tsc --noEmit`, includes noUnusedLocals/Parameters)
- `npm test`: Vitest unit tests (`*.test.ts` next to the code)
- `npm run build`: production build to `dist/`

Before finishing a change, run `npm run check && npm test`. For anything visual, also run the game.

## Architecture

```
src/
  main.ts              bootstrap: Pixi app, textures, canvas fit, DomUi, SceneManager
  config.ts            all tuning constants (speeds, damage, gravity, world size)
  types/               shared types: Vec2, Rect, Bounds, level/wave data
  core/                Scene base class, SceneManager, GameContext/GameSession
  scenes/              MenuScene, GameScene (one level), AnimationLabScene (animation previews)
  systems/             gameplay logic: CombatSystem, EffectsSystem, WaveSpawner, collision (pure)
  rendering/           stickman renderer (pure drawing), Background, AimOverlay
  objects/             Pixi display objects with their own state: Bowman, Enemy, Arrow, Tower
  managers/            InputManager (keyboard + drag-to-aim), LevelManager (level data)
  data/                game data helpers (enemy stats per type and difficulty)
  ui/                  DomUi (HTML overlay: menus, HUD, settings, end screen) + template.ts
```

- **Scenes**: extend `Scene` from `core/Scene.ts`. Register window listeners with `listenWindow()`
  and teardown with `onExit()` so cleanup runs automatically. `ctx.goTo('menu' | 'game' | 'animationLab')`
  switches scenes, and `SceneManager` destroys everything under `ctx.root` on each switch.
- **Persistent state** between levels lives in `ctx.session` (level number, gold, bow tension).
  `MenuScene` resets it.
- **UI** is HTML over the canvas (`ui/template.ts`, styles in `index.html`). Scenes never touch the DOM
  directly. They call `DomUi` methods and assign `ui.handlers.*` callbacks.
- **Stickman drawing** goes through `drawStickman(sprite, phase, pose)` in `rendering/stickman.ts`.
  Bowman, enemies and the animation lab all use it. Preview animation changes in the lab
  (menu → "Open animation test panel").
- **Coordinates**: the screen is 1024×540 and the world is wider (`WORLD_WIDTH`). `GameScene` scrolls the
  `world` container by `cameraX`. The ground is at `GROUND_Y`.

## Conventions

- Keep pure logic (math, collision, data) free of Pixi/DOM imports so it can be unit-tested.
- New tuning numbers go in `config.ts`, and new level content goes in `managers/LevelManager.ts`.
- Aim for files of roughly 150–400 lines. Split by responsibility rather than growing `GameScene`.
- Game text in the UI is English.

## Known issues

- `Bowman.updateAnimation` passes bow rotation as `bowTension` and aim power as `bowAngle` (see the FIXME).
  This looks swapped, but it's kept so the archer looks unchanged. Fixing it changes the archer's arm pose.
- The toolbar title in `ui/template.ts` always says "The First Wave".
