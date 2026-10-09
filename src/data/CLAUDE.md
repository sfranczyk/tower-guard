# Game data (src/data)

All pure and tested. Tuning numbers live in `config.ts`, sandbox defaults in `sandbox.ts`.

- **Enemy catalogue** (`enemyKinds.ts`): every enemy (`EnemyType`, the id saved in setups and sent in co-op) is an entry
  in `ENEMY_KINDS`: an **archetype** (how it fights: `fighter`, `runner`, `heavy`, `archer`, `kamikaze`, `grabber`,
  `skyArcher`, `fireBreather`, `healer`, `cavalry`; `ARCHETYPES` says whether it carries a club, runs, shoots, detonates,
  flies, breathes fire, heals, rides), a **race** (`human`, `goblin`, `ogre`, `undead`, `dragon`; `RACES` give the traits:
  mass (a fighter 1.2; how a vortex takes it), freeze and pin durations, burn factor, healable), **magical** (dragons),
  plus its stats, damage, keep damage, build (size, strike reach, optional `reach`: how close it comes to strike) and
  `arrival` (where in a level it starts to come). Gameplay code asks `enemyArchetype(type)` and `enemyTraits(type)` (race
  traits with the variant's overrides), never the id; looks stay per variant (`rendering/enemyBody.ts`, `ICON_ENEMIES`).
  A new variant is one entry here plus its look and icon (see the `/new-enemy` skill).
  Now: fighter, archer, kamikaze, the three knights, priest = human; runner = goblin; brute = ogre; zombie = undead; both
  dragons = dragon. An entry may have `armor` (`enemyArmor`): the share of an arrow's body hit that gets through.
- **Toughness and damage** (`enemies.ts`): health per type against a 20-damage arrow (headshot
  ×`ARROWS.headshotMultiplier` = 1.25): fighter 35, runner 22, archer 24 (one headshot), brute 110, dragon 170.
  `ENEMY_DAMAGE` gives each type a random range (`rollDamage`) for club swings and, for shooters, their arrows
  (`Arrow.shooter` tells CombatSystem whose arrow hit). The keep (2000 by default) takes the same
  × `KEEP_DAMAGE_MULTIPLIER` per attack (1, except archer arrows 0.5, brute 2, kamikaze 8); read ranges with
  `enemyDamage(type, attack, target)`. `mountedDamage` shares a hit between rider and horse (see objects/CLAUDE.md).
  Splash gib chance: `splashGibChance` / `blowsApart`, `SPLASH_GIB_CHANCE`.
- **Enemy looks** (`ENEMY_LOOKS` in `enemies.ts`): size, club swing and gait per type. The walk/run phase advances with
  the distance covered (`Enemy.stridePhase`, `WALK_STRIDE_PER_RADIAN`, `MARCH_STRIDE_PER_RADIAN` /
  `RUN_STRIDE_PER_RADIAN` × body scale), so feet stay planted at any speed and size; `stepMs` only sets the sway of
  standing poses. Runners run, are 0.75× tall and stab from below; brutes are 1.5× tall (container scale, so hitboxes
  and arrow anchors scale too; the health bar keeps its size) and chop two-handed with a long club. Strike reach:
  runner 45, fighter 55, brute 85 px.
- **Projectiles** (`projectiles.ts`): each type has a mass, head drag and speed multiplier: launch speed
  ∝ speedMultiplier/√mass and drag ∝ dragMultiplier/mass. Gravity is the same for every type (keep it so). Piercing is
  light (fast, flat, long), explosive heavy (short high arc). Behaviour in systems/CLAUDE.md.
- **Battlegrounds** (`battlegrounds.ts`): map themes (sky, sun, hills, tree style, ground colors, `ui: { accent,
  backdrop }`, `player` ArmorPalette picked to contrast with the map, tested; aim colours via
  `aimColorsOf(battleground)`, `DEFAULT_AIM_COLORS`, an optional `halo`). Add a map by adding an entry. `weather`:
  `fair` (cumulus, stratus, cirrus), `clear` (Sunscorch Dunes), `storm` (Thunder Ridge: storm deck, no sun, lightning,
  light rain) or `snow` (Frostpeak Pass: `hillShape: 'mountains'`, snowy pines, `terrainAmplitude` 26, `terrainWaviness`
  1.5, and `wind`: each level rolls one up to it, px/s², part of `FlightParams`; the status line shows it).
- **Sandbox** (`sandbox.ts`, `loadout.ts`): settings are pure data, `normalizeSandbox` clamps everything and still reads
  pre-rename setups (`waves`, `waveCount`). `SandboxSettings.loadout`: five weapon slots (`LOADOUT_SLOTS`), any arrows,
  each at most once, slots may stay empty. Persisted by `core/sandboxStorage.ts`.
