import { describe, expect, it } from 'vitest';
import { shopSections, type ShopFunds } from './shopView';

const funds = (player: Record<string, number>, gold: number, team: Record<string, number> = {}, vault = 0): ShopFunds =>
  ({ player: { levels: player, gold }, team: { levels: team, gold: vault } });

describe('shopSections', () => {
  it('lists the skills tab as Arrows then Passive, each arrow chained to its quick draw', () => {
    const sections = shopSections('skills', funds({}, 0));
    expect(sections.map((section) => section.title)).toEqual(['Arrows', 'Passive']);
    const fire = sections[0].cells.find(([chain]) => chain[0].id === 'arrow:fire')!;
    expect(fire.map((chain) => chain.map((button) => button.id))).toEqual([['arrow:fire', 'quick:fire']]);
  });

  it('puts Wall breaker in a row under the explosive arrow, in the same cell', () => {
    const cells = shopSections('skills', funds({}, 0))[0].cells.map((cell) => cell.map((chain) => chain.map((button) => button.id).join(' ')));
    expect(cells.find(([main]) => main.startsWith('arrow:explosive'))).toEqual(['arrow:explosive quick:explosive', 'wallBreaker wallBreaker']);
    expect(cells.some(([main]) => main.startsWith('wallBreaker'))).toBe(false);
  });

  it('marks owned, buyable, short of gold and locked levels', () => {
    const [regen] = shopSections('skills', funds({ regen: 1 }, 200))[1].cells.find(([chain]) => chain[0].id === 'regen')!;
    expect(regen.map((button) => button.state)).toEqual(['owned', 'buyable', 'locked']);
    const [poor] = shopSections('skills', funds({ regen: 1 }, 100))[1].cells.find(([chain]) => chain[0].id === 'regen')!;
    expect(poor[1].state).toBe('poor');
  });

  it('pays castle upgrades from the vault', () => {
    const [minions] = shopSections('castle', funds({}, 9999, {}, 400));
    expect(minions.cells.map(([chain]) => chain[0].state)).toEqual(['buyable', 'buyable', 'buyable']);
    expect(shopSections('castle', funds({}, 9999, {}, 0))[0].cells[0][0][0].state).toBe('poor');
  });
});
