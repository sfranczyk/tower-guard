import { describe, expect, it } from 'vitest';
import { MOBA_PLAYERS } from '../config';
import { MobaEconomy, freshRecovery, isRegenerating, noteHit, regenStep } from './mobaEconomy';

describe('MobaEconomy', () => {
  const teams = ['blue', 'red', 'blue'] as const;

  it('pays the last hit on an enemy minion by its kind', () => {
    const economy = new MobaEconomy(teams, 0);
    expect(economy.kill(0, { team: 'red', minion: 'troop' })).toBe(MOBA_PLAYERS.troopGold);
    expect(economy.kill(0, { team: 'red', minion: 'archer' })).toBe(MOBA_PLAYERS.archerGold);
    expect(economy.kill(1, { team: 'blue', minion: 'dragon' })).toBe(MOBA_PLAYERS.dragonGold);
    expect(economy.gold).toEqual([MOBA_PLAYERS.troopGold + MOBA_PLAYERS.archerGold, MOBA_PLAYERS.dragonGold, 0]);
  });

  it('takes half the reward for your own minions, or nothing with the penalty off', () => {
    const economy = new MobaEconomy(teams, 50);
    expect(economy.kill(0, { team: 'blue', minion: 'dragon' })).toBe(-Math.round(MOBA_PLAYERS.dragonGold / 2));
    expect(economy.kill(0, { team: 'blue', minion: 'troop' }, false)).toBe(0);
    expect(economy.gold[0]).toBe(50 - Math.round(MOBA_PLAYERS.dragonGold / 2));
  });

  it('pays for an enemy player and takes half that for a teammate, no more than he has', () => {
    const economy = new MobaEconomy(teams, 30);
    expect(economy.kill(0, { team: 'red', player: 1 })).toBe(MOBA_PLAYERS.playerGold);
    expect(economy.kill(2, { team: 'blue', player: 0 })).toBe(-30);
    expect(economy.gold[2]).toBe(0);
    expect(economy.kill(1, { team: 'red', player: 1 })).toBe(0);
    expect(new MobaEconomy(teams, 500).kill(2, { team: 'blue', player: 0 })).toBe(-MOBA_PLAYERS.playerGold / 2);
  });

  it('moves gold to and from the team vault in steps', () => {
    const economy = new MobaEconomy(teams, 25);
    economy.moveVault(0, true, 10);
    economy.moveVault(2, true, 10);
    expect(economy.vault.blue).toBe(20);
    economy.moveVault(0, false, 10);
    expect(economy.gold[0]).toBe(25);
    economy.moveVault(0, true, 30);
    expect(economy.gold[0]).toBe(0);
    expect(economy.vault).toEqual({ blue: 35, red: 0 });
  });

  it('pays a bonus to a player in the match only', () => {
    const economy = new MobaEconomy(['blue', 'red'], 10);
    expect(economy.earn(1, 100)).toBe(100);
    expect(economy.gold).toEqual([10, 110]);
    expect(economy.earn(5, 100)).toBe(0);
  });

  it('spends only what is there', () => {
    const economy = new MobaEconomy(teams, 100);
    expect(economy.spend(0, 150)).toBe(false);
    expect(economy.spend(0, 100)).toBe(true);
    expect(economy.gold[0]).toBe(0);
    expect(economy.spendVault('red', 1)).toBe(false);
  });
});

describe('regenStep', () => {
  it('heals only after the quiet wait, a tick at a time', () => {
    const recovery = freshRecovery();
    let healed = 0;
    for (let t = 0; t < MOBA_PLAYERS.regenDelayMs + MOBA_PLAYERS.regenEveryMs * 2; t += 100) {
      healed += regenStep(recovery, 100, 5);
    }
    expect(healed).toBe(10);
  });

  it('starts over after a hit', () => {
    const recovery = freshRecovery();
    regenStep(recovery, MOBA_PLAYERS.regenDelayMs + MOBA_PLAYERS.regenEveryMs - 1, 5);
    noteHit(recovery);
    let healed = 0;
    for (let t = 0; t < MOBA_PLAYERS.regenDelayMs; t += 100) {
      healed += regenStep(recovery, 100, 5);
    }
    expect(healed).toBe(0);
  });

  it('regenerates only when hurt, standing and out of combat long enough', () => {
    const recovery = freshRecovery();
    expect(isRegenerating(recovery, 50, 100)).toBe(false);
    recovery.quietMs = MOBA_PLAYERS.regenDelayMs;
    expect(isRegenerating(recovery, 50, 100)).toBe(true);
    expect(isRegenerating(recovery, 100, 100)).toBe(false);
    recovery.respawnMs = 1000;
    expect(isRegenerating(recovery, 50, 100)).toBe(false);
  });
});
