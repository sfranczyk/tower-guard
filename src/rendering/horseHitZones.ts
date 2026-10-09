import type { Vec2 } from '../types';
import { rotateAbout as rotate } from '../utils/math';
import { HORSE_LEG, type HorseLeg, type HorsePose } from './horseRider';

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

/** A hit zone of horse and rider (sprite space): the box around `points`, grown by `padding`. */
export interface MountedZone {
  points: Vec2[];
  padding: number;
  headshot: boolean;
  /** Whose it is: the rider's head and torso, the rest the horse's. */
  part: 'rider' | 'horse';
  /** One of the horse's legs. */
  leg?: boolean;
}

/** The leg zones stop this far (px) above the hoof, so arrows into the ground just in front of it miss. */
const LEG_ZONE_ABOVE_HOOF = 6;

/** A leg's zone: from where it hangs, through the knee or hock, down to just above the hoof. */
const legZone = ({ root, joint, hoof }: HorseLeg): MountedZone => {
  const share = LEG_ZONE_ABOVE_HOOF / HORSE_LEG.lower;
  const low = { x: hoof.x + (joint.x - hoof.x) * share, y: hoof.y + (joint.y - hoof.y) * share };
  return { points: [root, joint, low], padding: 2.5, headshot: false, part: 'horse', leg: true };
};

/** The barrel's four extremes (front, back, top, bottom). */
const barrelExtremes = ({ barrel }: HorsePose): Vec2[] => {
  const { centre, rx, ry, angle } = barrel;
  return [{ x: rx, y: 0 }, { x: -rx, y: 0 }, { x: 0, y: -ry }, { x: 0, y: ry }]
    .map((offset) => rotate(add(centre, offset), centre, angle));
};

/**
 * Where horse and rider can be hit (pure, tested): the rider's head (a headshot) and torso, the horse's barrel, neck and
 * head (the horse's headshot) and each leg (`leg`). Under the belly between the legs and above the hooves arrows fly through.
 */
export const mountedHitZones = (pose: HorsePose): MountedZone[] => {
  const { rider } = pose;
  const crest = { x: (pose.withers.x + pose.poll.x) / 2, y: (pose.withers.y + pose.poll.y) / 2 };
  return [
    { points: [rider.head], padding: 10, headshot: true, part: 'rider' },
    { points: [rider.hip, rider.shoulder, rider.neckTop], padding: 8, headshot: false, part: 'rider' },
    { points: [...barrelExtremes(pose), pose.croup], padding: 0, headshot: false, part: 'horse' },
    { points: [crest, pose.throat, pose.chest, pose.withers], padding: 3, headshot: false, part: 'horse' },
    { points: [pose.poll, pose.forehead, pose.muzzle, pose.nose, pose.chin], padding: 2, headshot: true, part: 'horse' },
    ...[pose.nearFore, pose.farFore, pose.nearHind, pose.farHind].map(legZone),
  ];
};

/** Points over horse and rider where flames burn and frost glints (sprite space). */
export const mountedBodyPoints = (pose: HorsePose): Vec2[] => [
  pose.rider.hip, pose.rider.shoulder, pose.rider.head, pose.barrel.centre, ...barrelExtremes(pose).slice(0, 3), pose.croup, pose.withers, pose.poll, pose.chest,
];

/** What an ice block closes round: the body points and the hooves, muzzle and tail. */
export const mountedIcePoints = (pose: HorsePose): Vec2[] => [
  ...mountedBodyPoints(pose), pose.muzzle, pose.nearFore.hoof, pose.nearHind.hoof, pose.farFore.hoof, pose.farHind.hoof, ...pose.tail,
];
