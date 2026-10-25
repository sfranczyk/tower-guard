import { describe, expect, it } from 'vitest';
import { PX_PER_METRE } from '../config';
import { BattleStats, type LevelReport } from '../systems/battleStats';
import { endReportHtml } from './endReport';

const report = (players: number, fill: (stats: BattleStats) => void, extra: Partial<LevelReport> = {}): LevelReport => {
  const stats = new BattleStats(players);
  fill(stats);
  return { ...stats.snapshot(), names: Array.from({ length: players }, (_, index) => `P${index + 1}`), local: 0, ...extra };
};

describe('endReportHtml', () => {
  it('shows the big numbers alone, with no players table', () => {
    const html = endReportHtml(report(1, (stats) => {
      stats.tick(65_000);
      stats.shot(0);
      stats.shot(0);
      stats.hit(0);
      stats.kill('raider', 'headshot', 0, 12 * PX_PER_METRE);
    }));
    expect(html).toContain('<strong>1:05</strong><span>time</span>');
    expect(html).toContain('<strong>50%</strong><span>accuracy</span>');
    expect(html).toContain('<strong>12 m</strong><span>longest kill</span>');
    expect(html).not.toContain('<table');
  });

  it('gives each co-op player a row, marks the best and this player', () => {
    const html = endReportHtml(report(2, (stats) => {
      stats.kill('raider', 'arrow', 1);
      stats.kill('raider', 'arrow', 1);
    }, { names: ['Robin', '<b>'] }));
    expect(html).toContain('<tr class="you"><th>Robin</th><td>0</td>');
    expect(html).toContain('<th>&lt;b&gt;</th><td class="best">2</td>');
  });

  it('MOBA: K/D and gold, the blue team first, tiles for this player\'s team', () => {
    const html = endReportHtml(report(3, (stats) => {
      stats.fell(0, 1);
      stats.gold([10, 40, 5], [0, 0, 0]);
    }, { teams: ['red', 'blue', 'red'], local: 0 }));
    expect(html).toContain('<th>Gold earned</th>');
    expect(html.indexOf('P2')).toBeLessThan(html.indexOf('P1'));
    expect(html).toContain('<strong>15</strong><span>gold earned</span>');
    expect(html).toContain('<strong>0</strong><span>players taken down</span>');
  });
});
