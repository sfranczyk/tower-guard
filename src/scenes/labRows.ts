import type { Graphics } from 'pixi.js';
import type { AttackStyle } from '../rendering/attackSwing';
import { STANDING_BURN_POINTS, drawBurning } from '../rendering/burning';
import { DRAGON_PALETTES } from '../rendering/dragon';
import { drawDragonRider } from '../rendering/dragonArt';
import { DRAGON_DEATH_MS, drawDragonDeath, type DragonDeathKind } from '../rendering/dragonDeath';
import { FIRE_BREATH_MS, breathControl, drawFireStream } from '../rendering/dragonFire';
import { drawHorseRider } from '../rendering/horseRider';
import { drawStickman } from '../rendering/stickman';
import { drawStickmanCheer } from '../rendering/stickmanCheer';
import { getFlailPose } from '../rendering/stickmanFlail';
import { drawPinnedStruggle } from '../rendering/stickmanPinned';
import { drawJointPose } from '../rendering/stickmanPose';
import { FallClock, GibReplay, RUN_PHASE_MS, WALK_PHASE_MS } from './labSequences';

/**
 * The animation lab's catalogue: every animation once, on the bare skeleton (the dragon as it is in the game),
 * grouped by what it is for. The player and the enemies share these moves; their looks are in the design lab.
 */

/** What every row draws from: one clock for the loops plus the one-shot falls and gibs. */
export class LabClock {
  public timeMs = 0;
  public readonly falls = new FallClock();
  public readonly gibs = new GibReplay();

  public update(deltaMs: number): void {
    this.timeMs += deltaMs;
    this.falls.update(deltaMs);
    this.gibs.update(deltaMs);
  }

  public get walkPhase(): number {
    return this.timeMs / WALK_PHASE_MS;
  }

  public get runPhase(): number {
    return this.timeMs / RUN_PHASE_MS;
  }

  /** Club swings: one every ~1.1 s, straight after each other. */
  public get swingPhase(): number {
    return this.timeMs / 180;
  }
}

export interface LabRow {
  /** Stable id used in the URL (?lab=<id>). */
  id: string;
  title: string;
  description: string;
  /** Draws the current frame; `originY: 0` keeps the hip at the sprite origin. */
  render: (sprite: Graphics, clock: LabClock) => void;
  /** Shifts the figure right (unscaled units) for animations that travel left, so they stay centred. */
  offsetX?: number;
  /** Flying animations get no ground line. */
  flying?: boolean;
  /** Dragons are drawn over the sky (the dark one disappears on the slate the skeleton needs). */
  sky?: boolean;
  /** Scale overrides for animations that spread wide (default: the lab's preview and zoom scales). */
  previewScale?: number;
  zoomScale?: number;
}

export interface LabCategory {
  /** Also accepted in the URL (?lab=<category id>) to open its tab. */
  id: string;
  tab: string;
  intro: string;
  rows: LabRow[];
}

/** Dragons are drawn smaller to fit their wings. */
const DRAGON = { flying: true, sky: true, previewScale: 0.17, zoomScale: 1.15, offsetX: 25 } as const;
const DRAGON_DEATH = { sky: true, previewScale: 0.12, zoomScale: 1, offsetX: 85 } as const;
const DRAGON_DEATH_PAUSE_MS = 1200;
/** The horse and rider stand twice as tall as a stickman: drawn smaller, centred on the horse. */
const HORSE = { previewScale: 0.25, zoomScale: 1.45, offsetX: -12 } as const;

/** Fire breath: a moment of plain flight before each breath, aimed this far (radians) below level. */
const FIRE_BREATH_PAUSE_MS = 1200;
const FIRE_BREATH_AIM = 0.55;

/** Bow: raise, draw, loose, every ~1.4 s. */
const BOW_CYCLE_MS = 1400;

/** Zombie grab: a bit slower than the club swings, with a pause in the stance between grabs. */
const zombieGrabPhase = (timeMs: number): number => {
  const cycle = (timeMs % 2200) / 1500;
  return cycle >= 1 ? 0 : Math.max(0.001, cycle * Math.PI * 2);
};

/** Burning: catches fire, burns for a while, burns out, a pause, again. */
const BURN = { catchMs: 250, burnMs: 3000, fadeMs: 700, pauseMs: 900 };
const burnIntensity = (timeMs: number): number => {
  const { catchMs, burnMs, fadeMs, pauseMs } = BURN;
  const t = timeMs % (catchMs + burnMs + fadeMs + pauseMs);
  if (t < catchMs) {
    return t / catchMs;
  }
  return t < catchMs + burnMs ? 1 : Math.max(0, 1 - (t - catchMs - burnMs) / fadeMs);
};

const dragonDeath = (kind: DragonDeathKind) => (sprite: Graphics, clock: LabClock): void => {
  drawDragonDeath(sprite, clock.timeMs % (DRAGON_DEATH_MS + DRAGON_DEATH_PAUSE_MS), kind);
};

const swing = (attackStyle: AttackStyle) => (sprite: Graphics, clock: LabClock): void => {
  drawStickman(sprite, 0, { idleBlend: 1, armed: true, attackStyle, attackPhase: clock.swingPhase, originY: 0 });
};

export const LAB_CATEGORIES: readonly LabCategory[] = [
  {
    id: 'movement',
    tab: 'Movement',
    intro: 'Standing, walking, running, riding and flying. Click one to zoom in.',
    rows: [
      {
        id: 'stand',
        title: 'Stand',
        description: 'Standing still, swaying a little. Everyone waits like this between moves.',
        render: (sprite, clock) => drawStickman(sprite, clock.timeMs / 400, { idleBlend: 1, originY: 0 }),
      },
      {
        id: 'walk',
        title: 'Walk',
        description: 'The walk cycle, with a bounce on each step. Fighters, brutes and zombies walk at their own speeds.',
        render: (sprite, clock) => drawStickman(sprite, clock.walkPhase, { originY: 0 }),
      },
      {
        id: 'run',
        title: 'Run',
        description: 'Contact, push-off, heel kick, high knee drive and a short flight phase. Runners, kamikazes and the bowman sprinting.',
        render: (sprite, clock) => drawStickman(sprite, clock.runPhase, { running: true, originY: 0 }),
      },
      {
        id: 'walk-bow',
        title: 'Walk with the bow lowered',
        description: 'The bowman and the enemy archers: bow held low ahead, the free arm swinging with the steps.',
        render: (sprite, clock) => drawStickman(sprite, clock.walkPhase, { archerPose: true, bowReady: 0, originY: 0 }),
      },
      {
        id: 'zombie-shuffle',
        title: 'Zombie shuffle',
        description: 'Leaning forward with both arms held out in front, swaying a little while it shuffles.',
        render: (sprite, clock) => drawStickman(sprite, clock.timeMs / 240, { zombie: true, originY: 0 }),
      },
      {
        id: 'horse-walk',
        title: 'Riding: walk',
        description: 'A stickman on a horse at a walk: four even beats (hind, fore, the other hind, the other fore), the head nodding with each step; the rider sits upright, feet in the stirrups, hands on the reins.',
        ...HORSE,
        render: (sprite, clock) => drawHorseRider(sprite, clock.timeMs, 'walk'),
      },
      {
        id: 'horse-gallop',
        title: 'Riding: gallop',
        description: 'The same horse at a gallop: both hind hooves, then both fore, then a moment with all four off the ground; the body rocks, the neck pumps and the tail streams. The rider leans forward and rises a little with each stride.',
        ...HORSE,
        render: (sprite, clock) => drawHorseRider(sprite, clock.timeMs, 'gallop'),
      },
      {
        id: 'dragon-flight',
        title: 'Dragon flight',
        description: 'Wing beat (the far wing a beat behind), bobbing up on each downstroke, neck and tail undulating; the rider sits astride.',
        ...DRAGON,
        render: (sprite, clock) => drawDragonRider(sprite, clock.timeMs, 'unarmed', undefined, DRAGON_PALETTES.red),
      },
    ],
  },
  {
    id: 'combat',
    tab: 'Combat',
    intro: 'Shooting, club swings, grabs and the dragons’ attacks.',
    rows: [
      {
        id: 'bow',
        title: 'Bow: raise, draw, loose',
        description: 'Raises the bow, draws the string and looses. The bowman and enemy archers share the rig.',
        render: (sprite, clock) => {
          const cycle = (clock.timeMs % BOW_CYCLE_MS) / BOW_CYCLE_MS;
          drawStickman(sprite, 0, {
            idleBlend: 1,
            archerPose: true,
            bowReady: Math.min(1, cycle * 5),
            bowTension: Math.max(0, Math.min(1, (cycle - 0.2) / 0.6)),
            originY: 0,
          });
        },
      },
      {
        id: 'club-overhead',
        title: 'Club: overhead',
        description: 'One-handed: winds up behind the head, strikes down with a lunge and dip, recovers to the stance. Fighters, and the black knights\' downward cut.',
        render: swing('overhead'),
      },
      {
        id: 'club-two-handed',
        title: 'Club: two-handed',
        description: 'A long club in both hands: a big wind-up far behind the head, then a heavy chop into a deep lunge. Brutes.',
        render: swing('twoHanded'),
      },
      {
        id: 'club-uppercut',
        title: 'Club: uppercut',
        description: 'A short club from below: crouched wind-up behind the hip, then up and forward while stepping in. Runners.',
        render: swing('uppercut'),
      },
      {
        id: 'sword-rise',
        title: 'Sword: rising cut',
        description: 'Blade lowered behind the hip in a crouch, then swept up and forward through the target onto the front foot. Black knights.',
        render: swing('swordRise'),
      },
      {
        id: 'sword-thrust',
        title: 'Sword: thrust',
        description: 'Draws the sword back by the chest with the point forward, then drives it straight out in a long lunge. Black knights.',
        render: swing('thrust'),
      },
      {
        id: 'zombie-grab',
        title: 'Zombie grab',
        description: 'Lunges in reaching further, then yanks both hands back to the chest; the hit lands on the yank.',
        render: (sprite, clock) => drawStickman(sprite, clock.timeMs / 240, {
          idleBlend: 1, zombie: true, attackPhase: zombieGrabPhase(clock.timeMs), originY: 0,
        }),
      },
      {
        id: 'dragon-archer',
        title: 'Dragon archer',
        description: 'The rider aims down ahead, draws and looses an arrow every 1.6 s.',
        ...DRAGON,
        render: (sprite, clock) => drawDragonRider(sprite, clock.timeMs, 'archer', undefined, DRAGON_PALETTES.dark),
      },
      {
        id: 'fire-breath',
        title: 'Fire breath',
        description: 'Rears the head back, then thrusts it forward with the jaw wide open and pours fire down ahead for 2.6 s.',
        flying: true,
        sky: true,
        previewScale: 0.075,
        zoomScale: 0.36,
        offsetX: -380,
        render: (sprite, clock) => {
          const since = (clock.timeMs % (FIRE_BREATH_PAUSE_MS + FIRE_BREATH_MS)) - FIRE_BREATH_PAUSE_MS;
          const pose = drawDragonRider(sprite, clock.timeMs, 'unarmed', undefined, DRAGON_PALETTES.red, breathControl(since, FIRE_BREATH_AIM));
          drawFireStream(sprite, pose.mouth.point, pose.mouth.angle, since);
        },
      },
    ],
  },
  {
    id: 'hurt',
    tab: 'Hurt',
    intro: 'Knocked down, pinned, burning, caught in a vortex: hurt but still alive.',
    rows: [
      {
        id: 'knockback',
        title: 'Knockback and getting up',
        description: 'Thrown backwards by a blast onto the back, a moment on the ground, then sits up and stands. Killed by it, he stays lying.',
        offsetX: 54,
        render: (sprite, clock) => clock.falls.renderKnockbackGetUp(sprite),
      },
      {
        id: 'pinned',
        title: 'Pinned by the foot',
        description: 'A pinning arrow holds one foot: leans on the free leg, the stuck one yanks him back, looks down at it, tries again.',
        render: (sprite, clock) => drawPinnedStruggle(sprite, clock.timeMs, 0),
      },
      {
        id: 'burning',
        title: 'On fire',
        description: 'Flames lick up from the feet, knees, hip, chest and head with smoke rising; catches quickly, burns out at the end.',
        render: (sprite, clock) => {
          drawStickman(sprite, clock.timeMs / 400, { idleBlend: 1, originY: 0 });
          drawBurning(sprite, STANDING_BURN_POINTS, clock.timeMs, burnIntensity(clock.timeMs));
        },
      },
      {
        id: 'flail',
        title: 'Flailing in a vortex',
        description: 'Lifted up the funnel and thrown through the air: arms windmilling, legs kicking, head lolling.',
        flying: true,
        render: (sprite, clock) => drawJointPose(sprite, getFlailPose(clock.timeMs)),
      },
    ],
  },
  {
    id: 'death',
    tab: 'Death',
    intro: 'How everyone dies; each plays once, holds the last pose and replays.',
    rows: [
      {
        id: 'death-collapse',
        title: 'Collapse forward',
        description: 'Knees buckle, drops to the knees, then collapses face down where it stood. Clubbed or shot.',
        render: (sprite, clock) => clock.falls.render(sprite, 'death'),
      },
      {
        id: 'death-crumple',
        title: 'Crumple backwards',
        description: 'Recoils from the hit, the legs give way, sits down and falls onto the back. Any hit, burnt.',
        offsetX: 29,
        render: (sprite, clock) => clock.falls.render(sprite, 'deathCrumple'),
      },
      {
        id: 'death-stiff',
        title: 'Stiff fall',
        description: 'Head snaps back and the rigid body topples backwards around the feet, with a small bounce. Headshot, lightning.',
        offsetX: 54,
        render: (sprite, clock) => clock.falls.render(sprite, 'deathStiff'),
      },
      {
        id: 'blown-apart',
        title: 'Blown apart',
        description: 'A direct explosive hit: head, torso, arms and legs fly, spin, bounce and settle, with blood.',
        // Pieces fly up to ~350 units back and ~210 up (measured over many seeds): framed to fit.
        offsetX: 155,
        previewScale: 0.3,
        zoomScale: 1,
        render: (sprite, clock) => clock.gibs.render(sprite),
      },
      {
        id: 'dragon-fall',
        title: 'Dragon falls, rider thrown off',
        description: 'The wings freeze, the dragon drops nose-down and lies flat; the rider is flung off and ends on his back.',
        ...DRAGON_DEATH,
        render: dragonDeath('fall'),
      },
      {
        id: 'dragon-explosion',
        title: 'Dragon blown apart',
        description: 'About twenty-five chunks burst out, bounce, tip over and settle; the rider bursts apart with blood.',
        ...DRAGON_DEATH,
        render: dragonDeath('explode'),
      },
      {
        id: 'dragon-rider-explosion',
        title: 'Rider blown apart',
        description: 'Only the rider is blown apart, from saddle height; the dragon falls and lies flat.',
        ...DRAGON_DEATH,
        render: dragonDeath('riderExplode'),
      },
    ],
  },
  {
    id: 'cheer',
    tab: 'Cheer',
    intro: 'The enemies cheer like this when they win.',
    rows: [
      {
        id: 'cheer-jump',
        title: 'Jump',
        description: 'Crouches, springs up with both arms thrown into a V and lands softly.',
        render: (sprite, clock) => drawStickmanCheer(sprite, 'cheerJump', clock.timeMs, 0),
      },
      {
        id: 'cheer-fist',
        title: 'Fist pump',
        description: 'Pumps a fist overhead with the other hand on the hip, dipping at the knees with each “yes!”.',
        render: (sprite, clock) => drawStickmanCheer(sprite, 'cheerFist', clock.timeMs, 0),
      },
      {
        id: 'cheer-wave',
        title: 'Wave',
        description: 'Both arms up, waving side to side while swaying and bouncing on the toes.',
        render: (sprite, clock) => drawStickmanCheer(sprite, 'cheerWave', clock.timeMs, 0),
      },
    ],
  },
];
