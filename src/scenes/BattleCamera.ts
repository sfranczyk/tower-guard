import { WORLD_WIDTH } from '../config';
import { LOOK_AIM_MS, LOOK_RETURN_MS, aimLookAhead, easeTowards, nextLookShift } from '../core/camera';
import { centeredCameraX, viewWidth } from '../core/viewport';
import type { Vec2 } from '../types';
import { clamp } from '../utils/math';

/** The camera eases after its target with this time constant (ms). */
const CAMERA_FOLLOW_MS = 160;

/** What the camera follows each frame: the local bowman, whether he moves, and where his drawn shot would land. */
export interface CameraFocus {
  bowmanX: number;
  moving: boolean;
  /** The local player's aim direction x while drawing (undefined when not). */
  aimDirectionX?: number;
  /** Where the drawn shot would land (x), while aiming. */
  aimLandingX?: number;
}

/**
 * Keeps the local bowman in the middle, but while he aims slides the view towards where the shot would land:
 * not for a short shot, up to the bowman near the edge for a long one (core/camera.ts). A shorter shot doesn't
 * bring it back in (aiming the other way does). After the shot the view stays put while he stands and shoots,
 * and drifts back to him once he moves. A view wider than the world shows all of it, centred.
 */
export class BattleCamera {
  /** World x at the left edge of the view. */
  public x = 0;
  /** The camera starts on its target, then follows it smoothly. */
  private placed = false;
  /** How far (px) the view is slid towards where the local player is aiming (eased towards `lookGoal`). */
  private lookShift = 0;
  /** Where aiming has slid the view to: only further out, unless he aims the other way; 0 again once he moves. */
  private lookGoal = 0;

  /** One frame: moves the view and returns the world container's position (with the effects' `shake`). */
  public follow(deltaMs: number, focus: CameraFocus, shake: Vec2): Vec2 {
    const width = viewWidth();
    if (focus.aimLandingX !== undefined && focus.aimDirectionX !== undefined) {
      // Out for a longer shot, but not back in for a shorter one (unless he turns the other way).
      this.lookGoal = nextLookShift(this.lookGoal, aimLookAhead(focus.aimLandingX - focus.bowmanX, width), focus.aimDirectionX);
      this.lookShift = easeTowards(this.lookShift, this.lookGoal, deltaMs, LOOK_AIM_MS);
    } else if (focus.moving) {
      this.lookGoal = 0;
      this.lookShift = easeTowards(this.lookShift, 0, deltaMs, LOOK_RETURN_MS);
    }
    const target = width >= WORLD_WIDTH
      ? centeredCameraX(width, WORLD_WIDTH)
      : clamp(focus.bowmanX + this.lookShift - width / 2, 0, WORLD_WIDTH - width);
    this.x = this.placed ? easeTowards(this.x, target, deltaMs, CAMERA_FOLLOW_MS) : target;
    this.placed = true;
    return { x: -this.x + shake.x, y: shake.y };
  }
}
