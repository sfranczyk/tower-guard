import { MOBA_LANES } from '../config';
import type { MinionGroup } from '../systems/minionWaves';
import type { EnemyType, MinionType, UnitType } from '../types';

/**
 * MOBA mode (`?moba`, dev only for now): two teams, each with its keep and lane minions. Blue holds the left keep (the
 * player's side: its minions are soldiers, systems/AllyAI.ts), red the right one (its minions are enemies, EnemyAI).
 */
export type Team = 'blue' | 'red';

/** What a keep sends down the lane. */
export type MinionRole = 'troop' | 'archer' | 'dragon' | 'kamikaze';

/**
 * Each team's minion of each role: blue in the bowman's blue (its dragon is a dragon archer in BLUE_DRAGON_LOOK), red
 * squires in red (redSquire), hunters and dark dragon archers. Both send the same kamikaze, a siege unit (Enemy.siege).
 */
export const MINION_KINDS: { readonly blue: Readonly<Record<MinionRole, UnitType>>; readonly red: Readonly<Record<MinionRole, EnemyType | MinionType>> } = {
  blue: { troop: 'squire', archer: 'blueArcher', dragon: 'dragon', kamikaze: 'kamikaze' },
  red: { troop: 'redSquire', archer: 'hunter', dragon: 'dragon', kamikaze: 'kamikaze' },
};

/** The groups each keep sends now (config MOBA_LANES, tunable). */
export const minionGroups = (): readonly MinionGroup<MinionRole>[] => [
  { role: 'troop', count: MOBA_LANES.troopCount, everyMs: MOBA_LANES.troopEveryMs },
  { role: 'archer', count: MOBA_LANES.archerCount, everyMs: MOBA_LANES.archerEveryMs },
  { role: 'dragon', count: MOBA_LANES.dragonCount, everyMs: MOBA_LANES.dragonEveryMs, firstMs: MOBA_LANES.dragonFirstMs },
  { role: 'kamikaze', count: MOBA_LANES.kamikazeCount, everyMs: MOBA_LANES.kamikazeEveryMs, firstMs: MOBA_LANES.kamikazeFirstMs },
];

/** Player `index`'s team: as picked in the lobby (`teams`), else alternating (the local `?coop` test: 1 blue, 2 red, …). */
export const mobaTeamOf = (index: number, teams?: ReadonlyArray<Team | undefined>): Team => teams?.[index] ?? (index % 2 === 0 ? 'blue' : 'red');

/** Player `index`'s place in their team (0 = first): their tower in the keep, where they stand at the start. */
export const teamSlot = (index: number, teams: readonly Team[]): number =>
  teams.slice(0, index).filter((team) => team === teams[index]).length;

/** The other team. */
export const otherTeam = (team: Team): Team => (team === 'blue' ? 'red' : 'blue');

/** Every player's team, by index: all blue outside MOBA. */
export const matchTeams = (playerCount: number, moba: boolean, teams?: ReadonlyArray<Team | undefined>): Team[] =>
  Array.from({ length: Math.max(1, playerCount) }, (_, index) => (moba ? mobaTeamOf(index, teams) : 'blue'));

/** Players a team holds at most (online: a room of six). */
export const MAX_TEAM_SIZE = 3;

const teamSize = (teams: ReadonlyArray<Team | undefined>, team: Team, except?: number): number =>
  teams.filter((other, index) => other === team && index !== except).length;

/** The team a newcomer joins: the smaller one (blue on a tie). */
export const autoTeam = (teams: ReadonlyArray<Team | undefined>): Team =>
  (teamSize(teams, 'red') < teamSize(teams, 'blue') ? 'red' : 'blue');

/** Whether player `index` may switch to `team` (it has room for him). */
export const canJoinTeam = (teams: ReadonlyArray<Team | undefined>, index: number, team: Team): boolean =>
  teamSize(teams, team, index) < MAX_TEAM_SIZE;

/** A match can start with at least one player on each team (`teams`: the players in the room). */
export const teamsReady = (teams: ReadonlyArray<Team | undefined>): boolean =>
  teamSize(teams, 'blue') > 0 && teamSize(teams, 'red') > 0;
