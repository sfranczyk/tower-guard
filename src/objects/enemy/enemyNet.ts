import type Enemy from './Enemy';
import type { EnemyNet } from './enemyTypes';

/** Co-op host: what the guest needs of a ground enemy besides its position (walking speed; an archer's bow; time left pinned). */
export const enemyNetState = (enemy: Enemy): EnemyNet => {
  const { motion, mana, bow } = enemy;
  const mount = enemy.rider?.mount;
  const pinned = motion.isPinned ? motion.pinnedMs : undefined;
  const af = enemy.afflictions.getNetState();
  const th = motion.netThrow;
  const manaLeft = mana ? Math.round(mana.mana) : undefined;
  const lame = mount?.isLame ? Math.round(mount.lameLeftMs) : undefined;
  return enemy.isArcher
    ? { vx: enemy.velocity.x, ...bow.net, pinned, af, th }
    : { vx: enemy.velocity.x, pinned, af, th, mana: manaLeft, lame };
};

/**
 * Co-op guest: puts the enemy where the host has it (no AI runs on the guest); walking speed drives the stride and
 * facing, an archer's bow follows the host's aim and draw.
 */
export const applyEnemyNet = (enemy: Enemy, state: EnemyNet & { x: number; y: number }): void => {
  if (!enemy.isAlive()) {
    return;
  }
  const { motion, mana } = enemy;
  if (mana && state.mana !== undefined) {
    mana.set(state.mana);
    enemy.bars.drawMana(mana.ratio);
  }
  if (state.th && !motion.isThrown && !enemy.figure.fall) {
    enemy.throwInAir(state.th.vx, 0, state.th.spin);
    motion.fromNet = true;
  }
  if (motion.isThrown) {
    // The host flies it; this side tumbles it and lands it.
    motion.placeFlight(state.x, state.y, state.y >= enemy.y ? 1 : -1);
    enemy.position.set(state.x, state.y);
    return;
  }
  enemy.position.set(state.x, state.y);
  enemy.velocity.x = state.vx;
  enemy.velocity.y = 0;
  motion.setPin(state.pinned ?? 0);
  enemy.rider?.mount.setLame(state.lame ?? 0);
  enemy.afflictions.applyNetState(state.af);
  if (enemy.isArcher && state.aim !== undefined) {
    enemy.bow.apply({ aim: state.aim, tension: state.tension, ready: state.ready });
    if (enemy.bow.ready > 0 && Math.abs(state.vx) <= 1) {
      enemy.figure.face(Math.cos(state.aim) < 0 ? -1 : 1);
    }
  }
};
