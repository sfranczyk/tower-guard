import { describe, expect, it } from 'vitest';
import { ROOM_CODE_LENGTH, makeRoomCode, normalizeRoomCode, peerIdFor } from './roomCode';

describe('room codes', () => {
  it('are five readable characters', () => {
    for (let index = 0; index < 50; index += 1) {
      const code = makeRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]+$/);
      expect(normalizeRoomCode(code)).toBe(code);
    }
    expect(makeRoomCode(() => 0)).toBe('AAAAA');
    expect(makeRoomCode(() => 0.9999)).toBe('99999');
  });

  it('accept sloppy typing but reject wrong lengths', () => {
    expect(normalizeRoomCode(' ab-cd e ')).toBe('ABCDE');
    expect(normalizeRoomCode('abcd')).toBeUndefined();
    expect(normalizeRoomCode('abcdef')).toBeUndefined();
  });

  it('map to a PeerJS id', () => {
    expect(peerIdFor('ABCDE')).toBe('tower-guard-room-abcde');
  });
});
