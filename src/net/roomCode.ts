/**
 * Co-op room codes (pure, tested): five letters and digits that are easy to read out and type (no 0/O, 1/I/L),
 * turned into the PeerJS id the host registers under.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
const PEER_PREFIX = 'tower-guard-room-';

/** A fresh room code (`random` 0..1, passed in so tests can pin it). */
export const makeRoomCode = (random: () => number = Math.random): string =>
  Array.from({ length: ROOM_CODE_LENGTH }, () => ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length]).join('');

/** What the guest typed, cleaned up (upper case, spaces and dashes dropped); undefined if not a valid code. */
export const normalizeRoomCode = (input: string): string | undefined => {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === ROOM_CODE_LENGTH && [...code].every((char) => ALPHABET.includes(char)) ? code : undefined;
};

/** The PeerJS id a room's host listens on. */
export const peerIdFor = (code: string): string => `${PEER_PREFIX}${code.toLowerCase()}`;
