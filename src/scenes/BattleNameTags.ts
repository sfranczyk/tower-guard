import type { GameSession } from '../core/Scene';
import { nameOf } from '../net/coopLink';
import type { Player } from './PlayerControl';

const NAME_KEYS = ['ControlLeft', 'ControlRight'];

/**
 * With more than one bowman: holding Ctrl shows every player's name (their lobby alias, else "Host" / "Player N") over
 * their bowman, on this screen only. A lost focus (another window) counts as letting go.
 */
export class BattleNameTags {
  private held = false;

  public constructor(private readonly session: GameSession, listen: <K extends 'keydown' | 'keyup' | 'blur'>(type: K, handler: (event: WindowEventMap[K]) => void) => void) {
    listen('keydown', (event) => {
      if (NAME_KEYS.includes(event.code)) {
        this.held = true;
      }
    });
    listen('keyup', (event) => {
      if (NAME_KEYS.includes(event.code)) {
        this.held = false;
      }
    });
    listen('blur', () => {
      this.held = false;
    });
  }

  public update(players: readonly Player[]): void {
    const shown = this.held && players.length > 1;
    players.forEach((player) => player.bowman.setNameTag(shown ? nameOf(this.session, player.index) : undefined));
  }
}
