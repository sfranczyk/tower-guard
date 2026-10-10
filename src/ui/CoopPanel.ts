import type { Loadout } from '../data/loadout';
import { editQuiverIn } from './quiverEditing';
import { panelTop, renderPanel } from './panelLayout';
import { partnerQuiver, quiverPage } from './quiverPage';

/** What the co-op lobby shows. */
export type CoopView =
  /** Host a game or join one by code (with the last error, if any). */
  | { kind: 'choose'; error?: string }
  /** Hosting: the code to pass on, whether the partner is in, and the quiver they picked. */
  | { kind: 'hosting'; code?: string; partner: boolean; partnerLoadout?: Loadout }
  | { kind: 'joining'; code: string }
  /** Joined: waiting for the host to start the battle, meanwhile picking a quiver; the host's beside it. */
  | { kind: 'joined'; code: string; notice?: string; loadout: Loadout; partnerLoadout?: Loadout };

export interface CoopPanelCallbacks {
  host(): void;
  join(code: string): void;
  /** Host with the partner in: on to the battle setup. */
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
          <p class="coop-copy">Defend the keep together: one of you hosts, the other joins with the room code.</p>
          <button class="primary-button" data-coop-host>Host a game</button>
          <div class="coop-join">
            <input data-coop-code maxlength="7" placeholder="Room code" autocomplete="off" spellcheck="false">
            <button class="secondary-button" data-coop-join>Join</button>
          </div>
          ${view.error ? `<p class="coop-error">${escapeHtml(view.error)}</p>` : ''}`;
        break;
      case 'hosting':
        leave = view.code ? 'Close the room' : 'Cancel';
        actions = view.code && view.partner ? '<button class="primary-button" data-coop-setup>Battle setup</button>' : '';
        body = view.code
          ? `
          <p class="coop-copy">Give your partner this room code:</p>
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${view.partner ? 'Your partner has joined!' : 'Waiting for your partner…'}</p>
          ${view.partner ? partnerQuiver({ label: "Partner's quiver", loadout: view.partnerLoadout }) : ''}`
          : '<p class="coop-status">Opening a room…</p>';
        break;
      case 'joining':
        leave = 'Cancel';
        body = `<p class="coop-status">Joining room ${escapeHtml(view.code)}…</p>`;
        break;
      case 'joined':
        body = `
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${escapeHtml(view.notice ?? 'Connected! Pick your arrows while the host sets up the battle…')}</p>
          ${quiverPage(view.loadout, this.selectedSlot, { label: "Host's quiver", loadout: view.partnerLoadout })}`;
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
