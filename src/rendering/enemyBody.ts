import type { Graphics } from 'pixi.js';
import { enemyArchetype } from '../data/enemyKinds';
import type { EnemyType } from '../types';
import type { BodyColors } from './bodyColors';
import { HUMAN_BODY, ZOMBIE_BODY } from './bodyColors';
import type { AttackStyle } from './attackSwing';
import type { JointPose } from './stickmanPose';
import { archerBody, attackBody, runBody, standBody, walkBody, withClub, type BodyPose } from './designs/bodyPoses';
import { banditArcherLook, goblinLook, raiderLook, sapperLook } from './designs/enemySkins';
import { ogreLook, zombieLook } from './designs/heavySkins';
import { drawHumanoid, type HumanoidLook } from './designs/skinKit';
import { drawLookGibs } from './designs/lookGibs';
import type { GibSimulation } from './stickmanGibs';

/**
 * Enemies drawn in their looks (rendering/designs) over the same poses drawStickman uses, so movement,
 * swings, falls and hitboxes are unchanged: fighter = raider, runner = goblin, archer = hooded bandit,
 * brute = ogre, kamikaze = sapper, zombie = rotting peasant.
 */

type GroundEnemy = Exclude<EnemyType, 'dragon' | 'fireDragon'>;

interface EnemyBodyLook {
  look: (timeMs: number) => HumanoidLook;
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
  /** Falls (sprite at originY, like drawJointPose), cheers and the pinned struggle. */
  | { mode: 'joints'; pose: JointPose; club: boolean };

const TWO_PI = Math.PI * 2;

const poseFor = (kind: EnemyType, state: EnemyBodyState): BodyPose => {
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
    case 'archer':
      return archerBody(state.localAngle, state.tension, state.ready, state.walkPhase === undefined ? undefined : state.walkPhase / TWO_PI);
    case 'joints':
      return state.club && club ? withClub(state.pose) : state.pose;
  }
};

/** Draws an enemy of `kind` into `sprite` (cleared first); sets the sprite's y like drawStickman would. */
export const drawEnemyBody = (sprite: Graphics, kind: EnemyType, state: EnemyBodyState, originY: number, timeMs: number): void => {
  sprite.clear();
  sprite.y = state.mode === 'joints' ? originY : originY - LIVE_POSE_LIFT;
  drawHumanoid(sprite, poseFor(kind, state), lookOf(kind).look(timeMs));
};

/** Draws a blown-apart enemy of `kind`: its look's own parts flying (rendering/designs/lookGibs). */
export const drawEnemyGibs = (sprite: Graphics, kind: EnemyType, simulation: GibSimulation, originY: number, timeMs: number): void => {
  const { look, gibs } = lookOf(kind);
  drawLookGibs(sprite, simulation, look(timeMs), gibs, originY);
};
