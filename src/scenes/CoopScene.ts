import { Container } from 'pixi.js';
import { BACKDROP_WIDTH } from '../config';
import { Scene } from '../core/Scene';
import { centeredCameraX } from '../core/viewport';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { loadSandbox, saveSandbox } from '../core/sandboxStorage';
import type { Loadout } from '../data/loadout';
import { leaveCoop, linkUp, partnerLoadout, setPartnerLeftListener, setPartnerLoadoutListener, shareLoadout, transportMode } from '../net/coopLink';
import type { NetMessage } from '../net/protocol';
import { normalizeRoomCode } from '../net/roomCode';
import { hostRoom, joinRoom, type HostedRoom } from '../net/Transport';
import { Background } from '../rendering/Background';
import type { CoopView } from '../ui/DomUi';

/**
 * The co-op lobby: host a room (and pass on its code) or join one. The host then sets up the battle
 * (SandboxScene) and starts it; the guest waits here until the host's `start` arrives.
 */
export class CoopScene extends Scene {
  private readonly backdrop = new Container();
  private room?: HostedRoom;
  private view: CoopView = { kind: 'choose' };

  public enter(): void {
    const { ui, session } = this.ctx;
    ui.showScreen('coop');
    ui.setTheme(BATTLEGROUNDS.greenMeadow.ui);
    this.backdrop.sortableChildren = true;
    new Background(this.backdrop, BATTLEGROUNDS.greenMeadow, BACKDROP_WIDTH);
    this.ctx.root.addChild(this.backdrop);

    ui.handlers.coopHost = () => void this.host();
    ui.handlers.coopJoin = (code) => void this.join(code);
    ui.handlers.coopSetup = () => this.ctx.goTo('sandbox');
    ui.handlers.coopLeave = () => this.leave();
    ui.handlers.coopLoadout = (loadout) => this.pickLoadout(loadout);
    setPartnerLeftListener(() => this.render({ kind: 'choose', error: 'Your partner has left the room.' }));
    // The partner's quiver arrived or changed: show it.
    setPartnerLoadoutListener(() => this.refreshQuivers());
    this.onExit(() => {
      ui.handlers.coopHost = undefined;
      ui.handlers.coopJoin = undefined;
      ui.handlers.coopSetup = undefined;
      ui.handlers.coopLeave = undefined;
      ui.handlers.coopLoadout = undefined;
      setPartnerLeftListener(undefined);
      setPartnerLoadoutListener(undefined);
    });
    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        this.leave();
      }
    });

    // Back from a battle or the setup: still linked.
    const { net } = session;
    if (net?.role === 'host') {
      this.render({ kind: 'hosting', code: net.code, partner: true, partnerLoadout: partnerLoadout(session) });
    } else if (net?.role === 'guest') {
      this.listenAsGuest();
      this.renderJoined(net.code);
    } else {
      this.render({ kind: 'choose', error: session.coopNotice });
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
    this.render({ kind: 'hosting', partner: false });
    try {
      const room = await hostRoom(transportMode());
      this.room = room;
      if (this.view.kind !== 'hosting') {
        room.close();
        return;
      }
      this.render({ kind: 'hosting', code: room.code, partner: false });
      const transport = await room.guest;
      if (this.room !== room) {
        transport.close();
        return;
      }
      linkUp(this.ctx, 'host', room.code, transport, this.ctx.session.sandbox.loadout);
      transport.send({ t: 'welcome' });
      // The host's quiver is the battle setup's; the guest sees it in the lobby.
      shareLoadout(this.ctx.session, this.ctx.session.sandbox.loadout);
      this.render({ kind: 'hosting', code: room.code, partner: true, partnerLoadout: partnerLoadout(this.ctx.session) });
    } catch (error) {
      this.render({ kind: 'choose', error: (error as Error).message });
    }
  }

  private async join(input: string): Promise<void> {
    const code = normalizeRoomCode(input);
    if (!code) {
      this.render({ kind: 'choose', error: 'A room code has five letters and digits.' });
      return;
    }
    this.render({ kind: 'joining', code });
    try {
      const transport = await joinRoom(code, transportMode());
      if (this.view.kind !== 'joining') {
        transport.close();
        return;
      }
      // The guest starts from the quiver of their own last setup.
      linkUp(this.ctx, 'guest', code, transport, loadSandbox().loadout);
      this.listenAsGuest();
      transport.send({ t: 'hello' });
      this.renderJoined(code);
    } catch (error) {
      this.render({ kind: 'choose', error: (error as Error).message });
    }
  }

  /** Waiting in the lobby: the host's `start` takes the guest into the battle. */
  private listenAsGuest(): void {
    this.ctx.session.net?.transport.onMessage((message: NetMessage) => {
      if (message.t === 'welcome') {
        // In the room: the host gets the guest's quiver (sent once the host listens, and again on every change).
        const own = this.ctx.session.net?.loadouts[1];
        if (own) {
          shareLoadout(this.ctx.session, own);
        }
      } else if (message.t === 'start') {
        const { session } = this.ctx;
        session.sandbox = message.sandbox;
        session.run = message.run;
        if (session.net) {
          session.net.wind = message.wind;
        }
        this.ctx.goTo('game');
      }
    });
  }

  /** Joined: the guest's own quiver to edit, with the host's beside it. */
  private renderJoined(code: string, notice?: string): void {
    const { session } = this.ctx;
    const loadout = session.net?.loadouts[1] ?? loadSandbox().loadout;
    this.render({ kind: 'joined', code, notice, loadout, partnerLoadout: partnerLoadout(session) });
  }

  private refreshQuivers(): void {
    const { session } = this.ctx;
    if (this.view.kind === 'joined') {
      this.renderJoined(this.view.code, this.view.notice);
    } else if (this.view.kind === 'hosting' && this.view.partner) {
      this.render({ ...this.view, partnerLoadout: partnerLoadout(session) });
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
