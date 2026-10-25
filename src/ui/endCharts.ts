import { ENEMY_KINDS } from '../data/enemyKinds';
import { ARROW_INFO, type ArrowType } from '../data/loadout';
import { accuracy, type KillCause, type LevelReport, type StatsSample } from '../systems/battleStats';
import type { UnitType } from '../types';

/** The charts' series colours (validated together against the card's #fffdf6: blue, orange, aqua, yellow; red for the red team). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const;
const TEAM_COLOR = { blue: '#2a78d6', red: '#e34948' } as const;

export const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const clock = (ms: number): string => {
  const seconds = Math.round(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const CAUSE_LABELS: Record<KillCause, string> = {
  arrow: 'Arrow', headshot: 'Headshot', blast: 'Explosive hit', explosion: 'Explosion', burn: 'Fire', shatter: 'Shattered (frozen)',
  fall: 'Vortex fall', lightning: 'Lightning', melee: 'Soldiers',
};

interface Series {
  label: string;
  color: string;
  value(sample: StatsSample): number | undefined;
}

interface LineChart {
  title: string;
  series: Series[];
  /** Fill under the (single) line. */
  area?: boolean;
  /** Fixed top of the scale (keep health: 100); else rounded up from the data. */
  yMax?: number;
  yUnit?: string;
  /** The x axis runs to here (s; survival: the whole night), else to the last sample. */
  xMax?: number;
  markers?: Array<{ t: number; label: string }>;
}

const W = 560;
const H = 132;
const PAD = { left: 34, right: 10, top: 10, bottom: 22 };

/** A round, even top for the y axis (so the middle gridline is whole too): 2, 4, 6, 8 or 10 × a power of ten, at least `max`. */
const niceMax = (max: number): number => {
  if (max <= 2) {
    return 2;
  }
  const power = 10 ** Math.floor(Math.log10(max));
  return [2, 4, 6, 8, 10].map((step) => step * power).find((top) => top >= max) ?? 10 * power;
};

/** Seconds between x ticks: no more than six across `span`. */
const tickStep = (span: number): number => [5, 10, 15, 30, 60, 120, 300, 600, 1200].find((step) => span / step <= 6) ?? 1800;

/** One time chart (pure SVG): a line per series, the title (and a legend for two), hover columns with every value. */
const lineChart = (samples: readonly StatsSample[], chart: LineChart): string => {
  const last = samples[samples.length - 1].t;
  const xMax = Math.max(1, chart.xMax ?? last);
  const values = samples.flatMap((sample) => chart.series.map((series) => series.value(sample) ?? 0));
  const yMax = chart.yMax ?? niceMax(Math.max(...values));
  const x = (t: number): number => PAD.left + ((W - PAD.left - PAD.right) * Math.min(t, xMax)) / xMax;
  const y = (value: number): number => PAD.top + (H - PAD.top - PAD.bottom) * (1 - value / yMax);
  const unit = chart.yUnit ?? '';
  const grid = [0, yMax / 2, yMax].map((value) =>
    `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(value)}" y2="${y(value)}"/><text class="axis" x="${PAD.left - 6}" y="${y(value) + 4}" text-anchor="end">${Math.round(value)}${unit}</text>`).join('');
  const step = tickStep(xMax);
  const ticks = Array.from({ length: Math.floor(xMax / step) + 1 }, (_, index) => index * step)
    .map((t) => `<text class="axis" x="${x(t)}" y="${H - 6}" text-anchor="middle">${clock(t * 1000)}</text>`).join('');
  const markers = (chart.markers ?? []).map(({ t, label }) =>
    `<line class="marker" x1="${x(t)}" x2="${x(t)}" y1="${PAD.top}" y2="${H - PAD.bottom}"/><text class="marker-label" x="${x(t) + 3}" y="${PAD.top + 8}">${escapeHtml(label)}</text>`).join('');
  const lines = chart.series.map((series) => {
    const points = samples.filter((sample) => series.value(sample) !== undefined).map((sample) => `${x(sample.t).toFixed(1)},${y(series.value(sample)!).toFixed(1)}`);
    if (points.length === 0) {
      return '';
    }
    const area = chart.area ? `<polygon points="${x(samples[0].t)},${y(0)} ${points.join(' ')} ${x(last)},${y(0)}" fill="${series.color}" fill-opacity="0.16"/>` : '';
    return `${area}<polyline points="${points.join(' ')}" fill="none" stroke="${series.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  // Hover: a column per sample, its title every series' value then.
  const columns = samples.map((sample, index) => {
    const from = index === 0 ? x(sample.t) : (x(samples[index - 1].t) + x(sample.t)) / 2;
    const to = index === samples.length - 1 ? x(sample.t) + 1 : (x(sample.t) + x(samples[index + 1].t)) / 2;
    const text = chart.series.map((series) => `${series.label}: ${Math.round(series.value(sample) ?? 0)}${unit}`).join(' · ');
    return `<rect class="hover" x="${from.toFixed(1)}" y="${PAD.top}" width="${Math.max(1, to - from).toFixed(1)}" height="${H - PAD.top - PAD.bottom}"><title>${clock(sample.t * 1000)} · ${escapeHtml(text)}</title></rect>`;
  }).join('');
  const legend = chart.series.length > 1
    ? `<div class="chart-legend">${chart.series.map((series) => `<span><i style="background:${series.color}"></i>${escapeHtml(series.label)}</span>`).join('')}</div>`
    : '';
  return `<figure class="report-chart"><figcaption>${escapeHtml(chart.title)}</figcaption>${legend}`
    + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(chart.title)}">${grid}${ticks}${markers}${lines}${columns}</svg></figure>`;
};

/** The Timeline tab (pure): what was on the field and the keeps' health over the level (MOBA: the teams' gold). */
export const timelineHtml = (report: LevelReport): string => {
  const samples = report.timeline;
  if (samples.length < 2) {
    return '<p class="report-empty">Too short for a timeline.</p>';
  }
  if (report.teams) {
    return lineChart(samples, {
      title: 'Gold earned by team',
      series: [
        { label: 'Blue team', color: TEAM_COLOR.blue, value: (sample) => sample.gold?.[0] },
        { label: 'Red team', color: TEAM_COLOR.red, value: (sample) => sample.gold?.[1] },
      ],
    }) + lineChart(samples, {
      title: 'Keep health', yMax: 100, yUnit: '%',
      series: [
        { label: 'Blue keep', color: TEAM_COLOR.blue, value: (sample) => sample.keep },
        { label: 'Red keep', color: TEAM_COLOR.red, value: (sample) => sample.enemyKeep },
      ],
    });
  }
  const dawn = report.levelSeconds;
  const waves = report.waves.map((t, index) => ({ t, label: `W${index + 1}` }));
  return lineChart(samples, {
    title: 'Enemies on the field', area: true, xMax: dawn,
    series: [{ label: 'Enemies', color: SERIES[0], value: (sample) => sample.alive }],
    markers: dawn ? [...waves, { t: dawn, label: 'Dawn' }] : waves,
  }) + lineChart(samples, {
    title: 'Keep health', yMax: 100, yUnit: '%', xMax: dawn,
    series: [
      { label: 'Our keep', color: SERIES[0], value: (sample) => sample.keep },
      ...(samples.some((sample) => sample.enemyKeep !== undefined) ? [{ label: 'Enemy keep', color: SERIES[1], value: (sample: StatsSample) => sample.enemyKeep }] : []),
    ],
  });
};

/** Horizontal bars, longest first: a label, the bar (share of `max`) and its value. */
const barList = (title: string, rows: Array<{ label: string; value: number; text?: string; max?: number }>): string => {
  if (rows.length === 0) {
    return '';
  }
  const max = Math.max(...rows.map((row) => row.max ?? row.value), 1);
  const items = rows.map((row) => `<li><span class="bar-label">${escapeHtml(row.label)}</span>`
    + `<span class="bar-track"><i style="width:${((100 * row.value) / (row.max ?? max)).toFixed(1)}%"></i></span>`
    + `<span class="bar-value">${row.text ?? row.value}</span></li>`).join('');
  return `<figure class="report-chart"><figcaption>${escapeHtml(title)}</figcaption><ul class="bar-list">${items}</ul></figure>`;
};

const sortedRows = (counts: Record<string, number>, label: (key: string) => string): Array<{ label: string; value: number }> =>
  Object.entries(counts).filter(([, value]) => value > 0).sort((first, second) => second[1] - first[1]).map(([key, value]) => ({ label: label(key), value }));

/** Everyone's share of the kills (MOBA: last hits) in one bar, a colour per player, names and counts beside. */
const killShare = (report: LevelReport): string => {
  const total = report.players.reduce((sum, player) => sum + player.kills, 0);
  if (report.players.length < 2 || total === 0) {
    return '';
  }
  const color = (index: number): string => SERIES[index % SERIES.length];
  const segments = report.players.map((player, index) => (player.kills > 0
    ? `<i style="flex:${player.kills};background:${color(index)}" title="${escapeHtml(report.names[index] ?? '')}: ${player.kills}"></i>` : '')).join('');
  const legend = report.players.map((player, index) =>
    `<span><i style="background:${color(index)}"></i>${escapeHtml(report.names[index] ?? `Player ${index + 1}`)} ${player.kills} (${Math.round((100 * player.kills) / total)}%)</span>`).join('');
  return `<figure class="report-chart"><figcaption>${report.teams ? 'Share of last hits' : 'Share of kills'}</figcaption><div class="share-bar">${segments}</div><div class="chart-legend">${legend}</div></figure>`;
};

/** The Breakdown tab (pure): the share of kills, kills by enemy and by cause, and each arrow type's hits. */
export const breakdownHtml = (report: LevelReport): string => {
  const arrows = Object.entries(report.arrows).filter(([, tally]) => tally.shots > 0)
    .sort((first, second) => second[1].shots - first[1].shots)
    .map(([type, tally]) => ({
      label: ARROW_INFO[type as ArrowType]?.name ?? type,
      value: accuracy(tally),
      max: 100,
      text: `${tally.hits} / ${tally.shots} · ${accuracy(tally)}%`,
    }));
  const html = killShare(report)
    + barList(report.teams ? 'Minions taken down' : 'Kills by enemy', sortedRows(report.killsByType, (type) => ENEMY_KINDS[type as UnitType]?.label ?? type))
    + barList('How they fell', sortedRows(report.killsByCause, (cause) => CAUSE_LABELS[cause as KillCause] ?? cause))
    + barList('Arrows: hits / shots', arrows);
  return html || '<p class="report-empty">Nothing to break down yet.</p>';
};

/** The Run tab (pure): a row per level of the run and the totals. */
export const runHtml = (report: LevelReport): string => {
  const levels = report.run ?? [];
  const sum = (pick: (level: (typeof levels)[number]) => number): number => levels.reduce((total, level) => total + pick(level), 0);
  const row = (name: string, place: string, result: string, ms: number, kills: number, shots: number, hits: number, keep: number, total = false): string =>
    `<tr${total ? ' class="total"' : ''}><th>${name}</th><td class="text">${escapeHtml(place)}</td><td class="text">${result}</td><td>${clock(ms)}</td><td>${kills}</td><td>${accuracy({ shots, hits })}%</td><td>${keep}</td></tr>`;
  const rows = levels.map((level, index) => row(`Level ${index + 1}`, level.place, level.won ? 'Won' : 'Lost', level.durationMs, level.kills, level.shots, level.hits, level.keepDamage)).join('');
  const total = row('Run', '', '', sum((level) => level.durationMs), sum((level) => level.kills), sum((level) => level.shots), sum((level) => level.hits), sum((level) => level.keepDamage), true);
  return '<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Level</th><th class="text">Battlefield</th><th class="text">Result</th><th>Time</th><th>Kills</th><th>Accuracy</th><th>Keep damage</th></tr></thead>'
    + `<tbody>${rows}${total}</tbody></table></div>`;
};
