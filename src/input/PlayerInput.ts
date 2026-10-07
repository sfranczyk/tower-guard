import InputManager, { type AimInput } from '../managers/InputManager';
import type { ProjectileType } from '../types';

/**
 * One player's controls, polled by GameScene every frame. The local player's come from the keyboard and
 * mouse (LocalInput); another player's are set from outside (ManualInput: the console for now, the network
 * later), so the scene treats both the same.
 */
export interface PlayerInput {
  getMovementDirection(): number;
  isSprintDown(): boolean;
  /** True once per press (the press is consumed). */
  isJumpPressed(): boolean;
  /** The bow being drawn right now (undefined when not aiming). */
  getAim(): AimInput | undefined;
  /** Shots released since the last call, with the aim at release. */
  takeShots(): AimInput[];
  /** Whether shrapnel was burst (Space) since the last call. */
  takeBurst(): boolean;
  /** A weapon picked since the last call. */
  takeProjectile(): ProjectileType | undefined;
  /** Drops the current draw (e.g. the settings drawer opened). */
  cancelAim(): void;
  destroy(): void;
}

/** Keyboard and mouse of this browser, through InputManager. */
export class LocalInput implements PlayerInput {
  private shots: AimInput[] = [];
  private burst = false;
  private projectile?: ProjectileType;
  /** Live aim while drawing (fed by InputManager's AIM events, cleared on release). */
  private aim?: AimInput;

  public constructor(private readonly manager: InputManager) {
    manager.on(InputManager.Events.AIM, (aim: AimInput) => {
      this.aim = aim;
    });
    manager.on(InputManager.Events.AIM_RELEASE, (aim: AimInput) => {
      this.aim = undefined;
      this.shots.push(aim);
    });
  }

  public getMovementDirection(): number {
    return this.manager.getMovementDirection();
  }

  public isSprintDown(): boolean {
    return this.manager.isSprintDown();
  }

  public isJumpPressed(): boolean {
    return this.manager.isJumpPressed();
  }

  public getAim(): AimInput | undefined {
    // Fresh from the manager each frame (its drag points follow the camera); undefined once released.
    const aim = this.aim ? this.manager.getAim() : undefined;
    return aim && aim.power > 0 ? aim : undefined;
  }

  public takeShots(): AimInput[] {
    const shots = this.shots;
    this.shots = [];
    return shots;
  }

  public takeBurst(): boolean {
    const burst = this.burst;
    this.burst = false;
    return burst;
  }

  public takeProjectile(): ProjectileType | undefined {
    const projectile = this.projectile;
    this.projectile = undefined;
    return projectile;
  }

  /** Space pressed (GameScene owns the key, since it also confirms the end screen). */
  public queueBurst(): void {
    this.burst = true;
  }

  /** A weapon picked with a number key or the HUD slots. */
  public queueProjectile(type: ProjectileType): void {
    this.projectile = type;
  }

  public cancelAim(): void {
    this.manager.cancelAim();
    this.aim = undefined;
  }

  public destroy(): void {
    this.manager.destroy();
  }
}

/**
 * Controls set from outside: plain state plus queued one-off actions. A second player is driven from the
 * console with it for now (`scene.players[1].input.set({ direction: 1 })`), and from the network later.
 */
export class ManualInput implements PlayerInput {
  public direction = 0;
  public sprint = false;
  public aim?: AimInput;
  private jump = false;
  private shots: AimInput[] = [];
  private burst = false;
  private projectile?: ProjectileType;

  /** Sets held controls (movement −1..1, sprint, the bow being drawn). */
  public set(state: { direction?: number; sprint?: boolean; aim?: AimInput }): void {
    this.direction = state.direction ?? this.direction;
    this.sprint = state.sprint ?? this.sprint;
    this.aim = 'aim' in state ? state.aim : this.aim;
  }

  public pressJump(): void {
    this.jump = true;
  }

  public shoot(aim: AimInput): void {
    this.aim = undefined;
    this.shots.push(aim);
  }

  public pressBurst(): void {
    this.burst = true;
  }

  public pickProjectile(type: ProjectileType): void {
    this.projectile = type;
  }

  public getMovementDirection(): number {
    return this.direction;
  }

  public isSprintDown(): boolean {
    return this.sprint;
  }

  public isJumpPressed(): boolean {
    const jump = this.jump;
    this.jump = false;
    return jump;
  }

  public getAim(): AimInput | undefined {
    return this.aim && this.aim.power > 0 ? this.aim : undefined;
  }

  public takeShots(): AimInput[] {
    const shots = this.shots;
    this.shots = [];
    return shots;
  }

  public takeBurst(): boolean {
    const burst = this.burst;
    this.burst = false;
    return burst;
  }

  public takeProjectile(): ProjectileType | undefined {
    const projectile = this.projectile;
    this.projectile = undefined;
    return projectile;
  }

  public cancelAim(): void {
    this.aim = undefined;
  }

  public destroy(): void {}
}

/**
 * Co-op guest: passes the local controls through (the guest's own bowman moves at once, before the host
 * confirms) and remembers the one-off presses so they can be sent to the host too.
 */
export class RecordingInput implements PlayerInput {
  private jumped = false;

  public constructor(private readonly inner: PlayerInput) {}

  public getMovementDirection(): number {
    return this.inner.getMovementDirection();
  }

  public isSprintDown(): boolean {
    return this.inner.isSprintDown();
  }

  public isJumpPressed(): boolean {
    const pressed = this.inner.isJumpPressed();
    this.jumped ||= pressed;
    return pressed;
  }

  /** Whether jump was pressed since the last call. */
  public takeJump(): boolean {
    const jumped = this.jumped;
    this.jumped = false;
    return jumped;
  }

  public getAim(): AimInput | undefined {
    return this.inner.getAim();
  }

  public takeShots(): AimInput[] {
    return this.inner.takeShots();
  }

  public takeBurst(): boolean {
    return this.inner.takeBurst();
  }

  public takeProjectile(): ProjectileType | undefined {
    return this.inner.takeProjectile();
  }

  public cancelAim(): void {
    this.inner.cancelAim();
  }

  public destroy(): void {
    this.inner.destroy();
  }
}
