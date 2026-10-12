/** A regenerating enemy's clock (pure, tested): time banked towards the next step, and time since it last burned. */
export interface RegenState {
  readonly bankedMs: number;
  readonly sinceBurnMs: number;
}

export interface RegenParams {
  readonly perSecond: number;
  readonly tickMs: number;
  readonly afterBurnMs: number;
}

export const REGEN_START: RegenState = { bankedMs: 0, sinceBurnMs: Number.POSITIVE_INFINITY };

/**
 * One frame of regeneration: health comes back in whole steps of `tickMs` (perSecond × tickMs / 1000 each). Burning
 * resets the clock, and it starts again only `afterBurnMs` after the fire is out; `paused` (frozen) just holds it.
 */
export const regenStep = (
  state: RegenState,
  deltaMs: number,
  status: { burning: boolean; paused: boolean },
  params: RegenParams,
): { state: RegenState; heal: number } => {
  if (status.burning) {
    return { state: { bankedMs: 0, sinceBurnMs: 0 }, heal: 0 };
  }
  if (status.paused) {
    return { state, heal: 0 };
  }
  const sinceBurnMs = state.sinceBurnMs + deltaMs;
  if (sinceBurnMs < params.afterBurnMs) {
    return { state: { bankedMs: 0, sinceBurnMs }, heal: 0 };
  }
  const tickMs = Math.max(1, params.tickMs);
  const banked = state.bankedMs + deltaMs;
  const steps = Math.floor(banked / tickMs);
  return {
    state: { bankedMs: banked - steps * tickMs, sinceBurnMs },
    heal: (steps * params.perSecond * tickMs) / 1000,
  };
};
