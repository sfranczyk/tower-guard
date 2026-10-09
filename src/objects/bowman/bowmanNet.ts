import type { AfflictionNet } from '../AfflictionLayer';
import type { Bowman } from './Bowman';
import { land } from './bowmanAloft';

/** What the co-op guest needs to show his fire, frost and vortex state, a throw and a pin. */
export interface BowmanNet {
  af?: AfflictionNet;
  th?: { vx: number; spin: number };
  pin?: number;
}

/** What the guest gets of the other player's bowman every frame (his controls run on the host). */
export interface BowmanRemote {
  x: number;
  y: number;
  vx: number;
  inTower: boolean;
  ax: number;
  ay: number;
  power: number;
}

/** Co-op host: his frost, vortex, throw and pin for the guest. */
export const bowmanNetState = (bowman: Bowman): BowmanNet => {
  const { motion } = bowman;
  const af = bowman.afflictions.getNetState();
  const th = motion.netThrow;
  const pin = motion.isPinned ? Math.round(motion.pinnedMs) : undefined;
  return { af, th, pin };
};

/** Co-op guest: the host's frost, vortex, throw and pin (his position comes with applyRemote / correctTo). */
export const applyBowmanNet = (bowman: Bowman, net: BowmanNet): void => {
  const { motion } = bowman;
  const wasFrozen = bowman.isFrozen;
  bowman.afflictions.applyNetState(net.af);
  if (net.af?.lift !== undefined || (!wasFrozen && bowman.isFrozen)) {
    bowman.dropDraw();
  }
  motion.setPin(net.pin ?? 0);
  if (net.th && !motion.isThrown && !bowman.knockdown) {
    bowman.throwInAir(net.th.vx, 0, net.th.spin);
    motion.fromNet = true;
  } else if (!net.th && motion.flight && motion.fromNet) {
    land(bowman, motion.flight.vx, 0);
  }
};

/**
 * Co-op guest: the other player's bowman, placed as the host has him: position, walking speed (for the animation),
 * the keep, and the bow.
 */
export const applyRemote = (bowman: Bowman, state: BowmanRemote): void => {
  if (state.inTower !== bowman.isInTower) {
    if (state.inTower) {
      bowman.enterTower();
    } else {
      bowman.exitTower();
    }
  }
  bowman.position.set(state.x, state.y);
  bowman.motion.placeFlight(state.x, state.y);
  bowman.footing.horizontalSpeed = bowman.knockdown || bowman.isAloft ? 0 : state.vx;
  bowman.footing.verticalVelocity = 0;
  bowman.setAim({ x: state.ax, y: state.ay }, state.power);
};
