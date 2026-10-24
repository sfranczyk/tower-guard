import type { Loadout } from '../data/loadout';
import { MAX_TEAM_SIZE, teamsReady, type Team } from '../data/moba';
import { editQuiverIn } from './quiverEditing';
import { panelTop, renderPanel } from './panelLayout';
import { partnerQuiver, quiverPage, type PartnerQuiver } from './quiverPage';

/** What the co-op lobby shows. */
export type CoopView =
  /** Host a game or join one by code (with the last error, if any). */
  | { kind: 'choose'; error?: string; moba?: boolean }
  /** Hosting: the code to pass on, and the guests who are in (up to three) with the quivers they picked. */
  | { kind: 'hosting'; code?: string; guests: PartnerQuiver[]; teams?: LobbyTeams }
  | { kind: 'joining'; code: string }
  /**
   * Joined: waiting for the host to start the battle, meanwhile picking a quiver; the others' beside it. `you` names
   * this player's seat once the host has told it.
   */
  | { kind: 'joined'; code: string; notice?: string; you?: string; loadout: Loadout; others: PartnerQuiver[]; teams?: LobbyTeams };

/** MOBA lobby: who is on which team (instead of the quivers: arrows are bought in the match). */
export type LobbyTeams = ReadonlyArray<{ label: string; team: Team; you: boolean }>;

const TEAM_NAMES: Readonly<Record<Team, string>> = { blue: 'Blue · left keep', red: 'Red · right keep' };

/** The two teams side by side, with a button to switch to the other one (when it has room). */
const teamsHtml = (teams: LobbyTeams): string => {
  const own = teams.find((entry) => entry.you)?.team;
  return `<div class="coop-teams">${(['blue', 'red'] as const).map((team) => {
    const members = teams.filter((entry) => entry.team === team);
    const join = own && own !== team && members.length < MAX_TEAM_SIZE ? `<button class="chip-button" data-coop-team="${team}">Join</button>` : '';
    return `<div class="coop-team coop-team-${team}"><h3>${TEAM_NAMES[team]}</h3>`
      + `${members.map((entry) => `<p${entry.you ? ' class="you"' : ''}>${escapeHtml(entry.label)}${entry.you ? ' (you)' : ''}</p>`).join('') || '<p class="empty">Nobody yet</p>'}${join}</div>`;
  }).join('')}</div>`;
};

export interface CoopPanelCallbacks {
  host(): void;
  join(code: string): void;
  /** Host with at least one guest in: on to the battle setup. */
  setup(): void;
  /** Leave the room (or the lobby) and go back to the menu. */
  leave(): void;
  /** Joined: the guest changed their quiver. */
  loadoutChange(loadout: Loadout): void;
  /** MOBA: this player switches team. */
  teamChange(team: Team): void;
  /** MOBA: a practice match alone. */
  practice(): void;
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
      } else if (target.closest('[data-moba-practice]')) {
        callbacks.practice();
      } else if (target.closest('[data-coop-leave]')) {
        callbacks.leave();
      } else if (target.closest<HTMLElement>('[data-coop-team]')) {
        callbacks.teamChange(target.closest<HTMLElement>('[data-coop-team]')!.dataset.coopTeam as Team);
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
          <p class="coop-copy">${view.moba
            ? 'Blue against red, up to three a side: minions march down the lane, gold buys upgrades by your keep (press I), the first keep to fall loses. One hosts, the others join with the room code.'
            : 'Defend the keep together, two to four of you: one hosts, the others join with the room code.'}</p>
          <button class="primary-button" data-coop-host>Host a game</button>
          <div class="coop-join">
            <input data-coop-code maxlength="7" placeholder="Room code" autocomplete="off" spellcheck="false">
            <button class="secondary-button" data-coop-join>Join</button>
          </div>
          ${view.moba ? '<button class="secondary-button" data-moba-practice>Practice alone</button>' : ''}
          ${view.error ? `<p class="coop-error">${escapeHtml(view.error)}</p>` : ''}`;
        break;
      case 'hosting':
        leave = view.code ? 'Close the room' : 'Cancel';
        // MOBA: a player on each team first.
        actions = view.code && view.guests.length > 0 && (!view.teams || teamsReady(view.teams.map((entry) => entry.team)))
          ? `<button class="primary-button" data-coop-setup>${view.teams ? 'Start match' : 'Battle setup'}</button>` : '';
        body = view.code
          ? (view.teams ? this.mobaHosting(view.code, view.guests.length, view.teams) : `
          <p class="coop-copy">Give the others this room code (up to three can join):</p>
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${view.guests.length === 0 ? 'Waiting for players…'
            : view.guests.length < 3 ? `${view.guests.length + 1} of 4 in · more can still join` : 'The room is full!'}</p>
          ${view.guests.map(partnerQuiver).join('')}`)
          : '<p class="coop-status">Opening a room…</p>';
        break;
      case 'joining':
        leave = 'Cancel';
        body = `<p class="coop-status">Joining room ${escapeHtml(view.code)}…</p>`;
        break;
      case 'joined':
        body = `
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${escapeHtml(view.notice ?? `Connected${view.you ? ` as ${view.you}` : ''}! ${view.teams ? 'Pick your team' : 'Pick your arrows'} while the host sets up the battle…`)}</p>
          ${view.teams ? teamsHtml(view.teams) : quiverPage(view.loadout, this.selectedSlot, view.others)}`;
        leave = 'Leave the room';
        break;
    }
    // The guest's quiver needs the room of a full card.
    this.root.classList.toggle('coop-wide', view.kind === 'joined' && !view.teams);
    const back = `<button class="secondary-button small-button" data-coop-leave>← ${leave}</button>`;
    const moba = view.kind === 'choose' ? view.moba : view.kind !== 'joining' && view.teams !== undefined;
    renderPanel(this.root, `${panelTop(back, moba ? 'MOBA' : 'Co-op', actions)}<div class="panel-body coop-body">${body}</div>`);
    this.root.querySelector<HTMLInputElement>('[data-coop-code]')?.focus();
  }

  /** MOBA host: the code, the teams (a match needs a player on each), up to six in the room. */
  private mobaHosting(code: string, guests: number, teams: LobbyTeams): string {
    const ready = teamsReady(teams.map((entry) => entry.team));
    const status = guests === 0 ? 'Waiting for players…' : !ready ? 'Each team needs a player' : guests + 1 < MAX_TEAM_SIZE * 2 ? `${guests + 1} of ${MAX_TEAM_SIZE * 2} in · more can still join` : 'The room is full!';
    return `
          <p class="coop-copy">MOBA: give the others this room code (up to ${MAX_TEAM_SIZE} a team):</p>
          <div class="coop-code">${escapeHtml(code)}</div>
          <p class="coop-status">${status}</p>
          ${teamsHtml(teams)}`;
  }

  private join(): void {
    const input = this.root.querySelector<HTMLInputElement>('[data-coop-code]');
    this.callbacks.join(input?.value ?? '');
  }
}
