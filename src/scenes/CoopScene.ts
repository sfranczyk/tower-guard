import { Container } from 'pixi.js';
import { Scene } from '../core/Scene';
import { centeredCameraX } from '../core/viewport';
import { BATTLEGROUNDS } from '../data/battlegrounds';
import { leaveCoop, linkUp, setPartnerLeftListener, transportMode } from '../net/coopLink';
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
    new Background(this.backdrop, BATTLEGROUNDS.greenMeadow);
    this.ctx.root.addChild(this.backdrop);

    ui.handlers.coopHost = () => void this.host();
    ui.handlers.coopJoin = (code) => void this.join(code);
    ui.handlers.coopSetup = () => this.ctx.goTo('sandbox');
    ui.handlers.coopLeave = () => this.leave();
    setPartnerLeftListener(() => this.render({ kind: 'choose', error: 'Your partner has left the room.' }));
    this.onExit(() => {
      ui.handlers.coopHost = undefined;
      ui.handlers.coopJoin = undefined;
      ui.handlers.coopSetup = undefined;
      ui.handlers.coopLeave = undefined;
      setPartnerLeftListener(undefined);
    });
    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        this.leave();
      }
    });

    // Back from a battle or the setup: still linked.
    const { net } = session;
    if (net?.role === 'host') {
      this.render({ kind: 'hosting', code: net.code, partner: true });
    } else if (net?.role === 'guest') {
      this.listenAsGuest();
      this.render({ kind: 'joined', code: net.code });
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
      linkUp(this.ctx, 'host', room.code, transport);
      transport.send({ t: 'welcome' });
      this.render({ kind: 'hosting', code: room.code, partner: true });
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
      linkUp(this.ctx, 'guest', code, transport);
      this.listenAsGuest();
      transport.send({ t: 'hello' });
      this.render({ kind: 'joined', code });
    } catch (error) {
      this.render({ kind: 'choose', error: (error as Error).message });
    }
  }

  /** Waiting in the lobby: the host's `start` takes the guest into the battle. */
  private listenAsGuest(): void {
    this.ctx.session.net?.transport.onMessage((message: NetMessage) => {
      if (message.t === 'start') {
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

  private leave(): void {
    this.room?.close();
    this.room = undefined;
    leaveCoop(this.ctx);
    this.ctx.goTo('menu');
  }
}
