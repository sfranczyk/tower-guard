import type { Graphics } from 'pixi.js';
import { enemyArchetype } from '../data/enemyKinds';
import type { EnemyType } from '../types';
import type { BodyColors } from './bodyColors';
import { HUMAN_BODY, ZOMBIE_BODY } from './bodyColors';
import type { AttackStyle } from './attackSwing';
import type { JointPose } from './stickmanPose';
import { archerBody, attackBody, castBody, runBody, standBody, walkBody, withClub, type BodyPose } from './designs/bodyPoses';
import { banditArcherLook, goblinLook, raiderLook, sapperLook } from './designs/enemySkins';
import { ogreLook, zombieLook } from './designs/heavySkins';
import { blackKnightLook, darkPriestLook, hammerKnightLook } from './designs/knightSkins';
import { drawHumanoid, type HumanoidLook } from './designs/skinKit';
import { drawLookGibs } from './designs/lookGibs';
import type { GibSimulation } from './stickmanGibs';
import type { HorsePose } from './horseRider';
import { drawMountedKnight } from './designs/warhorse';

/**
 * Enemies drawn in their looks (rendering/designs) over the same poses drawStickman uses, so movement,
 * swings, falls and hitboxes are unchanged: fighter = raider, runner = goblin, archer = hooded bandit,
 * brute = ogre, kamikaze = sapper, zombie = rotting peasant; the black knight, hammer knight and dark priest as they are;
 * the mounted knight is the black knight on a warhorse (designs/warhorse.ts) in the 'mounted' state.
 */

type GroundEnemy = Exclude<EnemyType, 'dragon' | 'fireDragon'>;

interface EnemyBodyLook {
  /** Its look now (`cast` 0..1: how far into a spell, for the priest's glowing scepter). */
  look: (timeMs: number, cast: number) => HumanoidLook;
  /** What it carries in the game: a club style, or nothing (archers, kamikazes and zombies). */
  club?: AttackStyle;
  /** Colours of the pieces when blown apart, and of the blood. */
  gibs: BodyColors;
}

const fixed = (look: HumanoidLook) => (): HumanoidLook => look;

const LOOKS: Readonly<Record<GroundEnemy, EnemyBodyLook>> = {
  basic: { look: raiderLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0xd9a074, boneRear: 0x7b5233 } },
  fast: { look: goblinLook, club: 'uppercut', gibs: { ...HUMAN_BODY, bone: 0x86b04b, boneRear: 0x5f8a36 } },
  tank: { look: fixed(ogreLook()), club: 'twoHanded', gibs: { ...HUMAN_BODY, bone: 0xb59a6a, boneRear: 0x8f784f } },
  archer: { look: fixed(banditArcherLook()), gibs: { ...HUMAN_BODY, bone: 0xd2a07a, boneRear: 0x9a3a32 } },
  kamikaze: { look: sapperLook, gibs: { ...HUMAN_BODY, bone: 0xe0b48c, boneRear: 0xc0392b } },
  zombie: { look: zombieLook, gibs: { ...ZOMBIE_BODY, bone: 0x9fb38a, boneRear: 0x5b6b7a } },
  knight: { look: blackKnightLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0x2a2c33, boneRear: 0x18191e } },
  hammerKnight: { look: hammerKnightLook, club: 'twoHanded', gibs: { ...HUMAN_BODY, bone: 0x2a2c33, boneRear: 0x18191e } },
  horseKnight: { look: blackKnightLook, gibs: { ...HUMAN_BODY, bone: 0x2a2c33, boneRear: 0x18191e } },
  priest: { look: darkPriestLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0x2b1d2e, boneRear: 0xcfc4b0 } },
};

const lookOf = (kind: EnemyType): EnemyBodyLook => LOOKS[kind as GroundEnemy] ?? LOOKS.basic;

/** Blood and the colours of the pieces of a blown-apart enemy. */
export const enemyGibColors = (kind: EnemyType): BodyColors => lookOf(kind).gibs;

/**
 * Where drawStickman puts the feet relative to the hip (55) and where the BodyPoses do (57): live poses
 * are drawn this much higher so they stand on the same ground.
 */
const LIVE_POSE_LIFT = 2;

/** What the enemy is doing, in drawStickman's terms (phase in radians, one cycle = 2π). */
export type EnemyBodyState =
  | { mode: 'walk'; phase: number; running: boolean }
  | { mode: 'stand'; phase: number }
  | { mode: 'attack'; progress: number; style: AttackStyle }
  | { mode: 'archer'; localAngle: number; tension: number; ready: number; walkPhase?: number }
  /** A spell (the priest's heal), progress 0..1. */
  | { mode: 'cast'; progress: number }
  /** Falls (sprite at originY, like drawJointPose), cheers and the pinned struggle. */
  | { mode: 'joints'; pose: JointPose; club: boolean }
  /** On horseback (sprite at originY: the hooves stand where a fall's feet lie); `riderless` once he's been thrown. */
  | { mode: 'mounted'; pose: HorsePose; riderless?: boolean };

type HumanState = Exclude<EnemyBodyState, { mode: 'mounted' }>;

const TWO_PI = Math.PI * 2;

const poseFor = (kind: EnemyType, state: HumanState): BodyPose => {
  const { club } = lookOf(kind);
  // Grabbers (zombies) walk and stand with their arms held out.
  const zombie = enemyArchetype(kind).attackStyle === 'grab';
  switch (state.mode) {
    case 'walk':
      // drawStickman's run cycle runs 0.4 ahead of its walk phase (see runProgress there).
      return state.running
        ? runBody(state.phase / TWO_PI + 0.4, club, 0)
        : walkBody(state.phase / TWO_PI, { club, zombie, lean: 0 });
    case 'stand':
      return zombie ? attackBody(0, 'grab') : standBody(club);
    case 'attack':
      return attackBody(state.progress, zombie ? 'grab' : state.style);
    case 'cast':
      return castBody(state.progress);
    case 'archer':
      return archerBody(state.localAngle, state.tension, state.ready, state.walkPhase === undefined ? undefined : state.walkPhase / TWO_PI);
    case 'joints':
      return state.club && club ? withClub(state.pose) : state.pose;
  }
};

/** Draws an enemy of `kind` into `sprite` (cleared first); sets the sprite's y like drawStickman would. */
export const drawEnemyBody = (sprite: Graphics, kind: EnemyType, state: EnemyBodyState, originY: number, timeMs: number): void => {
  sprite.clear();
  sprite.y = state.mode === 'joints' || state.mode === 'mounted' ? originY : originY - LIVE_POSE_LIFT;
  if (state.mode === 'mounted') {
    drawMountedKnight(sprite, state.pose, timeMs, { riderless: state.riderless });
    return;
  }
  const cast = state.mode === 'cast' ? Math.sin(Math.PI * state.progress) : 0;
  drawHumanoid(sprite, poseFor(kind, state), lookOf(kind).look(timeMs, cast));
};

/** Draws a blown-apart enemy of `kind`: its look's own parts flying (rendering/designs/lookGibs). */
export const drawEnemyGibs = (sprite: Graphics, kind: EnemyType, simulation: GibSimulation, originY: number, timeMs: number): void => {
  const { look, gibs } = lookOf(kind);
  drawLookGibs(sprite, simulation, look(timeMs, 0), gibs, originY);
};
