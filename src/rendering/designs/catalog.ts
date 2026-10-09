import type { Graphics } from 'pixi.js';
import { ENEMY_SPEED } from '../../config';
import { armoredFallPose, drawArmoredJointPose } from '../armoredPose';
import { ZOMBIE_BODY } from '../bodyColors';
import { DRAGON_PALETTES } from '../dragon';
import { drawDragonRider } from '../dragonArt';
import { FIRE_BREATH_MS, breathControl, drawFireStream } from '../dragonFire';
import { WALK_STRIDE_PER_RADIAN, drawStickman, type StickmanPose } from '../stickman';
import { getCheerPose, type CheerKind } from '../stickmanCheer';
import { FALL_DURATION_MS, getFallPose, type FallKind } from '../stickmanFall';
import { getPinnedPose } from '../stickmanPinned';
import type { JointPose } from '../stickmanPose';
import { RUN_STRIDE_PER_RADIAN } from '../runCycle';
import type { AttackStyle } from '../attackSwing';
import { archerBody, attackBody, castBody, runBody, walkBody, withClub, type BodyPose } from './bodyPoses';
import { banditArcherLook, goblinLook, raiderLook, sapperLook } from './enemySkins';
import { dragonArcherLook, dragonKnightLook, drawDragonWithRider, ogreLook, zombieLook } from './heavySkins';
import { ENEMY_DESIGNS } from './ideas';
import { blackKnightLook, darkPriestLook, hammerKnightLook } from './knightSkins';
import { drawMountedKnight } from './warhorse';
import { gaitGroundSpeed, getHorsePose, type HorsePose } from '../horseRider';
import { rangerLook, wardenLook } from './playerSkins';
import { drawHumanoid, type HumanoidLook } from './skinKit';
import { drawEnemyGibs } from '../enemyBody';
import { GibSimulation } from '../stickmanGibs';
import type { EnemyType } from '../../types';

/** One animation of a design: a tile in the zoomed view. */
export interface DesignView {
  label: string;
  draw: (g: Graphics, timeMs: number) => void;
  /** Ground scroll (px/ms) for moving animations. */
  speed?: number;
  /** Framing: scale on top of the tile's fit, and a shift right (figure units). */
  scale?: number;
  offsetX?: number;
}

export interface DesignEntry {
  /** Stable id used in the URL (?designs=<id>). */
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** The first is the card's; the zoomed view shows them all. */
  views: DesignView[];
  /** Dragons: no ground, framed to the dragon's size. */
  flying?: boolean;
  /** Shifts every view right (figure units) unless the view sets its own. */
  offsetX?: number;
}

export interface DesignSection {
  id: string;
  tab: string;
  intro: string;
  entries: DesignEntry[];
}

type LookAt = (timeMs: number) => HumanoidLook;

/** Ground speed per walk cycle (two steps): see walkBody. One run cycle covers 115 px. */
const WALK_CYCLE_PX = WALK_STRIDE_PER_RADIAN * Math.PI * 2;
const RUN_CYCLE_PX = RUN_STRIDE_PER_RADIAN * Math.PI * 2;
const SWING_MS = 1300;
const SWING_PAUSE_MS = 600;
const FALL_HOLD_MS = 1300;

const posed = (label: string, look: LookAt, pose: (timeMs: number) => BodyPose, speed?: number): DesignView => ({
  label,
  speed,
  draw: (g, timeMs) => {
    g.clear();
    drawHumanoid(g, pose(timeMs), look(timeMs));
  },
});

const walking = (look: LookAt, speed: number, club?: AttackStyle, zombie = false): DesignView =>
  posed(zombie ? 'Shuffle' : 'Walk', look, (t) => walkBody((t * speed) / WALK_CYCLE_PX, { club, zombie }), speed);
const running = (look: LookAt, speed: number, club?: AttackStyle): DesignView =>
  posed('Run', look, (t) => runBody((t * speed) / RUN_CYCLE_PX, club), speed);
const swinging = (label: string, look: LookAt, style: AttackStyle): DesignView =>
  posed(label, look, (t) => attackBody(Math.min(1, (t % (SWING_MS + SWING_PAUSE_MS)) / SWING_MS), style));

/** A fall played, held a moment, and played again. */
const fallProgress = (kind: FallKind, timeMs: number): number =>
  Math.min(1, (timeMs % (FALL_DURATION_MS[kind] + FALL_HOLD_MS)) / FALL_DURATION_MS[kind]);
/** Knocked down, a moment on the ground, back on his feet. */
const knockdownPose = (timeMs: number, lieMs = 500): JointPose => {
  const down = FALL_DURATION_MS.knockback;
  const up = FALL_DURATION_MS.getUp;
  const t = timeMs % (down + lieMs + up + FALL_HOLD_MS);
  return t < down + lieMs ? getFallPose('knockback', Math.min(1, t / down)) : getFallPose('getUp', Math.min(1, (t - down - lieMs) / up));
};
const falling = (label: string, look: LookAt, kind: FallKind): DesignView => posed(label, look, (t) => getFallPose(kind, fallProgress(kind, t)));
const knockdown = (look: LookAt): DesignView => posed('Knocked down, gets up', look, (t) => knockdownPose(t));
const cheering = (look: LookAt, kind: CheerKind, club?: boolean): DesignView =>
  posed('Cheers', look, (t) => {
    const pose: BodyPose = getCheerPose(kind, t);
    return club ? withClub(pose) : pose;
  });
const pinned = (look: LookAt): DesignView => posed('Pinned by the foot', look, (t) => getPinnedPose(t));

/** Blown apart by a direct explosive hit (the game's gib simulation, drawn in the enemy's look), on a loop. */
const GIB_LOOP_MS = 2800;
const blownApart = (kind: EnemyType): DesignView => ({
  label: 'Blown apart',
  // The pieces fly far back from a blast at the chest: framed smaller and shifted.
  scale: 0.55,
  offsetX: 130,
  draw: (g, t) => {
    const simulation = new GibSimulation({ x: 16, y: -20 }, 1 + Math.floor(t / GIB_LOOP_MS), 1);
    simulation.step(t % GIB_LOOP_MS);
    drawEnemyGibs(g, kind, simulation, 0, t);
  },
});

/** The mounted knight (or its riderless horse) in a horse pose; `speed` scrolls the ground at a gallop. */
const mounted = (label: string, pose: (timeMs: number) => HorsePose, speed?: number, riderless = false): DesignView => ({
  label,
  speed,
  scale: 0.62,
  offsetX: -22,
  draw: (g, timeMs) => {
    g.clear();
    drawMountedKnight(g, pose(timeMs), timeMs, { riderless });
  },
});

/** Enemy archer: raise the bow, draw, loose, lower; on a loop. */
const SHOT_MS = 2200;
const shooting = (look: LookAt): DesignView => posed('Draw and shoot', look, (t) => {
  const c = (t % SHOT_MS) / SHOT_MS;
  const ready = c < 0.88 ? Math.min(1, c * 5) : Math.max(0, 1 - (c - 0.88) * 8);
  const tension = c < 0.78 ? Math.max(0, Math.min(1, (c - 0.2) / 0.55)) : 0;
  return archerBody(-0.12, tension, ready);
});

/** A stickman look, for comparison: drawStickman (the enemies' old look, the player's current one). */
const now = (pose: (timeMs: number) => StickmanPose & { phase: number; tint?: number }, speed?: number, label = 'Old'): DesignView => ({
  label,
  speed,
  draw: (g, timeMs) => {
    const { phase, tint = 0xffffff, ...rest } = pose(timeMs);
    g.tint = tint;
    drawStickman(g, phase, { originY: 2, ...rest });
  },
});
const walkPhase = (timeMs: number, speed: number): number => (timeMs * speed) / WALK_STRIDE_PER_RADIAN;
const runPhase = (timeMs: number, speed: number): number => (timeMs * speed) / RUN_STRIDE_PER_RADIAN;

const FIGHTER_SPEED = ENEMY_SPEED / 1000;
const RUNNER_SPEED = (ENEMY_SPEED * 2.1) / 1000;
const BRUTE_SPEED = (ENEMY_SPEED * 0.6) / 1000;
const ARCHER_SPEED = (ENEMY_SPEED * 0.9) / 1000;
const KAMIKAZE_SPEED = (ENEMY_SPEED * 2) / 1000;
const ZOMBIE_SPEED = (ENEMY_SPEED * 0.45) / 1000;
const KNIGHT_SPEED = (ENEMY_SPEED * 0.85) / 1000;
const HAMMER_KNIGHT_SPEED = (ENEMY_SPEED * 0.65) / 1000;
const PRIEST_SPEED = (ENEMY_SPEED * 0.8) / 1000;
/** The priest's heal: the scepter raised, held, lowered, then a pause. */
const CAST_LOOP_MS = 1500;
const CAST_MS = 900;
/** The bowman's walking speed, px/ms. */
const PLAYER_SPEED = 0.12;
/** The goblin is three quarters of the player's height. */
const GOBLIN_SIZE = 0.75;

const fixed = (look: HumanoidLook): LookAt => () => look;

const ENEMIES: DesignEntry[] = [
  {
    id: 'fighter',
    name: 'Fighter → Raider',
    tagline: 'The basic enemy',
    description: 'The raider from the ideas, now on the fighter\'s own skeleton and moves: tunic, belt, bandana with flapping tails, a stubbled face. The club is now a real one: a gripped handle, a head that thickens towards the end and an iron band, held in the fist exactly where the game holds it.',
    views: [
      walking(raiderLook, FIGHTER_SPEED, 'overhead'),
      swinging('Club swing', raiderLook, 'overhead'),
      falling('Death', raiderLook, 'death'),
      cheering(raiderLook, 'cheerFist', true),
      pinned(raiderLook),
      blownApart('basic'),
      now((t) => ({ phase: walkPhase(t, FIGHTER_SPEED), armed: true }), FIGHTER_SPEED),
    ],
  },
  {
    id: 'runner',
    name: 'Runner → Goblin',
    tagline: 'Fast, fragile',
    description: 'Three quarters of the player\'s height (the game would draw it at ENEMY_LOOKS size 0.75, like brutes at 1.5). The goblin sprints with the game\'s run cycle: flight phases, high knees and pumping arms, the big head hanging low and the ears flapping. Instead of a club it carries a rusty dagger and stabs up from below (the runner\'s uppercut).',
    views: [
      ...[
        running(goblinLook, RUNNER_SPEED / GOBLIN_SIZE, 'uppercut'),
        swinging('Dagger stab', goblinLook, 'uppercut'),
        falling('Death', goblinLook, 'deathCrumple'),
        cheering(goblinLook, 'cheerJump', true),
        knockdown(goblinLook),
      ].map((view) => ({ ...view, scale: GOBLIN_SIZE })),
      blownApart('fast'),
      now((t) => ({ phase: runPhase(t, RUNNER_SPEED), running: true, armed: true, attackStyle: 'uppercut' }), RUNNER_SPEED),
    ],
  },
  {
    id: 'archer',
    name: 'Archer → Hooded bandit',
    tagline: 'Shoots from range',
    description: 'A red hood and shoulder cape (the enemy archers\' red), a dark scarf over the face so only the eyes show, a leather vest and a quiver on the back. Same archer rig as the player: the bow comes up, the string is drawn to the cheek with the arrow on it, then loosed.',
    views: [
      shooting(fixed(banditArcherLook())),
      posed('Walk', fixed(banditArcherLook()), (t) => archerBody(0, 0, 0, (t * ARCHER_SPEED) / WALK_CYCLE_PX), ARCHER_SPEED),
      falling('Headshot', fixed(banditArcherLook()), 'deathStiff'),
      cheering(fixed(banditArcherLook()), 'cheerWave'),
      blownApart('archer'),
      now((t) => {
        const c = (t % SHOT_MS) / SHOT_MS;
        return { phase: 0, idleBlend: 1, archerPose: true, bowReady: Math.min(1, c * 5), bowTension: Math.max(0, Math.min(1, (c - 0.2) / 0.55)), tint: 0xffc2b4 };
      }),
    ],
  },
  {
    id: 'brute',
    name: 'Brute → Ogre',
    tagline: 'Slow, tough, hits hard',
    description: 'A huge belly and hump, a small bald head sunk between the shoulders with an underbite and two little tusks, a spotted hide loincloth and a log studded with nails, swung with both hands. Drawn at normal size here; the game draws brutes half again as tall.',
    views: [
      walking(fixed(ogreLook()), BRUTE_SPEED, 'twoHanded'),
      swinging('Two-handed chop', fixed(ogreLook()), 'twoHanded'),
      knockdown(fixed(ogreLook())),
      falling('Death', fixed(ogreLook()), 'deathCrumple'),
      cheering(fixed(ogreLook()), 'cheerFist', true),
      blownApart('tank'),
      now((t) => ({ phase: walkPhase(t, BRUTE_SPEED), armed: true, attackStyle: 'twoHanded' }), BRUTE_SPEED),
    ],
  },
  {
    id: 'kamikaze',
    name: 'Kamikaze → Sapper',
    tagline: 'Runs in and blows up',
    description: 'A wiry sapper in a scorched leather apron with brass goggles, singed spiky hair and a mad grin, wrapped in sticks of dynamite taped round his chest and back. He runs in with a stick in each hand, the one in front already lit and spitting sparks.',
    views: [
      running(sapperLook, KAMIKAZE_SPEED),
      knockdown(sapperLook),
      cheering(sapperLook, 'cheerJump'),
      pinned(sapperLook),
      blownApart('kamikaze'),
      now((t) => ({ phase: runPhase(t, KAMIKAZE_SPEED), running: true, bomb: true }), KAMIKAZE_SPEED),
    ],
  },
  {
    id: 'zombie',
    name: 'Zombie → Rotting peasant',
    tagline: 'Slow, grabs',
    description: 'Pale green skin in a torn shirt with a hole over the ribs, one trouser leg ripped off at the knee and one shoe lost, lank hair, a sunken eye with a pale glint and a hanging jaw dripping green. Keeps the arms-out shuffle and the lunge-and-yank grab.',
    views: [
      walking(zombieLook, ZOMBIE_SPEED, undefined, true),
      swinging('Grab', zombieLook, 'grab'),
      falling('Death', zombieLook, 'death'),
      cheering(zombieLook, 'cheerWave'),
      pinned(zombieLook),
      blownApart('zombie'),
      now((t) => ({ phase: walkPhase(t, ZOMBIE_SPEED), zombie: true, bodyColors: ZOMBIE_BODY }), ZOMBIE_SPEED),
    ],
  },
  {
    id: 'knight',
    name: 'Black knight',
    tagline: 'Armoured: aim for the visor',
    description: 'Black plate from helm to sabatons: a closed great helm with two embers glowing through the visor slit and a dark red plume, a spiked pauldron, tassets over the thighs and a torn red cape. A longsword with a crossguard where the fighter holds his club. Body hits glance off the plate (only a third gets through); headshots and piercing arrows go through.',
    views: [
      walking(blackKnightLook, KNIGHT_SPEED, 'overhead'),
      swinging('Sword cut', blackKnightLook, 'overhead'),
      swinging('Rising cut', blackKnightLook, 'swordRise'),
      swinging('Thrust', blackKnightLook, 'thrust'),
      falling('Headshot', blackKnightLook, 'deathStiff'),
      knockdown(blackKnightLook),
      cheering(blackKnightLook, 'cheerFist', true),
      pinned(blackKnightLook),
      blownApart('knight'),
    ],
  },
  {
    id: 'hammer-knight',
    name: 'Hammer knight',
    tagline: 'Armoured, a head taller',
    description: 'The black knight\'s bigger brother (drawn at normal size here; the game draws him 1.1 times as tall): heavier plate with rivets, broad spiked pauldrons, a horned helm and a long cape, and a war hammer with a spiked iron head swung in both hands like the brute\'s log.',
    views: [
      walking(hammerKnightLook, HAMMER_KNIGHT_SPEED, 'twoHanded'),
      swinging('Hammer blow', hammerKnightLook, 'twoHanded'),
      knockdown(hammerKnightLook),
      falling('Death', hammerKnightLook, 'deathCrumple'),
      cheering(hammerKnightLook, 'cheerFist', true),
      blownApart('hammerKnight'),
    ],
  },
  {
    id: 'horse-knight',
    name: 'Mounted knight',
    tagline: 'A lance from beyond a sword\'s reach',
    description: 'The black knight on a black warhorse: a dark red caparison with a black hem, a steel chamfron with a spike and an ember eye, the mane and tail near black. He carries a lance with a red pennant and a steel vamplate over his fist, and from a standstill drives it at a man\'s chest well past the horse\'s head. Killed, he is thrown off and fights on foot; the horse bolts.',
    views: [
      mounted('Gallop', (t) => getHorsePose(t, 'gallop', { thrust: 0 }), gaitGroundSpeed('gallop')),
      mounted('Lance thrust', (t) => getHorsePose(t, 'stand', { thrust: Math.min(1, (t % (SWING_MS + SWING_PAUSE_MS)) / SWING_MS) })),
      mounted('Standing', (t) => getHorsePose(t, 'stand', { thrust: 0 })),
      mounted('Cheers', (t) => getHorsePose(t, 'stand', { thrust: 0, raised: true })),
      mounted('Riderless, bolting', (t) => getHorsePose(t, 'gallop'), gaitGroundSpeed('gallop'), true),
    ],
  },
  {
    id: 'priest',
    name: 'Dark priest',
    tagline: 'Heals the others: kill it first',
    description: 'A deep hood over a gaunt pale face with red eyes, a black-purple robe to the shins with a crimson stripe and sash, a bone pendant, and a scepter topped with a little skull and a red orb. It never attacks: it follows behind the soldiers and raises the scepter to heal them (the orb flares); the undead are beyond its magic.',
    views: [
      {
        label: 'Heal',
        draw: (g, t) => {
          const progress = Math.min(1, (t % CAST_LOOP_MS) / CAST_MS);
          g.clear();
          drawHumanoid(g, castBody(progress), darkPriestLook(t, Math.sin(Math.PI * progress)));
        },
      },
      walking(darkPriestLook, PRIEST_SPEED, 'overhead'),
      falling('Death', darkPriestLook, 'death'),
      cheering(darkPriestLook, 'cheerWave', true),
      blownApart('priest'),
    ],
  },
  {
    id: 'dragon-archer',
    name: 'Dragon archer rider',
    tagline: 'The dragon stays, the rider changes',
    description: 'The dragons already aren\'t stickmen, so only their riders change. The dragon archer\'s rider is the hooded bandit, in a dark violet hood to go with the near-black dragon, drawing and loosing from the saddle (his far leg hidden behind the dragon, as now).',
    flying: true,
    offsetX: 20,
    views: [
      { label: 'Flying, shooting', draw: (g, t) => drawDragonWithRider(g, t, 'archer', dragonArcherLook(), DRAGON_PALETTES.dark) },
      { label: 'Old', draw: (g, t) => drawDragonRider(g, t, 'archer', undefined, DRAGON_PALETTES.dark) },
    ],
  },
  {
    id: 'fire-dragon',
    name: 'Fire dragon rider',
    tagline: 'A dragon knight',
    description: 'The fire dragon\'s rider becomes a knight in dark iron with a horned helm (an ember glowing in the visor slit) and a red cape streaming behind, both fists on reins that now actually run to the dragon\'s neck.',
    flying: true,
    offsetX: 20,
    views: [
      { label: 'Flying', draw: (g, t) => drawDragonWithRider(g, t, 'unarmed', dragonKnightLook(t), DRAGON_PALETTES.red) },
      {
        label: 'Fire breath',
        scale: 0.8,
        offsetX: -240,
        draw: (g, t) => {
          const since = (t % (1200 + FIRE_BREATH_MS)) - 1200;
          const pose = drawDragonWithRider(g, t, 'unarmed', dragonKnightLook(t), DRAGON_PALETTES.red, undefined, breathControl(since, 0.55));
          drawFireStream(g, pose.mouth.point, pose.mouth.angle, since);
        },
      },
      { label: 'Old', draw: (g, t) => drawDragonRider(g, t, 'unarmed', undefined, DRAGON_PALETTES.red) },
    ],
  },
];

/** Player bow cycle: raise, draw slowly, hold, loose, lower. */
const PLAYER_SHOT_MS = 2600;
const playerShot = (t: number): { ready: number; tension: number } => {
  const c = (t % PLAYER_SHOT_MS) / PLAYER_SHOT_MS;
  return {
    ready: c < 0.85 ? Math.min(1, c * 5) : Math.max(0, 1 - (c - 0.85) * 7),
    tension: c < 0.72 ? Math.max(0, Math.min(1, (c - 0.18) / 0.45)) : 0,
  };
};

const playerViews = (look: (timeMs: number, moving: number) => HumanoidLook): DesignView[] => [
  posed('Draw and loose', (t) => look(t, 0), (t) => {
    const { ready, tension } = playerShot(t);
    return archerBody(-0.25, tension, ready);
  }),
  posed('Standing, bow lowered', (t) => look(t, 0), () => archerBody(0, 0, 0)),
  posed('Walk', (t) => look(t, 1), (t) => archerBody(0, 0, 0, (t * PLAYER_SPEED) / WALK_CYCLE_PX), PLAYER_SPEED),
  knockdown((t) => ({ ...look(t, 0), bow: undefined })),
];

const PLAYER: DesignEntry[] = [
  {
    id: 'player-now',
    name: 'Old: armored archer',
    tagline: 'The player before',
    description: 'The player as he was, for comparison: the stickman skeleton with thick dark limbs, hood, armor plates, quiver and bow drawn over it (colours changed per battleground).',
    views: [
      now((t) => {
        const { ready, tension } = playerShot(t);
        return { phase: 0, idleBlend: 1, archerPose: true, skin: 'armored', bowReady: ready, bowTension: tension, bowAngle: -0.25 };
      }, undefined, 'Old'),
      now(() => ({ phase: 0, idleBlend: 1, archerPose: true, bowReady: 0, skin: 'armored' }), undefined, 'Old'),
      now((t) => ({ phase: walkPhase(t, PLAYER_SPEED), archerPose: true, bowReady: 0, skin: 'armored' }), PLAYER_SPEED, 'Old'),
      {
        label: 'Knocked down, gets up',
        draw: (g, t) => {
          const down = FALL_DURATION_MS.knockback;
          const phase = t % (down + 500 + FALL_DURATION_MS.getUp + FALL_HOLD_MS);
          const pose = phase < down + 500
            ? armoredFallPose('knockback', Math.min(1, phase / down))
            : armoredFallPose('getUp', Math.min(1, (phase - down - 500) / FALL_DURATION_MS.getUp));
          drawArmoredJointPose(g, pose);
        },
      },
    ],
  },
  {
    id: 'ranger',
    name: 'Ranger',
    tagline: 'Player 1',
    description: 'A woodland ranger: green hood with the face in its shadow, a cloak that streams out behind him as he walks, a leather jerkin with a crossed strap and bracers, a quiver of white-fletched arrows and a pale longbow. In the game: player 1. Every animation stays (same archer rig); the hood, cloak and sleeves take the battleground\'s player colour (shown here in green).',
    views: playerViews(rangerLook),
  },
  {
    id: 'warden',
    name: 'Keep warden',
    tagline: 'Player 2 in co-op',
    description: 'A soldier of the keep he defends: a steel kettle helm over a mail coif, a blue tabard with the keep\'s gold tower (the same tower as the one behind him), padded sleeves, leather gloves and a dark recurve bow. In the game: the second player in co-op. The tabard takes the battleground\'s player colour, the helm its plate (bronze for player 2) and the tower its trim.',
    views: playerViews(() => wardenLook()),
  },
];

const IDEAS: DesignEntry[] = ENEMY_DESIGNS.map((design) => ({
  id: `idea-${design.id}`,
  name: design.name,
  tagline: design.tagline,
  description: design.description,
  views: [{ label: 'Walk', draw: design.draw, speed: design.speed }],
}));

export const DESIGN_SECTIONS: readonly DesignSection[] = [
  { id: 'enemies', tab: 'Enemies', intro: 'Every enemy as it looks in the game now, over its own moves. Click one for all its animations and the old stickman.', entries: ENEMIES },
  { id: 'player', tab: 'Player', intro: 'The player looks: the ranger (player 1) and the keep warden (player 2 in co-op), next to the old armored archer.', entries: PLAYER },
  { id: 'ideas', tab: 'Ideas', intro: 'Proposals for new enemy looks, each a step further from the stickman (not tied to an enemy yet).', entries: IDEAS },
];
