/** A player's alias (nickname) in online rooms: picked in the lobby, shown in the room's lists and over the bowman. */
export const MAX_ALIAS_LENGTH = 16;

/** The alias as kept and sent: no control characters, single spaces, trimmed, at most MAX_ALIAS_LENGTH ('' = none). */
export const normalizeAlias = (text: unknown): string => (typeof text === 'string'
  ? Array.from(text.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, MAX_ALIAS_LENGTH).join('').trim()
  : '');

/** What player `index` is called: their alias, else "Host" (player 1 of a room) or "Player N". */
export const playerName = (index: number, alias?: string, hosted = true): string =>
  alias || (index === 0 && hosted ? 'Host' : `Player ${index + 1}`);
