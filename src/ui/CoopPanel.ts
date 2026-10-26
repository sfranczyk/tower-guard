import type { Loadout } from '../data/loadout';
import { MAX_TEAM_SIZE, teamsReady, type Team } from '../data/moba';
import type { MobaNumberRule, MobaRules } from '../data/mobaRules';
import { MAX_ALIAS_LENGTH } from '../data/playerAlias';
import { editQuiverIn } from './quiverEditing';
import { panelTop, renderPanel } from './panelLayout';
import { partnerQuiver, quiverPage, type PartnerQuiver } from './quiverPage';
import { mobaRulesPage, readMobaRules, roomModeCards, type RoomMode } from './roomSetup';

/** What the co-op lobby shows. */
export type CoopView =
  /** The menu's "Create online room": pick the room's mode, Co-op or MOBA (with the last error, if any). */
  | { kind: 'create'; error?: string }
  /** The menu's "Join online": a dialog for the room code (co-op or MOBA: the host's room decides). */
  | { kind: 'join'; error?: string }
  /**
   * Hosting: the code to pass on, and the guests who are in (up to three) with the quivers they picked. MOBA: the
   * teams, and the match's `rules` on a tab of their own.
   */
  | { kind: 'hosting'; code?: string; guests: PartnerQuiver[]; teams?: LobbyTeams; rules?: MobaRules }
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
  /** Open a room in this mode (true: MOBA). */
  host(mode: RoomMode): void;
  join(code: string): void;
  /** Host with at least one guest in: on to the battle setup. */
  setup(): void;
  /** Leave the room (or the lobby) and go back to the menu. */
  leave(): void;
  /** Joined: the guest changed their quiver. */
  loadoutChange(loadout: Loadout): void;
  /** MOBA: this player switches team. */
  teamChange(team: Team): void;
  /** MOBA host: the match's rules were changed on the Rules tab (clamped). */
  rulesChange(rules: MobaRules): void;
  /** The "Your name" field was edited (on leaving it or Enter). */
  aliasChange(alias: string): void;
}

/** The MOBA host's tabs: who is on which team, and the match's rules. */
type HostTab = 'teams' | 'rules';

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Your name": this player's alias, shown to the others and over the bowman while Ctrl is held. */
const aliasRow = (alias: string, placeholder: string): string => `<label class="coop-alias">
  <span>Your name</span>
  <input data-player-alias maxlength="${MAX_ALIAS_LENGTH}" placeholder="${placeholder}" value="${escapeHtml(alias)}" autocomplete="off" spellcheck="false" title="Shown to the others, and over your bowman while Ctrl is held">
</label>`;

/** The co-op lobby card: host or join, the room code, and who's waiting for whom. */
export class CoopPanel {
  private view?: CoopView;
  /** Joined: the quiver slot the next picked arrow goes into. */
  private selectedSlot = 0;
  private hostTab: HostTab = 'teams';
  /** The alias as last given by the scene, and as typed but not yet passed on (`draft`). */
  private alias = '';
  private draft?: string;

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
      const mode = target.closest<HTMLElement>('[data-room-mode]')?.dataset.roomMode as RoomMode | undefined;
      const tab = target.closest<HTMLElement>('[data-host-tab]')?.dataset.hostTab as HostTab | undefined;
      if (mode) {
        callbacks.host(mode);
      } else if (tab && this.view) {
        this.hostTab = tab;
        this.render(this.view);
      } else if (target.closest('[data-coop-join]')) {
        this.join();
      } else if (target.closest('[data-coop-setup]')) {
        callbacks.setup();
      } else if (target.closest('[data-coop-leave]')) {
        callbacks.leave();
      } else if (target.closest<HTMLElement>('[data-moba-toggle]') && this.view?.kind === 'hosting' && this.view.rules) {
        const toggle = target.closest<HTMLElement>('[data-moba-toggle]')!;
        const rules = { ...readMobaRules(root, this.view.rules), [toggle.dataset.mobaToggle as 'allyPenalty']: toggle.dataset.value === 'true' };
        callbacks.rulesChange(rules);
        this.render({ ...this.view, rules });
      } else if (target.closest<HTMLElement>('[data-coop-team]')) {
        callbacks.teamChange(target.closest<HTMLElement>('[data-coop-team]')!.dataset.coopTeam as Team);
      }
    });
    // Rules: each keystroke is kept (clamped); leaving the field shows the clamped value.
    root.addEventListener('input', (event) => {
      if ((event.target as HTMLElement).matches('[data-player-alias]')) {
        this.draft = (event.target as HTMLInputElement).value;
      }
      if ((event.target as HTMLElement).matches('[data-moba-rule]') && this.view?.kind === 'hosting' && this.view.rules) {
        const rules = readMobaRules(root, this.view.rules);
        this.view = { ...this.view, rules };
        callbacks.rulesChange(rules);
      }
    });
    root.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.matches('[data-player-alias]')) {
        this.draft = undefined;
        this.alias = input.value;
        callbacks.aliasChange(input.value);
        return;
      }
      const rule = input.dataset.mobaRule as MobaNumberRule | undefined;
      if (rule && this.view?.kind === 'hosting' && this.view.rules) {
        input.value = `${this.view.rules[rule]}`;
      }
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.target as HTMLElement).matches('[data-coop-code]')) {
        this.join();
      }
      if (event.key === 'Enter' && (event.target as HTMLElement).matches('[data-player-alias]')) {
        (event.target as HTMLInputElement).blur();
      }
      // Typing a code mustn't trigger game keys (Space starts the game in the menu).
      event.stopPropagation();
    });
  }

  public render(view: CoopView, alias = this.alias): void {
    this.alias = alias;
    const typed = this.draft ?? alias;
    // A redraw (someone joined, the roster came) mustn't take the field from under the typing.
    const focused = document.activeElement?.matches('[data-player-alias]') ? document.activeElement as HTMLInputElement : undefined;
    const caret = focused ? [focused.selectionStart, focused.selectionEnd] : undefined;
    if (view.kind !== 'hosting' || this.view?.kind !== 'hosting') {
      this.hostTab = 'teams';
    }
    this.view = view;
    // Back / leave sits in the top bar.
    let leave = 'Back';
    let actions = '';
    let body: string;
    switch (view.kind) {
      case 'create':
        body = `${roomModeCards()}${view.error ? `<p class="coop-error">${escapeHtml(view.error)}</p>` : ''}`;
        break;
      case 'join':
        body = `
          ${aliasRow(typed, 'Player')}
          <p class="coop-copy">Type the room code the host gave you: co-op or MOBA, the room decides.</p>
          <div class="coop-join">
            <input data-coop-code maxlength="7" placeholder="Room code" autocomplete="off" spellcheck="false">
            <button class="primary-button" data-coop-join>Join</button>
          </div>
          ${view.error ? `<p class="coop-error">${escapeHtml(view.error)}</p>` : ''}`;
        break;
      case 'hosting':
        leave = view.code ? 'Close the room' : 'Cancel';
        // MOBA: a player on each team first.
        actions = view.code && view.guests.length > 0 && (!view.teams || teamsReady(view.teams.map((entry) => entry.team)))
          ? `<button class="primary-button" data-coop-setup>${view.teams ? 'Start match' : 'Battle setup'}</button>` : '';
        body = view.code
          ? (view.teams ? this.mobaHosting(view.code, view.guests.length, view.teams, view.rules, typed) : `
          <p class="coop-copy">Give the others this room code (up to three can join):</p>
          <div class="coop-code">${escapeHtml(view.code)}</div>
          <p class="coop-status">${view.guests.length === 0 ? 'Waiting for players…'
            : view.guests.length < 3 ? `${view.guests.length + 1} of 4 in · more can still join` : 'The room is full!'}</p>
          ${aliasRow(typed, 'Host')}
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
          ${aliasRow(typed, 'Player')}
          ${view.teams ? teamsHtml(view.teams) : quiverPage(view.loadout, this.selectedSlot, view.others)}`;
        leave = 'Leave the room';
        break;
    }
    // The mode cards, the guest's quiver and the MOBA host's tabs (both, so switching them moves nothing) use the frame's
    // full width; the other views are a column in its middle.
    const mobaTabs = view.kind === 'hosting' && view.rules !== undefined && view.code !== undefined;
    this.root.classList.toggle('coop-wide', view.kind === 'create' || (view.kind === 'joined' && !view.teams) || mobaTabs);
    const back = `<button class="secondary-button small-button" data-coop-leave>← ${leave}</button>`;
    const moba = view.kind === 'hosting' ? view.rules !== undefined : view.kind === 'joined' && view.teams !== undefined;
    const title = view.kind === 'create' ? 'Create a room' : view.kind === 'join' ? 'Join online' : moba ? 'MOBA' : 'Co-op';
    renderPanel(this.root, `${panelTop(back, title, actions, view.kind === 'create' || view.kind === 'join' ? 'Multiplayer' : '')}<div class="panel-body coop-body">${body}</div>`);
    const field = this.root.querySelector<HTMLInputElement>('[data-player-alias]');
    if (caret && field) {
      field.focus();
      field.setSelectionRange(caret[0], caret[1]);
    } else {
      this.root.querySelector<HTMLInputElement>('[data-coop-code]')?.focus();
    }
  }

  /** MOBA host: the code, then the Teams tab (a match needs a player on each, up to six in the room) or the Rules tab. */
  private mobaHosting(code: string, guests: number, teams: LobbyTeams, rules: MobaRules | undefined, alias: string): string {
    const ready = teamsReady(teams.map((entry) => entry.team));
    const status = guests === 0 ? 'Waiting for players…' : !ready ? 'Each team needs a player' : guests + 1 < MAX_TEAM_SIZE * 2 ? `${guests + 1} of ${MAX_TEAM_SIZE * 2} in · more can still join` : 'The room is full!';
    const room = `
          <p class="coop-copy">MOBA: give the others this room code (up to ${MAX_TEAM_SIZE} a team):</p>
          <div class="coop-code">${escapeHtml(code)}</div>
          <p class="coop-status">${status}</p>
          ${aliasRow(alias, 'Host')}
          ${teamsHtml(teams)}`;
    if (!rules) {
      return room;
    }
    const tabs = (['teams', 'rules'] as const).map((tab) => `<button type="button" class="sandbox-page${tab === this.hostTab ? ' active' : ''}" role="tab" aria-selected="${tab === this.hostTab}" data-host-tab="${tab}">${tab === 'teams' ? 'Teams' : 'Rules'}</button>`).join('');
    const head = `<div class="sandbox-head room-tabs"><div class="sandbox-pages" role="tablist" aria-label="Room pages">${tabs}</div></div>`;
    return `${head}${this.hostTab === 'rules' ? mobaRulesPage(rules) : room}`;
  }

  private join(): void {
    const input = this.root.querySelector<HTMLInputElement>('[data-coop-code]');
    this.callbacks.join(input?.value ?? '');
  }
}
