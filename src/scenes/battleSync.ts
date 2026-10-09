import type { SoundId } from '../audio/SoundManager';
import type { GameContext } from '../core/Scene';
import type { ManualInput, RecordingInput } from '../input/PlayerInput';
import { GuestSync } from '../net/GuestSync';
import { HostSync } from '../net/HostSync';
import type { EndInfo, NetMessage, SpawnPlace } from '../net/protocol';
import type Tower from '../objects/Tower';
import type { Foe } from '../systems/CombatSystem';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { EnemyType, Vec2 } from '../types';
import type { BattleArrows } from './BattleArrows';
import type { BattlePlayers } from './BattlePlayers';

export interface BattleSyncSetup {
  ctx: GameContext;
  role: 'solo' | 'host' | 'guest';
  wind: number;
  players: BattlePlayers;
  enemies: Foe[];
  shots: BattleArrows;
  effects: EffectsSystem;
  playerTower: Tower;
  enemyTower: Tower;
  spawnEnemy(type: EnemyType, place?: SpawnPlace): Foe;
  playSound(id: SoundId, at: Vec2): void;
  /** Guest: the host decided what comes after the level. */
  showGuestEnd(info: EndInfo): void;
}

/**
 * Co-op online. The host tells the guest the level's setup and then streams it (HostSync), with the guest's
 * controls driving player 2. The guest builds the same battlefield and replays the host's (GuestSync).
 */
export const startBattleSync = (setup: BattleSyncSetup): { hostSync?: HostSync; guestSync?: GuestSync } => {
  const { ctx, role, players, enemies, playerTower, enemyTower } = setup;
  const net = ctx.session.net;
  if (!net || role === 'solo') {
    return {};
  }
  if (role === 'host') {
    const hostSync = new HostSync(net.transport, { players: players.list, enemies, playerTower, enemyTower }, players.list[1].input as ManualInput);
    hostSync.watch(setup.effects);
    const { sandbox, run } = ctx.session;
    net.transport.send({ t: 'start', sandbox, run, wind: setup.wind });
    return { hostSync };
  }
  const guestSync = new GuestSync(net.transport, {
    players: players.list,
    localIndex: players.local.index,
    enemies,
    arrows: setup.shots.list,
    effects: setup.effects,
    playerTower,
    enemyTower,
    spawnEnemy: setup.spawnEnemy,
    launchArrow: (launch) => setup.shots.launchReplica(launch),
    playSound: setup.playSound,
    setStatus: (text) => ctx.ui.setStatus(text),
    showEnd: setup.showGuestEnd,
    restart: (message) => restartAsGuest(ctx, message),
    backToLobby: () => ctx.goTo('coop'),
  }, players.local.input as RecordingInput);
  return { guestSync };
};

/** Guest: the host started the next level (or a new battle). */
const restartAsGuest = (ctx: GameContext, message: Extract<NetMessage, { t: 'start' }>): void => {
  const { session } = ctx;
  session.sandbox = message.sandbox;
  session.run = message.run;
  if (session.net) {
    session.net.wind = message.wind;
  }
  ctx.goTo('game');
};
