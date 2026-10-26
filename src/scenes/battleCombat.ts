import type { Graphics } from 'pixi.js';
import type { SoundId } from '../audio/SoundManager';
import { isMultiplayer, type GameContext } from '../core/Scene';
import type { Battleground } from '../data/battlegrounds';
import { enemyEdge } from '../data/difficulty';
import { friendlyFireOn } from '../data/sandbox';
import type Enemy from '../objects/enemy/Enemy';
import type Tower from '../objects/Tower';
import { CombatSystem, type Foe } from '../systems/CombatSystem';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { Vec2 } from '../types';
import type { BattleAllies } from './BattleAllies';
import type { BattleArrows } from './BattleArrows';
import type { BattleBanners } from './BattleBanners';
import { battleCombatEvents } from './battleCombatEvents';
import type { BattleEnemies } from './BattleEnemies';
import type { BattlePlayers } from './BattlePlayers';
import type { BattleStatsWatch } from './BattleStatsWatch';
import type { MobaMode } from './MobaMode';

export interface BattleCombatDeps {
  ctx: GameContext;
  team: BattlePlayers;
  playerTower: Tower;
  enemyTower: Tower;
  enemies: readonly Foe[];
  allies: readonly Enemy[];
  foes: BattleEnemies;
  soldiers: BattleAllies;
  shots: BattleArrows;
  effects: EffectsSystem;
  debug: Graphics;
  battleground: Battleground;
  wind: () => number;
  banners?: BattleBanners;
  moba?: MobaMode;
  stats?: BattleStatsWatch;
  playSound: (id: SoundId, at: Vec2, heardBy?: number) => void;
}

/** The level's combat (host or alone): its rules from the battle setup or MOBA, its news handled by battleCombatEvents. */
export const createBattleCombat = (deps: BattleCombatDeps): CombatSystem => {
  const { ctx, team, moba, stats } = deps;
  return new CombatSystem(
    {
      bowmen: team.bowmen,
      playerTower: deps.playerTower,
      enemyTower: deps.enemyTower,
      enemies: deps.enemies,
      allies: deps.allies,
      allyOrder: () => (moba ? 'advance' : deps.soldiers.order),
      arrows: deps.shots.list,
      effects: deps.effects,
      debug: deps.debug,
      wind: deps.wind,
      weather: deps.battleground.weather,
      // MOBA: always on (your own minions and teammates can be hit; killing a teammate costs gold).
      friendlyFire: () => moba !== undefined || friendlyFireOn(ctx.session.sandbox, isMultiplayer(ctx.session)),
      reinforcementsDue: () => deps.foes.reinforcementsDue,
      // MOBA: the red side hits as hard as the blue one.
      enemyEdge: enemyEdge(moba ? 'easy' : ctx.session.sandbox.difficulty),
      banners: deps.banners?.field,
      lanes: moba !== undefined,
      allyFliers: moba?.allyFliers,
      teamOf: moba && ((bowman) => team.of(bowman).team),
    },
    battleCombatEvents({
      ctx, team, shots: deps.shots, playSound: deps.playSound,
      bowmanHit: (player, hit, lost) => {
        moba?.match?.bowmanHit(player, hit);
        stats?.bowmanHit(player, hit, lost);
      },
      arrowLanded: (owner, type) => stats?.landed(owner, type),
    }),
  );
};
