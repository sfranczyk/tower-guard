import type { GameSession } from '../core/Scene';
import { nameOf } from '../net/coopLink';
import type { Player } from './PlayerControl';

const NAME_KEYS = ['ControlLeft', 'ControlRight'];

/**
 * With more than one bowman: a press of Ctrl shows every player's name (their lobby alias, else "Host" / "Player N")
 * over their bowman, on this screen only, and the next press hides them again.
 */
export class BattleNameTags {
  private shown = false;

  public constructor(private readonly session: GameSession, listen: <K extends 'keydown'>(type: K, handler: (event: WindowEventMap[K]) => void) => void) {
    listen('keydown', (event) => {
      if (NAME_KEYS.includes(event.code) && !event.repeat) {
        this.shown = !this.shown;
      }
    });
  }

  /** `mirrored`: the battle view is flipped, and the names flip back so they read the right way. */
  public update(players: readonly Player[], mirrored: boolean): void {
    const shown = this.shown && players.length > 1;
    players.forEach((player) => player.bowman.tags.setName(shown ? nameOf(this.session, player.index) : undefined, mirrored));
  }
}
