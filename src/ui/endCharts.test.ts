import { describe, expect, it } from 'vitest';
import { BattleStats, runLevel, type LevelReport } from '../systems/battleStats';
import { breakdownHtml, runHtml, timelineHtml } from './endCharts';
import { endReportHtml } from './endReport';

const report = (players: number, fill: (stats: BattleStats) => void, extra: Partial<LevelReport> = {}): LevelReport => {
  const stats = new BattleStats(players);
  fill(stats);
  return { ...stats.snapshot(), names: Array.from({ length: players }, (_, index) => `P${index + 1}`), local: 0, ...extra };
};

const played = (stats: BattleStats): void => {
  for (let s = 0; s < 30; s++) {
    stats.tick(1000, () => ({ alive: s % 5, keep: 100 - s, enemyKeep: 100 }));
    if (s === 3) {
      stats.wave();
    }
  }
};

describe('timelineHtml', () => {
  it('draws enemies on the field with the waves marked, and both keeps', () => {
    const html = timelineHtml(report(1, played));
    expect(html).toContain('Enemies on the field');
    expect(html).toContain('>W1</text>');
    expect(html).toContain('<span><i style="background:#2a78d6"></i>Our keep</span>');
    expect(html).toContain('Enemy keep');
    expect(html).toContain('<title>0:05 · Enemies: 0</title>');
  });

  it('survival runs to dawn; MOBA shows the teams\' gold', () => {
    expect(timelineHtml(report(1, played, { levelSeconds: 600 }))).toContain('>Dawn</text>');
    const moba = report(2, (stats) => stats.tick(1000, () => ({ alive: 0, keep: 100, gold: [0, 0] })), { teams: ['blue', 'red'] });
    expect(timelineHtml(moba)).toContain('Too short');
    const longer = report(2, (stats) => [0, 1, 2].forEach((s) => stats.tick(1000, () => ({ alive: 0, keep: 100, enemyKeep: 90, gold: [s * 10, s * 5] }))), { teams: ['blue', 'red'] });
    expect(timelineHtml(longer)).toContain('Gold earned by team');
  });
});

describe('breakdownHtml', () => {
  it('lists kills by enemy and cause, arrows by accuracy, and the share of kills', () => {
    const html = breakdownHtml(report(2, (stats) => {
      stats.kill('raider', 'headshot', 0);
      stats.kill('raider', 'burn', 1);
      stats.kill('tank', 'arrow', 1);
      stats.shot(0, 'fire');
      stats.shot(0, 'fire');
      stats.hit(0, 'fire');
    }));
    expect(html).toContain('Share of kills');
    expect(html).toContain('P2 2 (67%)');
    expect(html.indexOf('Raider')).toBeLessThan(html.indexOf('Ogre brute'));
    expect(html).toContain('<span class="bar-label">Headshot</span>');
    expect(html).toContain('1 / 2 · 50%');
  });

  it('says so when there is nothing', () => {
    expect(breakdownHtml(report(1, () => {}))).toContain('Nothing to break down');
  });
});

describe('runHtml and the tabs', () => {
  it('lists each level and the run total; the Run tab only with a run', () => {
    const level = report(1, played);
    const run = [runLevel(level, 'Green Meadow', true), runLevel(level, 'Frozen Pass', false)];
    const html = runHtml({ ...level, run });
    expect(html).toContain('<th>Level 2</th><td class="text">Frozen Pass</td><td class="text">Lost</td><td>0:30</td>');
    expect(html).toContain('<tr class="total"><th>Run</th><td class="text"></td><td class="text"></td><td>1:00</td>');
    expect(endReportHtml(level)).not.toContain('data-report-tab="run"');
    expect(endReportHtml({ ...level, run }, 'run')).toContain('aria-selected="true" class="chip-button active" data-report-tab="run"');
    expect(endReportHtml(level, 'run')).toContain('aria-selected="true" class="chip-button active" data-report-tab="overview"');
  });
});
