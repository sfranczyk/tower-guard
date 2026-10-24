import type { SoundId } from '../audio/SoundManager';
import { ARROWS } from '../config';
import type { GameContext } from '../core/Scene';
import type { BowmanHit } from '../systems/bowmanDeath';
import type { CombatEvents } from '../systems/CombatSystem';
import { mishapStatus } from '../systems/weatherArrows';
import type { Vec2 } from '../types';
import type { BattleArrows } from './BattleArrows';
import type { BattlePlayers } from './BattlePlayers';
import type { Player } from './PlayerControl';

/**
 * What the level does with the combat's news (CombatSystem): the players' health (hits and heals), their status lines
 * (headshot, on fire, an arrow's weather mishap), enemy arrows loosed and sounds.
 */
export const battleCombatEvents = ({ ctx, team, shots, playSound, bowmanHit }: {
  ctx: GameContext;
  team: BattlePlayers;
  shots: BattleArrows;
  playSound: (id: SoundId, at: Vec2) => void;
  /** MOBA: a player was hit (healing waits, whose kill it would be). */
  bowmanHit?: (player: Player, hit: BowmanHit) => void;
}): CombatEvents => ({
  bowmanDamaged: (bowman, amount, hit) => {
    const player = team.of(bowman);
    player.health = Math.max(0, player.health - amount);
    bowman.noteHit(hit);
    bowmanHit?.(player, hit);
  },
  headshot: () => ctx.ui.setStatus(`Headshot! ×${ARROWS.headshotMultiplier} damage`),
  bowmanIgnited: (bowman) => team.status(team.of(bowman), 'You are on fire! Get out of the flames'),
  enemyShot: (from, angle, speed, shooter, power) => shots.fireEnemy(from, angle, speed, shooter, false, power),
  allyShot: (from, angle, speed, shooter, power) => shots.fireMinion(from, angle, speed, shooter, power),
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
