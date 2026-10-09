# Drawing (src/rendering)

Pure pose math lives next to the drawing and is tested (limb lengths, ground contact, loop continuity). Every new
animation gets a row in `scenes/labRows.ts` (or `scenes/labSequences.ts` for one-shot falls and gibs).

## Stickman core
- `drawStickman(sprite, phase, pose)` (`stickman.ts`): bowman, enemies and the animation lab all use it. `pose.skin`:
  `'skeleton'` (thin white bones, labs) or `'armored'` (`armor.ts`, `ArmorPalette`; no longer used in the game).
- **Walk and march** (`walkCycle.ts`): `walkFrame` is the natural walk (heel strike, roll, toe-off, `WALK_CYCLE_PX` per
  cycle); `march` (`marchKneeBend`, `MARCH_HALF_STRIDE`) for knights; the zombie's shuffle is the march dragged.
  `walkBody(p, { style })`, drawStickman's `walkStyle`; feet turned by `*ShinAngle`. Run: `runCycle.ts`.
- **Joint poses** (`stickmanPose.ts`): `JointPose` + `drawJointPose` (skeleton look, optional club). Falls and cheers
  produce them.
- **Falls** (`stickmanFall.ts`, by progress 0..1): `death` (face down), `deathCrumple` (sits, falls back), `deathStiff`
  (rigid backwards, analytic), `knockback`, `getUp` (from knockback's last pose). `getFallPose()` pure; `groundedAngle`
  keeps feet and hands on the ground.
- **Cheers** (`stickmanCheer.ts`): `cheerJump`, `cheerFist`, `cheerWave`, legs by two-bone IK.
- **Club attacks** (`attackSwing.ts`, keyframes by progress, `pose.attackStyle`): `overhead`, `twoHanded`, `uppercut`,
  `swordRise`, `thrust`, `grab`; `CLUBS` lengths; wind-up, strike with wrist snap (`clubTilt`, `forearmBend` ≥ 0),
  recovery; progress 0 and 1 = standing pose. `attackImpactProgress(style)`.
- **Pinned** (`stickmanPinned.ts`): leans on the free leg, rear foot at `PINNED_FOOT`. **Flail** (`stickmanFlail.ts`).
- **Gibs** (`stickmanGibs.ts`): `GibSimulation`, 10 pieces + blood, seeded; game force 1–1.7×, lab 1; lab figures
  clipped to their frame.
- **Archer** (`archer.ts`): `getArcherRig()`, pivots at the neck, drawn inside the sprite. `pose.bowReady` 0..1.
- **Armored pose** (`armoredPose.ts`): `drawArmoredJointPose` for the bowman's falls.

## Looks
- **Enemy bodies** (`enemyBody.ts`): `drawEnemyBody` builds the BodyPose with drawStickman's numbers and draws the look
  (fighter = raider, runner = goblin, archer = hooded bandit, brute = ogre, kamikaze = sapper, zombie = rotting peasant,
  knights in black plate, priest in a robe). Gibs in the look: `drawEnemyGibs` → `designs/lookGibs.ts`;
  `enemyGibColors`. Colours: `bodyColors.ts`.
- **Player** (`bowmanBody.ts`): ranger / keep warden from `designs/playerSkins.ts` (ranger: hood, cloak, sleeves =
  `limb`; warden: tabard = `limb`, helm = `plate`, tower = `gold`). Falls draw the bow in the rear hand
  (`bowInRearHand`).
- **Designs** (`designs/`): `bodyPoses.ts` (BodyPose for every animation, pure, tested), `skinKit.ts` (parts in
  torso/head frames), `drawHumanoid` / `HumanoidLook`; looks in `enemySkins.ts`, `heavySkins.ts`, `knightSkins.ts`,
  `playerSkins.ts`, `warhorse.ts`; ideas in `ideas.ts` (+ `ideaHumanoids.ts`, `ideaCreatures.ts`, `designSkeleton.ts`);
  catalogue `catalog.ts`.

## Dragons
- `dragon.ts`: `getDragonPose` (pure; wing beat, bob, neck and tail), `DRAGON_PALETTES` (`dark`, `red`),
  `dragonHitZones`. Riders: `'spear'`, `'unarmed'`, `'archer'` (`DRAGON_ARCHER_SHOT_MS`); rider is a JointPose astride,
  far leg via `drawRearLeg`, rest with `drawJointPose(..., { append: true, hideRearLeg: true })`. The near wing is
  drawn over the rider. Drawing in `dragonArt.ts` (`drawDragon`, `drawDragonRiderOnly`, `drawDragonWithRider`).
- `dragonFire.ts`: `breathControl` (rear back, thrust, jaw `pose.jaw`, `pose.mouth`, `FIRE_BREATH.flameMs`),
  `firePuffs` (~`FIRE_REACH`).
- `dragonDeath.ts` (pure, ground `GIB_GROUND_Y`, `dragonFallState` takes start height): `fall`, `explode`,
  `riderExplode`; `dragonRiderFall.ts` (thrown rider), `dragonGibs.ts` (~25 seeded chunks).

## Horse
`horseRider.ts` (`getHorsePose`, `assembleHorsePose` from a `HorseFrame`; walk 4 beats, gallop; hooves at
`HORSE_GROUND_Y`, IK knees/hocks), `horseDeath.ts` (`lieDown`, `drop`; `thrownRider`).

## Effects and world
- Burning flames (`burning.ts`: `burnFlames`, `burnSmoke`, `BURN_FLAME_SIZE`). Affliction art (`afflictionArt.ts`),
  vortex (`vortexArt.ts`).
- **Keep** (`keep.ts`): flat tower, 200×406 at half size (`TOWER_HEIGHT`), stone tinted by `keepTones`,
  `keepDamageStage` (cracks ≤60%, broken merlons/banners/rubble ≤30%, fire ≤10%), `keepHitParts` (pure).
- **Background** (`Background.ts`, `landscape.ts`): hills drawing is one `BACKDROP_WIDTH` stretch repeated, every other
  copy mirrored; scenery extends `SCENERY_MARGIN` past the ends; calls `useTerrain`. Clouds (`clouds.ts`, pure, seeded
  per map, cached as textures, higher = slower). Rain (`Rain.ts`, `RAIN_*`) and snow (`Snow.ts`, `SNOW_*`) are screen
  space and cover `MAX_VIEW_WIDTH`.
- **Aim overlay** (`AimOverlay.ts`): circles at the drag start (off by default, `session.showCursorCircle`) and at the
  bow; a ghost of the last shot stays where it was loosed.
