import { Container } from 'pixi.js';
import { BACKDROP_WIDTH } from '../config';
import { Scene, newRun } from '../core/Scene';
import { centeredCameraX } from '../core/viewport';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { loadSandbox, saveSandbox } from '../core/sandboxStorage';
import type { Loadout } from '../data/loadout';
import type { MobaRules } from '../data/mobaRules';
import { normalizeSandbox } from '../data/sandbox';
import { hostCoop, joinCoop, leaveCoop, otherQuivers, pickTeam, playerLabel, roomTeams, setRoomListener, settleSeats, shareLoadout, transportMode } from '../net/coopLink';
import type { NetMessage } from '../net/protocol';
import { normalizeRoomCode } from '../net/roomCode';
import { hostRoom, joinRoom, type HostedRoom } from '../net/Transport';
import { Background } from '../rendering/Background';
import type { CoopView } from '../ui/DomUi';
import type { LobbyTeams } from '../ui/CoopPanel';

/**
 * The online lobby, opened from the menu's "Create multiplayer room" (pick Co-op or MOBA, then the room opens and its
 * code is passed on) or "Join online" (a room code; the host's room decides the mode). Co-op: up to three guests, the
 * host then sets up the battle (SandboxScene) and starts it. MOBA: teams, and the host's Rules tab, then the match.
 * The guests wait here until the host's `start` arrives.
 */
export class CoopScene extends Scene {
  private readonly backdrop = new Container();
  private room?: HostedRoom;
  private view: CoopView = { kind: 'create' };

  public enter(): void {
    const { ui, session } = this.ctx;
    ui.showScreen('coop');
    ui.setTheme(BATTLEGROUNDS.greenMeadow.ui);
    this.backdrop.sortableChildren = true;
    new Background(this.backdrop, BATTLEGROUNDS.greenMeadow, BACKDROP_WIDTH);
    this.ctx.root.addChild(this.backdrop);

    ui.handlers.coopHost = (moba) => {
      session.moba = moba;
      void this.host();
    };
    ui.handlers.coopJoin = (code) => void this.join(code);
    // MOBA: no battle setup (always the Green Meadow; the rules are the Rules tab's), straight into the match.
    ui.handlers.coopSetup = () => (session.moba ? this.startMoba() : this.ctx.goTo('sandbox'));
    ui.handlers.coopLeave = () => this.leave();
    ui.handlers.coopLoadout = (loadout) => this.pickLoadout(loadout);
    ui.handlers.coopTeam = (team) => pickTeam(session, team);
    ui.handlers.mobaPractice = () => {
      session.moba = true;
      this.startMoba();
    };
    ui.handlers.mobaRules = (rules) => this.changeRules(rules);
    // Someone joined or left, or picked a quiver: show it.
    setRoomListener(() => this.refreshRoom());
    this.onExit(() => {
      ui.handlers.coopHost = undefined;
      ui.handlers.coopJoin = undefined;
      ui.handlers.coopSetup = undefined;
      ui.handlers.coopLeave = undefined;
      ui.handlers.coopLoadout = undefined;
      ui.handlers.coopTeam = undefined;
      ui.handlers.mobaPractice = undefined;
      ui.handlers.mobaRules = undefined;
      setRoomListener(undefined);
    });
    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        this.leave();
      }
    });

    // Back from a battle or the setup: still linked.
    const { net } = session;
    if (net?.role === 'host') {
      settleSeats(session);
      this.render({ kind: 'hosting', code: net.code, guests: otherQuivers(session), teams: this.teams(), rules: this.rules() });
    } else if (net?.role === 'guest') {
      this.listenAsGuest();
      this.renderJoined(net.code);
    } else {
      // A notice (the host left, the room was full) is about joining.
      const entry = session.coopNotice ? 'join' : session.lobbyEntry ?? 'create';
      this.render({ kind: entry, error: session.coopNotice });
      session.coopNotice = undefined;
    }
  }

  public update(): void {
    this.backdrop.x = -centeredCameraX();
  }

  private render(view: CoopView): void {
    this.view = view;
    this.ctx.ui.renderCoop(view);
  }

  private async host(): Promise<void> {
    this.render({ kind: 'hosting', guests: [], rules: this.rules() });
    try {
      const room = await hostRoom(transportMode());
      this.room = room;
      if (this.view.kind !== 'hosting') {
        room.close();
        return;
      }
      // The room stays open: guests come (and go) while the host waits here or sets up the battle.
      hostCoop(this.ctx, room, this.ctx.session.sandbox.loadout);
      this.render({ kind: 'hosting', code: room.code, guests: [], teams: this.teams(), rules: this.rules() });
    } catch (error) {
      this.render({ kind: 'create', error: (error as Error).message });
    }
  }

  private async join(input: string): Promise<void> {
    const code = normalizeRoomCode(input);
    if (!code) {
      this.render({ kind: 'join', error: 'A room code has five letters and digits.' });
      return;
    }
    // Co-op until the host's roster says the room is a MOBA one.
    this.ctx.session.moba = false;
    this.render({ kind: 'joining', code });
    try {
      const transport = await joinRoom(code, transportMode());
      if (this.view.kind !== 'joining') {
        transport.close();
        return;
      }
      // The guest starts from the quiver of their own last setup.
      joinCoop(this.ctx, code, transport, loadSandbox().loadout);
      this.listenAsGuest();
      transport.send({ t: 'hello' });
      this.renderJoined(code);
    } catch (error) {
      this.render({ kind: 'join', error: (error as Error).message });
    }
  }

  /** Waiting in the lobby: the host's `start` takes the guest into the battle. */
  private listenAsGuest(): void {
    this.ctx.session.net?.transport.onMessage((message: NetMessage) => {
      if (message.t === 'start') {
        const { session } = this.ctx;
        session.sandbox = message.sandbox;
        session.run = message.run;
        session.moba = message.moba;
        session.teams = message.teams;
        if (session.net) {
          session.net.wind = message.wind;
        }
        this.ctx.goTo('game');
      }
    });
  }

  /** Joined: the guest's own quiver to edit, with the others' beside it. */
  private renderJoined(code: string, notice?: string): void {
    const { session } = this.ctx;
    const net = session.net;
    const loadout = (net && net.loadouts[net.localIndex]) ?? loadSandbox().loadout;
    const you = net?.present.length ? playerLabel(net.localIndex) : undefined;
    this.render({ kind: 'joined', code, notice, you, loadout, others: otherQuivers(session), teams: this.teams() });
  }

  /** MOBA host: the match's rules for the Rules tab (undefined otherwise). */
  private rules(): MobaRules | undefined {
    return this.ctx.session.moba ? this.ctx.session.sandbox.moba : undefined;
  }

  /** MOBA host: the Rules tab changed; kept with the setup (and sent to the guests with `start`). */
  private changeRules(rules: MobaRules): void {
    const { session } = this.ctx;
    session.sandbox = normalizeSandbox({ ...session.sandbox, moba: rules });
    saveSandbox(session.sandbox);
  }

  /** MOBA (in the room, or alone): a fresh run at the room's bowman health, then the match. */
  private startMoba(): void {
    const { session } = this.ctx;
    session.run = newRun(session.sandbox, session.playerCount, true);
    this.ctx.goTo('game');
  }

  /** MOBA: the room's teams (undefined otherwise). */
  private teams(): LobbyTeams | undefined {
    return this.ctx.session.moba ? roomTeams(this.ctx.session) : undefined;
  }

  private refreshRoom(): void {
    const { session } = this.ctx;
    if (this.view.kind === 'joined') {
      this.renderJoined(this.view.code, this.view.notice);
    } else if (this.view.kind === 'hosting' && this.view.code) {
      this.render({ ...this.view, guests: otherQuivers(session), teams: this.teams(), rules: this.rules() });
    }
  }

  /** The guest picked arrows: sent to the host, and remembered with this browser's own setup for next time. */
  private pickLoadout(loadout: Loadout): void {
    if (this.view.kind !== 'joined') {
      return;
    }
    shareLoadout(this.ctx.session, loadout);
    saveSandbox({ ...loadSandbox(), loadout });
    this.renderJoined(this.view.code, this.view.notice);
  }

  private leave(): void {
    this.room?.close();
    this.room = undefined;
    leaveCoop(this.ctx);
    this.ctx.goTo('menu');
  }
}
