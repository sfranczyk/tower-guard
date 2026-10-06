import { EventEmitter } from 'eventemitter3';
import type { Vec2 } from '../types';
import { clamp } from '../utils/math';

export interface AimInput {
  direction: Vec2;
  power: number;
  strength: {
    value: number;
    max: number;
    distance: number;
  };
  start: Vec2;
  current: Vec2;
}

export interface MovementInput {
  direction: number;
}

export interface InputManagerConfig {
  maxDragDistance?: number;
  leftKey?: string;
  rightKey?: string;
  upKey?: string;
  sprintKey?: string;
  isPointerBlocked?: (point: Vec2) => boolean;
  worldPointFromScreen: (point: Vec2) => Vec2;
  eventTarget: HTMLElement;
  /** The view size in game px (its width changes with the window, see core/viewport.ts). */
  screenSize: () => Vec2;
}

const normalize = (vector: Vec2): Vec2 => {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= Number.EPSILON) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
};

export class InputManager extends EventEmitter {
  public static readonly Events = {
    MOVE: 'move',
    AIM: 'aim',
    AIM_RELEASE: 'aim-release',
  } as const;

  private readonly maxDragDistance: number;
  private readonly isPointerBlocked?: (point: Vec2) => boolean;
  private readonly worldPointFromScreen: (point: Vec2) => Vec2;
  private readonly eventTarget: HTMLElement;
  private readonly screenSize: () => Vec2;
  private readonly keyState = new Set<string>();
  private dragStart: Vec2 | undefined;
  private lastAim: AimInput | undefined;
  private jumpConsumed = false;

  private readonly keyDownHandler = (event: KeyboardEvent): void => {
    this.keyState.add(event.code);
  };

  private readonly keyUpHandler = (event: KeyboardEvent): void => {
    this.keyState.delete(event.code);
    if (event.code === this.upKey) {
      this.jumpConsumed = false;
    }
  };

  private readonly pointerDownHandler = (event: PointerEvent): void => {
    const point = this.toScreenPoint(event);
    if (this.isPointerBlocked?.(point)) {
      this.cancelAim();
      return;
    }
    this.dragStart = this.worldPointFromScreen(point);
    this.handlePointerMove(event);
  };

  private readonly pointerMoveHandler = (event: PointerEvent): void => {
    this.handlePointerMove(event);
  };

  private readonly pointerUpHandler = (event: PointerEvent): void => {
    const point = this.toScreenPoint(event);
    if (this.isPointerBlocked?.(point)) {
      this.cancelAim();
      return;
    }
    if (!this.dragStart) {
      return;
    }
    this.handlePointerMove(event);
    if (this.lastAim) {
      this.emit(InputManager.Events.AIM_RELEASE, this.cloneAim(this.lastAim));
    }
    this.dragStart = undefined;
    this.lastAim = undefined;
  };

  private readonly leftKey: string;
  private readonly rightKey: string;
  private readonly upKey: string;
  private readonly sprintKey: string;

  public constructor(config: InputManagerConfig) {
    super();
    this.maxDragDistance = Math.max(1, config.maxDragDistance ?? 200);
    this.isPointerBlocked = config.isPointerBlocked;
    this.worldPointFromScreen = config.worldPointFromScreen;
    this.eventTarget = config.eventTarget;
    this.screenSize = config.screenSize;
    this.leftKey = config.leftKey ?? 'ArrowLeft';
    this.rightKey = config.rightKey ?? 'ArrowRight';
    this.upKey = config.upKey ?? 'KeyW';
    this.sprintKey = config.sprintKey ?? 'ShiftLeft';

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    this.eventTarget.addEventListener('pointerdown', this.pointerDownHandler);
    this.eventTarget.addEventListener('pointermove', this.pointerMoveHandler);
    window.addEventListener('pointerup', this.pointerUpHandler);
    window.addEventListener('pointercancel', this.pointerUpHandler);
  }

  public update(): number {
    const direction = this.getMovementDirection();
    this.emit(InputManager.Events.MOVE, { direction } satisfies MovementInput);
    return direction;
  }

  public getMovementDirection(): number {
    const left = this.isDown(this.leftKey) || this.isDown('KeyA');
    const right = this.isDown(this.rightKey) || this.isDown('KeyD');
    return Number(right) - Number(left);
  }

  public isJumpPressed(): boolean {
    if (!this.isDown(this.upKey) || this.jumpConsumed) {
      return false;
    }
    this.jumpConsumed = true;
    return true;
  }

  public isSprintDown(): boolean {
    return this.isDown(this.sprintKey) || this.isDown('ShiftRight');
  }

  public getAim(): AimInput | undefined {
    return this.lastAim ? this.cloneAim(this.lastAim) : undefined;
  }

  public cancelAim(): void {
    this.dragStart = undefined;
    this.lastAim = undefined;
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    this.eventTarget.removeEventListener('pointerdown', this.pointerDownHandler);
    this.eventTarget.removeEventListener('pointermove', this.pointerMoveHandler);
    window.removeEventListener('pointerup', this.pointerUpHandler);
    window.removeEventListener('pointercancel', this.pointerUpHandler);
    this.removeAllListeners();
  }

  private isDown(code: string): boolean {
    return this.keyState.has(code);
  }

  private toScreenPoint(event: PointerEvent): Vec2 {
    const rect = this.eventTarget.getBoundingClientRect();
    const size = this.screenSize();
    const x = ((event.clientX - rect.left) / rect.width) * size.x;
    const y = ((event.clientY - rect.top) / rect.height) * size.y;
    return { x, y };
  }

  private handlePointerMove(event: PointerEvent): void {
    const screenPoint = this.toScreenPoint(event);
    if (this.isPointerBlocked?.(screenPoint) || !this.dragStart) {
      return;
    }

    const current = this.worldPointFromScreen(screenPoint);
    const pull = {
      x: this.dragStart.x - current.x,
      y: this.dragStart.y - current.y,
    };
    const distance = Math.hypot(pull.x, pull.y);
    const direction = normalize(pull);
    const power = clamp(distance / this.maxDragDistance, 0, 1);
    const effectiveDistance = Math.min(distance, this.maxDragDistance);

    this.lastAim = {
      direction,
      power,
      strength: {
        value: power,
        max: 1,
        distance: effectiveDistance,
      },
      start: { ...this.dragStart },
      current,
    };

    this.emit(InputManager.Events.AIM, this.cloneAim(this.lastAim));
  }

  private cloneAim(aim: AimInput): AimInput {
    return {
      direction: { ...aim.direction },
      power: aim.power,
      strength: { ...aim.strength },
      start: { ...aim.start },
      current: { ...aim.current },
    };
  }
}

export default InputManager;
