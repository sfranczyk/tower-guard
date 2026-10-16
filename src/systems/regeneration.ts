/**
 * A regenerating enemy's clock (pure, tested): time banked towards the next step, how long the last fire still holds
 * it back, and the burn left last frame (a rise means it was just set alight).
 */
export interface RegenState {
  readonly bankedMs: number;
  readonly lockMs: number;
  readonly lastBurnMs: number;
}

export interface RegenParams {
  readonly perSecond: number;
  readonly tickMs: number;
  readonly afterFireMs: number;
}

export const REGEN_START: RegenState = { bankedMs: 0, lockMs: 0, lastBurnMs: 0 };

/**
 * One frame of regeneration: health comes back in whole steps of `tickMs` (perSecond × tickMs / 1000 each). Being set
 * alight (`burnMs` rising, a re-hit included) stops it for `afterFireMs` from that moment, and it stays off while the
 * fire still burns; `paused` (frozen) holds the banked time.
 */
export const regenStep = (
  state: RegenState,
  deltaMs: number,
  status: { burnMs: number; paused: boolean },
  params: RegenParams,
): { state: RegenState; heal: number } => {
  const lockMs = status.burnMs > state.lastBurnMs ? params.afterFireMs : Math.max(0, state.lockMs - deltaMs);
  if (status.burnMs > 0 || lockMs > 0) {
    return { state: { bankedMs: 0, lockMs, lastBurnMs: status.burnMs }, heal: 0 };
  }
  if (status.paused) {
    return { state: { ...state, lockMs, lastBurnMs: 0 }, heal: 0 };
  }
  const tickMs = Math.max(1, params.tickMs);
  const banked = state.bankedMs + deltaMs;
  const steps = Math.floor(banked / tickMs);
  return {
    state: { bankedMs: banked - steps * tickMs, lockMs, lastBurnMs: 0 },
    heal: (steps * params.perSecond * tickMs) / 1000,
  };
};
