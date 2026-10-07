/** What the co-op lobby shows. */
export type CoopView =
  /** Host a game or join one by code (with the last error, if any). */
  | { kind: 'choose'; error?: string }
  /** Hosting: the code to pass on, and whether the partner is in. */
  | { kind: 'hosting'; code?: string; partner: boolean }
  | { kind: 'joining'; code: string }
  /** Joined: waiting for the host to start the battle. */
  | { kind: 'joined'; code: string; notice?: string };

export interface CoopPanelCallbacks {
  host(): void;
  join(code: string): void;
  /** Host with the partner in: on to the battle setup. */
  setup(): void;
  /** Leave the room (or the lobby) and go back to the menu. */
  leave(): void;
}

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The co-op lobby card: host or join, the room code, and who's waiting for whom. */
export class CoopPanel {
  public constructor(private readonly root: HTMLElement, private readonly callbacks: CoopPanelCallbacks) {
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
    const leave = (label: string): string => `<button class="secondary-button" data-coop-leave>${label}</button>`;
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
          ${view.error ? `<p class="coop-error">${escapeHtml(view.error)}</p>` : ''}
          ${leave('Back')}`;
        break;
      case 'hosting':
        body = view.code
          ? `
          <p class="coop-copy">Give your partner this room code:</p>
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${view.partner ? 'Your partner has joined!' : 'Waiting for your partner…'}</p>
          ${view.partner ? '<button class="primary-button" data-coop-setup>Battle setup</button>' : ''}
          ${leave('Close the room')}`
          : `<p class="coop-status">Opening a room…</p>${leave('Cancel')}`;
        break;
      case 'joining':
        body = `<p class="coop-status">Joining room ${escapeHtml(view.code)}…</p>${leave('Cancel')}`;
        break;
      case 'joined':
        body = `
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${escapeHtml(view.notice ?? 'Connected! Waiting for the host to start the battle…')}</p>
          ${leave('Leave the room')}`;
        break;
    }
    this.root.innerHTML = `<h2>Co-op</h2><div class="coop-body">${body}</div>`;
    this.root.querySelector<HTMLInputElement>('[data-coop-code]')?.focus();
  }

  private join(): void {
    const input = this.root.querySelector<HTMLInputElement>('[data-coop-code]');
    this.callbacks.join(input?.value ?? '');
  }
}
