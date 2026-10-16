import type { Graphics } from 'pixi.js';
import { DESIGN_GAITS, type Gait } from './designSkeleton';
import { BEETLE_STRIDE, drawBeetle, drawSlime } from './ideaCreatures';
import { SPIDER_STRIDE, WARG_STRIDE, drawImp, drawSpider, drawWarg } from './ideaBeasts';
import { drawDwarf, drawLizardman, drawMyconid, drawTreant } from './ideaFolk';
import { drawCultist, drawFootman, drawGolem, drawOrc } from './ideaHumanoids';
import { drawMummy, drawSkeleton, drawWraith } from './ideaUndead';

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

/** Roughly from the most human to the least. */
export const ENEMY_DESIGNS: readonly EnemyDesign[] = [
  {
    id: 'footman',
    name: 'Footman',
    tagline: 'The body hidden in gear',
    description: 'Helmet with a visor slit and a red plume, breastplate over a tabard, mail and a kite shield carried in front; the sword rests on the far shoulder. Almost nothing of the body shows.',
    ...humanoid(DESIGN_GAITS.footman, 0.035, drawFootman),
  },
  {
    id: 'dwarf',
    name: 'Dwarf axeman',
    tagline: 'Half the height, twice the width',
    description: 'Short legs under a wide mail-clad body, a nasal helm, a red beard to the belt with two gold-capped braids swinging, a round shield slung on the back and a big axe resting on the shoulder. A rolling, stubborn walk.',
    ...humanoid(DESIGN_GAITS.dwarf, 0.035, drawDwarf),
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    tagline: 'The stickman with nothing on',
    description: 'Bare bones: a spine of vertebrae, ribs curving forward, a rag of a loincloth. The skull wears a dented half-helm, the jaw chatters and a cold blue pinpoint burns in the socket. A notched, rusty sword.',
    ...humanoid(DESIGN_GAITS.skeleton, 0.045, drawSkeleton),
  },
  {
    id: 'lizardman',
    name: 'Lizardman',
    tagline: 'A tail to balance on',
    description: 'Leans far forward over a long tail that sways behind; clawed feet, a pale belly, red spines down the back. A long snout with a yellow slit eye, a neck frill that flares now and then, and a bone-tipped spear held level.',
    ...humanoid(DESIGN_GAITS.lizardman, 0.05, drawLizardman),
  },
  {
    id: 'orc',
    name: 'Orc brute',
    tagline: 'A silhouette, not a skeleton',
    description: 'A huge hunched torso with a small tusked head jutting from the front, arms thick as legs hanging to the knees and a fur pauldron. Heavy, swaying steps.',
    ...humanoid(DESIGN_GAITS.orc, 0.03, drawOrc),
  },
  {
    id: 'mummy',
    name: 'Mummy',
    tagline: 'Wrapped, reaching, slow',
    description: 'Wound in old striped linen, one stiff arm reaching ahead, the other hanging. Loose bandage ends trail from the hip, elbow and head; a torn spot shows darkness inside, a green glint shines between the wraps and a gold amulet still hangs on the chest.',
    ...humanoid(DESIGN_GAITS.mummy, 0.02, drawMummy),
  },
  {
    id: 'cultist',
    name: 'Cultist',
    tagline: 'No limbs to see',
    description: 'A long robe that hides the legs (only the toes peek out under the swaying hem), a pointed hood with darkness and two glowing violet eyes inside, and a staff with a pulsing orb.',
    ...humanoid(DESIGN_GAITS.cultist, 0.025, drawCultist),
  },
  {
    id: 'wraith',
    name: 'Wraith',
    tagline: 'Nobody inside the cloak',
    description: 'A floating cloak whose hem frays into tails that stream back and fade. Inside the hood only two cold eyes; a bony hand reaches out of one sleeve, the other swings a lantern with a ghostly green flame.',
    speed: 0.03,
    draw: drawWraith,
  },
  {
    id: 'treant',
    name: 'Treant',
    tagline: 'A tree that walks',
    description: 'A trunk on two root-footed legs, bark grooves, a face of two dimly glowing hollows and a knot of a mouth. Branch arms fork into twigs, the leafy crown sways behind the step and now and then drops a leaf.',
    ...humanoid(DESIGN_GAITS.treant, 0.025, drawTreant),
  },
  {
    id: 'golem',
    name: 'Stone golem',
    tagline: 'Not made of flesh',
    description: 'Loose rocks held together by a glowing core: the joints are gaps with light in them, the head floats above the shoulders and moss grows on top. Slow and heavy.',
    ...humanoid(DESIGN_GAITS.golem, 0.025, drawGolem),
  },
  {
    id: 'myconid',
    name: 'Mushroom man',
    tagline: 'All hat',
    description: 'Knee-high: a pale stalk body on stubby legs, a beady-eyed face under a big red cap with white spots that bobs a beat behind every step. Puffs of spores drift up off the cap.',
    ...humanoid(DESIGN_GAITS.myconid, 0.03, drawMyconid),
  },
  {
    id: 'imp',
    name: 'Fire imp',
    tagline: 'Comes in the air',
    description: 'A small red devil hovering on fast-beating leathery wings, horns, a grin with one tooth, a curling spade tail and legs tucked under. Holds up a flickering fireball that sheds sparks.',
    speed: 0.06,
    draw: drawImp,
  },
  {
    id: 'warg',
    name: 'Warg',
    tagline: 'On four legs',
    description: 'A wolf the size of a pony, trotting on diagonal pairs: hackles up along the back, a bushy tail, upright ears, amber eyes and a jaw that keeps opening on bared teeth.',
    speed: 0.08,
    draw: walking(WARG_STRIDE, 0.08, drawWarg),
  },
  {
    id: 'beetle',
    name: 'War beetle',
    tagline: 'Six legs',
    description: 'A beetle the size of a man: a domed shell, six legs walking in a tripod gait (three on the ground at a time), snapping mandibles and twitching antennae.',
    speed: 0.05,
    draw: walking(BEETLE_STRIDE, 0.05, drawBeetle),
  },
  {
    id: 'spider',
    name: 'Giant spider',
    tagline: 'Eight legs',
    description: 'Eight high-kneed legs stepping in alternating sets of four, a big abdomen with red chevrons, a cluster of glowing red eyes, chewing fangs and feelers testing the ground ahead.',
    speed: 0.06,
    draw: walking(SPIDER_STRIDE, 0.06, drawSpider),
  },
  {
    id: 'slime',
    name: 'Slime',
    tagline: 'No skeleton at all',
    description: 'A hopping blob: squashes down, springs up stretched, lands with a wobble. A swallowed skull and arrow float inside it; it blinks now and then and drips in the air.',
    speed: 0.045,
    draw: drawSlime,
  },
];
