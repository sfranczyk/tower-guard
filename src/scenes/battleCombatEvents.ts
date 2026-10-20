import type { SoundId } from '../audio/SoundManager';
import { ARROWS } from '../config';
import type { GameContext } from '../core/Scene';
import type { CombatEvents } from '../systems/CombatSystem';
import { mishapStatus } from '../systems/weatherArrows';
import type { Vec2 } from '../types';
import type { BattleArrows } from './BattleArrows';
import type { BattlePlayers } from './BattlePlayers';

/**
 * What the level does with the combat's news (CombatSystem): the players' health (hits and heals), their status lines
 * (headshot, on fire, an arrow's weather mishap), enemy arrows loosed and sounds.
 */
export const battleCombatEvents = ({ ctx, team, shots, playSound }: {
  ctx: GameContext;
  team: BattlePlayers;
  shots: BattleArrows;
  playSound: (id: SoundId, at: Vec2) => void;
}): CombatEvents => ({
  bowmanDamaged: (bowman, amount, hit) => {
    const player = team.of(bowman);
    player.health = Math.max(0, player.health - amount);
    bowman.noteHit(hit);
  },
  headshot: () => ctx.ui.setStatus(`Headshot! ×${ARROWS.headshotMultiplier} damage`),
  bowmanIgnited: (bowman) => team.status(team.of(bowman), 'You are on fire! Get out of the flames'),
  enemyShot: (from, angle, speed, shooter) => shots.fireEnemy(from, angle, speed, shooter),
  sound: (id, at) => playSound(id, at),
  bowmanHealth: (bowman) => ({ health: team.of(bowman).health, max: ctx.session.sandbox.bowmanHealth }),
  bowmanHealed: (bowman, amount) => {
    const player = team.of(bowman);
    player.health = Math.min(ctx.session.sandbox.bowmanHealth, player.health + amount);
  },
  arrowMishap: (arrow, kind) => {
    if (kind === 'douse') {
      shots.douse(arrow);
    }
    const shooter = team.list.find((player) => player.index === arrow.owner);
    if (shooter) {
      team.status(shooter, mishapStatus(kind));
    }
  },
});
