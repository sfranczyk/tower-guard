import type { Container } from 'pixi.js';
import { MIN_SHOT_POWER } from '../config';
import type { GameSession } from '../core/Scene';
import { isMirrored, mirrorX } from '../core/keepSide';
import { viewWidth } from '../core/viewport';
import type { PlayerInput } from '../input/PlayerInput';
import type { AimOverlay } from '../rendering/AimOverlay';
import { setBarsMirrored } from '../rendering/healthBar';
import type { Vec2 } from '../types';
import type { BattleArrows } from './BattleArrows';
import type { BattleCamera } from './BattleCamera';
import { canDrawBow, type Player } from './PlayerControl';

export interface BattleViewDeps {
  session: GameSession;
  camera: BattleCamera;
  world: Container;
  /** The weather layer over the world (made in GameScene.enter). */
  screenLayer: () => Container;
  localPlayer: () => Player;
  shots: BattleArrows;
  aimOverlay: AimOverlay;
  cameraShake: () => Vec2;
  /** After a lost level the keys move the camera freely (BattleControls). */
  panInput: () => PlayerInput | undefined;
  /** The view was just mirrored or unmirrored: the bars drawn so far must fill from the other end. */
  redrawHealthBars: () => void;
}

/**
 * What this player sees of the battle each frame: the aim circles and predicted path, the camera following the
 * bowman (sliding towards where the shot would land), and the world under it, mirrored when the player wants his keep
 * on the other side of the screen (settings window).
 */
export class BattleView {
  /** Where the local player's drawn shot would land (x), while aiming. */
  private aimLandingX?: number;

  public constructor(private readonly deps: BattleViewDeps) {}

  public get mirrored(): boolean {
    return isMirrored(this.deps.session.keepSide, this.deps.localPlayer().team === 'red');
  }

  /** Where a sound at world `x` is heard from: mirrored with the view, so it comes from where it shows. */
  public heardX(x: number): number {
    const { camera } = this.deps;
    return this.mirrored ? camera.x + mirrorX(x - camera.x, viewWidth()) : x;
  }

  /** The local player's aim circles and predicted path (when the preview is on), and where the drawn shot would land. */
  public updateAim(): void {
    const player = this.deps.localPlayer();
    const { bowman, input, projectile } = player;
    const aim = input.getAim();
    const hasAim = aim !== undefined && !bowman.isStunned && !bowman.isDead;
    // The chosen arrow still loading: grey circles, no path.
    const loaded = canDrawBow(player);
    const releasePoint = bowman.getBowReleasePoint();
    const path = hasAim && loaded && aim.power > MIN_SHOT_POWER ? this.deps.shots.simulate(aim, releasePoint, projectile) : [];
    this.aimLandingX = path.length > 0 ? path[path.length - 1].x : undefined;
    const { session } = this.deps;
    this.deps.aimOverlay.draw(releasePoint, hasAim ? aim : undefined, session.showTrajectory ? path : [], session.showCursorCircle, !loaded);
  }

  /** The camera follows the local bowman and slides towards where he's aiming (BattleCamera); after a lost level the keys may move it freely. */
  public updateCamera(deltaMs: number): void {
    const { camera } = this.deps;
    const shake = this.deps.cameraShake();
    const pan = this.deps.panInput();
    if (pan) {
      this.placeWorld(camera.pan(deltaMs, pan.getMovementDirection(), pan.isSprintDown(), shake));
      return;
    }
    const { bowman, input } = this.deps.localPlayer();
    const aim = input.getAim();
    this.placeWorld(camera.follow(deltaMs, {
      bowmanX: bowman.x,
      moving: input.getMovementDirection() !== 0 || Math.abs(bowman.velocityX) > 1,
      aimDirectionX: aim?.direction.x,
      aimLandingX: aim ? this.aimLandingX : undefined,
    }, shake));
  }

  /** Puts the world under the camera (`position`: the world's offset), mirrored when the player wants his keep on the other side. */
  private placeWorld(position: Vec2): void {
    const mirrored = this.mirrored;
    const { world } = this.deps;
    const screenLayer = this.deps.screenLayer();
    world.scale.x = mirrored ? -1 : 1;
    world.position.set(mirrored ? mirrorX(position.x, viewWidth()) : position.x, position.y);
    screenLayer.scale.x = mirrored ? -1 : 1;
    screenLayer.x = mirrored ? viewWidth() : 0;
    if (setBarsMirrored(mirrored)) {
      this.deps.redrawHealthBars();
    }
  }
}
