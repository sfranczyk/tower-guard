import { PX_PER_METRE } from '../config';
import { accuracy, teamTotals, type LevelReport, type PlayerStats } from '../systems/battleStats';

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clock = (ms: number): string => {
  const seconds = Math.round(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const metres = (px: number): string => (px > 0 ? `${Math.round(px / PX_PER_METRE)} m` : '–');

/** One column of the players' table: its heading, the number it compares (the best is marked) and how it reads. */
interface Column {
  label: string;
  value(player: PlayerStats): number;
  text?(player: PlayerStats): string;
  /** Lower is better (deaths, damage taken). */
  low?: boolean;
}

const BATTLE_COLUMNS: Column[] = [
  { label: 'Kills', value: (player) => player.kills },
  { label: 'Accuracy', value: accuracy, text: (player) => `${accuracy(player)}%` },
  { label: 'Headshots', value: (player) => player.headshots },
  { label: 'Damage', value: (player) => player.damage },
  { label: 'Longest kill', value: (player) => player.longestKill, text: (player) => metres(player.longestKill) },
  { label: 'Damage taken', value: (player) => player.damageTaken, low: true },
];

const MOBA_COLUMNS: Column[] = [
  { label: 'Kills', value: (player) => player.playerKills },
  { label: 'Deaths', value: (player) => player.deaths, low: true },
  { label: 'Last hits', value: (player) => player.kills },
  { label: 'Accuracy', value: accuracy, text: (player) => `${accuracy(player)}%` },
  { label: 'Damage', value: (player) => player.damage },
  { label: 'Gold earned', value: (player) => player.goldEarned },
  { label: 'Gold spent', value: (player) => player.goldSpent },
];

/** The big numbers over the table: the whole team's (MOBA: this player's team's; alone: his own). */
const tiles = (report: LevelReport): Array<{ label: string; value: string }> => {
  const { teams, local = 0 } = report;
  const own = teams ? report.players.filter((_, index) => teams[index] === teams[local]) : report.players;
  const total = teamTotals(own);
  const shared = [
    { label: 'time', value: clock(report.durationMs) },
    { label: teams ? 'last hits' : 'kills', value: `${total.kills}` },
    { label: 'accuracy', value: `${accuracy(total)}%` },
    { label: 'headshots', value: `${total.headshots}` },
    { label: 'damage dealt', value: `${total.damage}` },
  ];
  return teams
    ? [...shared, { label: 'players taken down', value: `${total.playerKills}` }, { label: 'gold earned', value: `${total.goldEarned}` }]
    : [...shared, { label: 'longest kill', value: metres(total.longestKill) }, { label: 'keep damage', value: `${report.keepDamage}` }];
};

/** Each player's row (MOBA: blue team first), the best in each column marked. */
const table = (report: LevelReport): string => {
  const columns = report.teams ? MOBA_COLUMNS : BATTLE_COLUMNS;
  const order = report.players.map((_, index) => index)
    .sort((first, second) => (report.teams ? Number(report.teams[first] === 'red') - Number(report.teams[second] === 'red') : 0) || first - second);
  const best = columns.map((column) => {
    const values = report.players.map(column.value);
    const top = column.low ? Math.min(...values) : Math.max(...values);
    // Marked only when someone stands out (all equal: nobody).
    return values.some((value) => value !== top) ? top : undefined;
  });
  const head = `<tr><th>Player</th>${columns.map((column) => `<th>${column.label}</th>`).join('')}</tr>`;
  const rows = order.map((index) => {
    const player = report.players[index];
    const team = report.teams ? ` data-team="${report.teams[index]}"` : '';
    const cells = columns.map((column, at) => {
      const value = column.value(player);
      return `<td${value === best[at] ? ' class="best"' : ''}>${column.text ? column.text(player) : value}</td>`;
    }).join('');
    return `<tr${index === report.local ? ' class="you"' : ''}${team}><th>${escapeHtml(report.names[index] ?? `Player ${index + 1}`)}</th>${cells}</tr>`;
  }).join('');
  return `<div class="report-table-wrap"><table class="report-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
};

/** The end card's Overview (pure, tested): the team's big numbers and, with more than one player, a row per player. */
export const endReportHtml = (report: LevelReport): string => {
  const tileHtml = tiles(report).map(({ label, value }) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  return `<div class="report-tiles">${tileHtml}</div>${report.players.length > 1 ? table(report) : ''}`;
};
