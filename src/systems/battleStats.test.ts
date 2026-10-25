import { describe, expect, it } from 'vitest';
import { BattleStats, accuracy, teamTotals } from './battleStats';

describe('BattleStats', () => {
  it("counts each player's shots, hits, damage and headshots", () => {
    const stats = new BattleStats(2);
    stats.shot(0);
    stats.shot(0);
    stats.shot(1);
    stats.hit(0);
    stats.damage(0, 30.4, true);
    stats.damage(1, 12);
    const [first, second] = stats.snapshot().players;
    expect(first).toMatchObject({ shots: 2, hits: 1, damage: 30, headshots: 1 });
    expect(second).toMatchObject({ shots: 1, hits: 0, damage: 12, headshots: 0 });
    expect(accuracy(first)).toBe(50);
    expect(accuracy(second)).toBe(0);
  });

  it('counts kills by kind and cause, and the longest per player', () => {
    const stats = new BattleStats(1);
    stats.kill('raider', 'headshot', 0, 400);
    stats.kill('raider', 'burn', 0, 900);
    stats.kill('knight', 'melee');
    const snapshot = stats.snapshot();
    expect(snapshot.killsByType).toEqual({ raider: 2, knight: 1 });
    expect(snapshot.killsByCause).toEqual({ headshot: 1, burn: 1, melee: 1 });
    expect(snapshot.players[0]).toMatchObject({ kills: 2, longestKill: 900 });
  });

  it('counts falls, player kills and the keep', () => {
    const stats = new BattleStats(2);
    stats.hurt(0, 40);
    stats.fell(0, 1);
    stats.keepHurt(120);
    const snapshot = stats.snapshot();
    expect(snapshot.players[0]).toMatchObject({ damageTaken: 40, deaths: 1 });
    expect(snapshot.players[1].playerKills).toBe(1);
    expect(snapshot.keepDamage).toBe(120);
  });

  it('stops counting once the level is decided', () => {
    const stats = new BattleStats(1);
    stats.tick(1000);
    stats.stop();
    stats.tick(1000);
    stats.shot(0);
    stats.kill('raider', 'arrow', 0);
    stats.keepHurt(5);
    const snapshot = stats.snapshot();
    expect(snapshot.durationMs).toBe(1000);
    expect(snapshot.players[0]).toMatchObject({ shots: 0, kills: 0 });
    expect(snapshot.keepDamage).toBe(0);
  });

  it('adds the team up, keeping the longest kill', () => {
    const stats = new BattleStats(2);
    stats.kill('raider', 'arrow', 0, 300);
    stats.kill('raider', 'arrow', 1, 700);
    stats.gold([50, 20], [30, 0]);
    expect(teamTotals(stats.snapshot().players)).toMatchObject({ kills: 2, longestKill: 700, goldEarned: 70, goldSpent: 30 });
  });
});
