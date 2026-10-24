import { describe, expect, it } from 'vitest';
import { autoTeam, canJoinTeam, matchTeams, teamSlot, teamsReady } from './moba';

describe('moba teams', () => {
  it('alternates teams without a lobby pick and counts each team\'s slots', () => {
    const teams = matchTeams(4, true);
    expect(teams).toEqual(['blue', 'red', 'blue', 'red']);
    expect(teams.map((_, index) => teamSlot(index, teams))).toEqual([0, 0, 1, 1]);
    expect(matchTeams(2, false)).toEqual(['blue', 'blue']);
  });

  it('puts a newcomer on the smaller team, at most three a team', () => {
    expect(autoTeam([])).toBe('blue');
    expect(autoTeam(['blue'])).toBe('red');
    expect(autoTeam(['blue', 'red', undefined])).toBe('blue');
    const full: ('blue' | 'red')[] = ['blue', 'blue', 'blue', 'red'];
    expect(canJoinTeam(full, 3, 'blue')).toBe(false);
    expect(canJoinTeam(full, 0, 'blue')).toBe(true);
    expect(canJoinTeam(full, 0, 'red')).toBe(true);
  });

  it('needs a player on each team to start', () => {
    expect(teamsReady(['blue', 'blue'])).toBe(false);
    expect(teamsReady(['blue', undefined, 'red'])).toBe(true);
  });
});
