import type { Graphics } from 'pixi.js';
import { DESIGN_GAITS, type Gait } from './designSkeleton';
import { BEETLE_STRIDE, drawBeetle, drawSlime } from './ideaCreatures';
import { drawCultist, drawFootman, drawGoblin, drawGolem, drawOrc, drawRaider } from './ideaHumanoids';

/** A new enemy look in the design lab (not in the game yet). */
export interface EnemyDesign {
  /** Stable id used in the URL (?designs=<id>). */
  id: string;
  name: string;
  /** How far from a stickman it has moved. */
  tagline: string;
  description: string;
  /** Walking speed (px/ms) the lab scrolls the ground at. */
  speed: number;
  /** Draws the frame at `timeMs` (sprite space as drawStickman: ground at y 58, facing +x). */
  draw: (g: Graphics, timeMs: number) => void;
}

type WalkDrawer = (g: Graphics, p: number, timeMs: number) => void;

/** The walk progress follows the distance covered, so planted feet move with the scrolling ground. */
const walking = (stride: number, speed: number, drawer: WalkDrawer) => (g: Graphics, timeMs: number): void =>
  drawer(g, (timeMs * speed) / (4 * stride), timeMs);

const humanoid = (gait: Gait, speed: number, drawer: WalkDrawer) => ({ speed, draw: walking(gait.stride, speed, drawer) });

/** In order, each a step further from the stickman. */
export const ENEMY_DESIGNS: readonly EnemyDesign[] = [
  {
    id: 'raider',
    name: 'Raider',
    tagline: 'Step 1 · a stickman with flesh on',
    description: 'The stickman\'s skeleton and proportions, but with tapered limbs, hands and boots, a tunic, belt and bandana, a face and a club. Reads as a person, not a diagram.',
    ...humanoid(DESIGN_GAITS.raider, 0.045, drawRaider),
  },
  {
    id: 'goblin',
    name: 'Goblin',
    tagline: 'Step 2 · new proportions',
    description: 'Short legs, long arms, a hunched pot-bellied body and a head as big as its chest, with long flapping ears, a hooked nose and yellow slit eyes. Quick, scuttling steps and a rusty dagger.',
    ...humanoid(DESIGN_GAITS.goblin, 0.055, drawGoblin),
  },
  {
    id: 'footman',
    name: 'Footman',
    tagline: 'Step 3 · the body hidden in gear',
    description: 'Helmet with a visor slit and a red plume, breastplate over a tabard, mail and a kite shield carried in front; the sword rests on the far shoulder. Almost nothing of the body shows.',
    ...humanoid(DESIGN_GAITS.footman, 0.035, drawFootman),
  },
  {
    id: 'orc',
    name: 'Orc brute',
    tagline: 'Step 4 · a silhouette, not a skeleton',
    description: 'A huge hunched torso with a small tusked head jutting from the front, arms thick as legs hanging to the knees and a fur pauldron. Heavy, swaying steps.',
    ...humanoid(DESIGN_GAITS.orc, 0.03, drawOrc),
  },
  {
    id: 'cultist',
    name: 'Cultist',
    tagline: 'Step 5 · no limbs to see',
    description: 'A long robe that hides the legs (only the toes peek out under the swaying hem), a pointed hood with darkness and two glowing violet eyes inside, and a staff with a pulsing orb.',
    ...humanoid(DESIGN_GAITS.cultist, 0.025, drawCultist),
  },
  {
    id: 'golem',
    name: 'Stone golem',
    tagline: 'Step 6 · not made of flesh',
    description: 'Loose rocks held together by a glowing core: the joints are gaps with light in them, the head floats above the shoulders and moss grows on top. Slow and heavy.',
    ...humanoid(DESIGN_GAITS.golem, 0.025, drawGolem),
  },
  {
    id: 'beetle',
    name: 'War beetle',
    tagline: 'Step 7 · not a human shape',
    description: 'A beetle the size of a man: a domed shell, six legs walking in a tripod gait (three on the ground at a time), snapping mandibles and twitching antennae.',
    speed: 0.05,
    draw: walking(BEETLE_STRIDE, 0.05, drawBeetle),
  },
  {
    id: 'slime',
    name: 'Slime',
    tagline: 'Step 8 · no skeleton at all',
    description: 'A hopping blob: squashes down, springs up stretched, lands with a wobble. A swallowed skull and arrow float inside it; it blinks now and then and drips in the air.',
    speed: 0.045,
    draw: drawSlime,
  },
];
