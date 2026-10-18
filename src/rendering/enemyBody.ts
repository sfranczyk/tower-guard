import type { Graphics } from 'pixi.js';
import { ENEMY_KINDS, enemyArchetype } from '../data/enemyKinds';
import type { UnitType } from '../types';
import type { BodyColors } from './bodyColors';
import { HUMAN_BODY, ZOMBIE_BODY } from './bodyColors';
import type { AttackStyle } from './attackSwing';
import type { JointPose } from './stickmanPose';
import { archerBody, attackBody, bandageBody, castBody, runBody, standBody, walkBody, withBanner, withClub, type BodyPose } from './designs/bodyPoses';
import { banditArcherLook, goblinBomberLook, goblinLook, raiderLook, sapperLook } from './designs/enemySkins';
import { ogreLook, trollLook, zombieLook } from './designs/heavySkins';
import { blackKnightLook, darkPriestLook, heavyKnightLook } from './designs/knightSkins';
import { shamanLook } from './designs/shamanSkin';
import { allyKnightLook, medicLook, squireLook } from './designs/allySkins';
import { drawHumanoid, type HumanoidLook } from './designs/skinKit';
import { drawLookGibs } from './designs/lookGibs';
import type { GibSimulation } from './stickmanGibs';
import type { HorsePose } from './horseRider';
import { drawMountedKnight } from './designs/warhorse';

/**
 * Enemies drawn in their looks (rendering/designs) over the same poses drawStickman uses, so movement,
 * swings, falls and hitboxes are unchanged: raider, runner = goblin, hunter = hooded archer,
 * brute = ogre, troll, kamikaze = sapper, goblin kamikaze = goblin bomber, zombie = rotting peasant; the black knight, heavy knight and dark priest as they are, the goblin shaman;
 * the mounted knight is the black knight on a warhorse (designs/warhorse.ts) in the 'mounted' state.
 */

type GroundEnemy = Exclude<UnitType, 'dragon' | 'fireDragon'>;

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
  raider: { look: raiderLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0xd9a074, boneRear: 0x7b5233 } },
  fast: { look: goblinLook, club: 'uppercut', gibs: { ...HUMAN_BODY, bone: 0x86b04b, boneRear: 0x5f8a36 } },
  tank: { look: fixed(ogreLook()), club: 'twoHanded', gibs: { ...HUMAN_BODY, bone: 0xb59a6a, boneRear: 0x8f784f } },
  troll: { look: fixed(trollLook()), club: 'twoHanded', gibs: { ...HUMAN_BODY, bone: 0x7f8f74, boneRear: 0x5d6b55 } },
  hunter: { look: fixed(banditArcherLook()), gibs: { ...HUMAN_BODY, bone: 0xd2a07a, boneRear: 0x9a3a32 } },
  kamikaze: { look: sapperLook, gibs: { ...HUMAN_BODY, bone: 0xe0b48c, boneRear: 0xc0392b } },
  goblinKamikaze: { look: goblinBomberLook, gibs: { ...HUMAN_BODY, bone: 0x86b04b, boneRear: 0x26262c } },
  zombie: { look: zombieLook, gibs: { ...ZOMBIE_BODY, bone: 0x9fb38a, boneRear: 0x5b6b7a } },
  knight: { look: blackKnightLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0x2a2c33, boneRear: 0x18191e } },
  heavyKnight: { look: heavyKnightLook, club: 'twoHanded', gibs: { ...HUMAN_BODY, bone: 0x2a2c33, boneRear: 0x18191e } },
  horseKnight: { look: blackKnightLook, gibs: { ...HUMAN_BODY, bone: 0x2a2c33, boneRear: 0x18191e } },
  priest: { look: darkPriestLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0x2b1d2e, boneRear: 0xcfc4b0 } },
  shaman: { look: shamanLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0x86b04b, boneRear: 0x6b4a32 } },
  // The player's soldiers (designs/allySkins.ts).
  squire: { look: fixed(squireLook()), club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0xe0b48c, boneRear: 0x2f5d9a } },
  allyKnight: { look: allyKnightLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0xc9d0da, boneRear: 0x2f5d9a } },
  medic: { look: medicLook, club: 'overhead', gibs: { ...HUMAN_BODY, bone: 0xf2efe6, boneRear: 0xc0392b } },
};

const lookOf = (kind: UnitType): EnemyBodyLook => LOOKS[kind as GroundEnemy] ?? LOOKS.raider;

/** Blood and the colours of the pieces of a blown-apart enemy. */
export const enemyGibColors = (kind: UnitType): BodyColors => lookOf(kind).gibs;

/**
 * Where drawStickman puts the feet relative to the hip (55) and where the BodyPoses do (57): live poses
 * are drawn this much higher so they stand on the same ground.
 */
const LIVE_POSE_LIFT = 2;

/** What the enemy is doing, in drawStickman's terms (phase in radians, one cycle = 2π). */
export type EnemyBodyState =
  | { mode: 'walk'; phase: number; running: boolean; banner?: boolean }
  | { mode: 'stand'; phase: number; banner?: boolean }
  | { mode: 'attack'; progress: number; style: AttackStyle }
  | { mode: 'archer'; localAngle: number; tension: number; ready: number; walkPhase?: number }
  /** A spell (the priest's heal), progress 0..1. */
  | { mode: 'cast'; progress: number }
  /** The medic bandaging: `kneel` 0 standing … 1 down, `timeMs` turns the hands. */
  | { mode: 'bandage'; kneel: number; timeMs: number }
  /** Falls (sprite at originY, like drawJointPose), cheers and the pinned struggle. */
  | { mode: 'joints'; pose: JointPose; club: boolean }
  /** On horseback (sprite at originY: the hooves stand where a fall's feet lie); `riderless` once he's been thrown. */
  | { mode: 'mounted'; pose: HorsePose; riderless?: boolean };

type HumanState = Exclude<EnemyBodyState, { mode: 'mounted' }>;

const TWO_PI = Math.PI * 2;

/** Walking or standing with a banner in both hands (withBanner), else the plain pose. */
const poseFor = (kind: UnitType, state: HumanState): BodyPose => {
  const pose = plainPoseFor(kind, state);
  return (state.mode === 'walk' || state.mode === 'stand') && state.banner ? withBanner(pose) : pose;
};

const plainPoseFor = (kind: UnitType, state: HumanState): BodyPose => {
  const { club } = lookOf(kind);
  // Grabbers (zombies) walk and stand with their arms held out.
  const zombie = enemyArchetype(kind).attackStyle === 'grab';
  switch (state.mode) {
    case 'walk':
      // drawStickman's run cycle runs 0.4 ahead of its walk phase (see runProgress there).
      return state.running
        ? runBody(state.phase / TWO_PI + 0.4, club, 0)
        : walkBody(state.phase / TWO_PI, { club, zombie, lean: 0, style: ENEMY_KINDS[kind].build.walkStyle });
    case 'stand':
      return zombie ? attackBody(0, 'grab') : standBody(club);
    case 'attack':
      return attackBody(state.progress, zombie ? 'grab' : state.style);
    case 'cast':
      return castBody(state.progress);
    case 'bandage':
      return bandageBody(state.kneel, state.timeMs);
    case 'archer':
      return archerBody(state.localAngle, state.tension, state.ready, state.walkPhase === undefined ? undefined : state.walkPhase / TWO_PI);
    case 'joints':
      return state.club && club ? withClub(state.pose) : state.pose;
  }
};

/** Draws an enemy of `kind` into `sprite` (cleared first); sets the sprite's y like drawStickman would. */
export const drawEnemyBody = (sprite: Graphics, kind: UnitType, state: EnemyBodyState, originY: number, timeMs: number): void => {
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
export const drawEnemyGibs = (sprite: Graphics, kind: UnitType, simulation: GibSimulation, originY: number, timeMs: number): void => {
  const { look, gibs } = lookOf(kind);
  drawLookGibs(sprite, simulation, look(timeMs, 0), gibs, originY);
};
