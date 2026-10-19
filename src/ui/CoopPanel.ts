import type { Loadout } from '../data/loadout';
import { editQuiverIn } from './quiverEditing';
import { panelTop, renderPanel } from './panelLayout';
import { partnerQuiver, quiverPage, type PartnerQuiver } from './quiverPage';

/** What the co-op lobby shows. */
export type CoopView =
  /** Host a game or join one by code (with the last error, if any). */
  | { kind: 'choose'; error?: string }
  /** Hosting: the code to pass on, and the guests who are in (up to three) with the quivers they picked. */
  | { kind: 'hosting'; code?: string; guests: PartnerQuiver[] }
  | { kind: 'joining'; code: string }
  /**
   * Joined: waiting for the host to start the battle, meanwhile picking a quiver; the others' beside it. `you` names
   * this player's seat once the host has told it.
   */
  | { kind: 'joined'; code: string; notice?: string; you?: string; loadout: Loadout; others: PartnerQuiver[] };

export interface CoopPanelCallbacks {
  host(): void;
  join(code: string): void;
  /** Host with at least one guest in: on to the battle setup. */
  setup(): void;
  /** Leave the room (or the lobby) and go back to the menu. */
  leave(): void;
  /** Joined: the guest changed their quiver. */
  loadoutChange(loadout: Loadout): void;
}

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The co-op lobby card: host or join, the room code, and who's waiting for whom. */
export class CoopPanel {
  private view?: CoopView;
  /** Joined: the quiver slot the next picked arrow goes into. */
  private selectedSlot = 0;

  public constructor(private readonly root: HTMLElement, private readonly callbacks: CoopPanelCallbacks) {
    editQuiverIn(
      root,
      () => (this.view?.kind === 'joined' ? { loadout: this.view.loadout, slot: this.selectedSlot } : undefined),
      ({ loadout, slot, changed }) => {
        this.selectedSlot = slot;
        if (changed) {
          callbacks.loadoutChange(loadout);
        } else if (this.view) {
          this.render(this.view);
        }
      },
    );
    root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-coop-host]')) {
        callbacks.host();
      } else if (target.closest('[data-coop-join]')) {
        this.join();
      } else if (target.closest('[data-coop-setup]')) {
        callbacks.setup();
      } else if (target.closest('[data-coop-leave]')) {
        callbacks.leave();
      }
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.target as HTMLElement).matches('[data-coop-code]')) {
        this.join();
      }
      // Typing a code mustn't trigger game keys (Space starts the game in the menu).
      event.stopPropagation();
    });
  }

  public render(view: CoopView): void {
    this.view = view;
    // Back / leave sits in the top bar.
    let leave = 'Back';
    let actions = '';
    let body: string;
    switch (view.kind) {
      case 'choose':
        body = `
          <p class="coop-copy">Defend the keep together, two to four of you: one hosts, the others join with the room code.</p>
          <button class="primary-button" data-coop-host>Host a game</button>
          <div class="coop-join">
            <input data-coop-code maxlength="7" placeholder="Room code" autocomplete="off" spellcheck="false">
            <button class="secondary-button" data-coop-join>Join</button>
          </div>
          ${view.error ? `<p class="coop-error">${escapeHtml(view.error)}</p>` : ''}`;
        break;
      case 'hosting':
        leave = view.code ? 'Close the room' : 'Cancel';
        actions = view.code && view.guests.length > 0 ? '<button class="primary-button" data-coop-setup>Battle setup</button>' : '';
        body = view.code
          ? `
          <p class="coop-copy">Give the others this room code (up to three can join):</p>
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${view.guests.length === 0 ? 'Waiting for players…'
            : view.guests.length < 3 ? `${view.guests.length + 1} of 4 in · more can still join` : 'The room is full!'}</p>
          ${view.guests.map(partnerQuiver).join('')}`
          : '<p class="coop-status">Opening a room…</p>';
        break;
      case 'joining':
        leave = 'Cancel';
        body = `<p class="coop-status">Joining room ${escapeHtml(view.code)}…</p>`;
        break;
      case 'joined':
        body = `
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${escapeHtml(view.notice ?? `Connected${view.you ? ` as ${view.you}` : ''}! Pick your arrows while the host sets up the battle…`)}</p>
          ${quiverPage(view.loadout, this.selectedSlot, view.others)}`;
        leave = 'Leave the room';
        break;
    }
    // The guest's quiver needs the room of a full card.
    this.root.classList.toggle('coop-wide', view.kind === 'joined');
    const back = `<button class="secondary-button small-button" data-coop-leave>← ${leave}</button>`;
    renderPanel(this.root, `${panelTop(back, 'Co-op', actions)}<div class="panel-body coop-body">${body}</div>`);
    this.root.querySelector<HTMLInputElement>('[data-coop-code]')?.focus();
  }

  private join(): void {
    const input = this.root.querySelector<HTMLInputElement>('[data-coop-code]');
    this.callbacks.join(input?.value ?? '');
  }
}
