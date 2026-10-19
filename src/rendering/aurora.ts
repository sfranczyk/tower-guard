/**
 * Northern lights (pure, tested): a few curtains across the sky, each a row of columns whose foot waves up and down,
 * whose rays rise and fall and whose glow flickers slowly along it, fading out at both ends. rendering/NightSky.ts
 * draws them on maps with `nightCycle.aurora`; the design lab's night tiles too.
 */
export interface AuroraCurtain {
  /** Where it starts and ends across the view (0 left .. 1 right). */
  from: number;
  to: number;
  /** World y of its foot (the brightest edge, the rays rise above it). */
  footY: number;
  /** Shifts its waves, so no two curtains move alike. */
  phase: number;
  /** Index into `nightCycle.aurora` for the foot (the rays tint towards the last colour). */
  color: number;
}

export const AURORA_CURTAINS: readonly AuroraCurtain[] = [
  { from: -0.05, to: 0.55, footY: 120, phase: 0, color: 0 },
  { from: 0.3, to: 0.95, footY: 92, phase: 2.1, color: 1 },
  { from: 0.62, to: 1.08, footY: 135, phase: 4.3, color: 0 },
];

export interface AuroraColumn {
  /** Offset of the foot from the curtain's `footY` (px, + down). */
  foot: number;
  /** How tall the rays are (0..1 of AURORA.height). */
  height: number;
  /** How bright (0 at the curtain's ends .. 1). */
  glow: number;
}

const TAU = Math.PI * 2;

/** The column `u` (0..1) along `curtain` at `seconds`. */
export const auroraColumn = (curtain: AuroraCurtain, u: number, seconds: number): AuroraColumn => {
  const { phase } = curtain;
  const envelope = Math.sin(Math.PI * Math.max(0, Math.min(1, u))) ** 0.8;
  return {
    foot: 18 * Math.sin(TAU * 1.3 * u + 0.35 * seconds + phase) + 7 * Math.sin(TAU * 3.1 * u - 0.6 * seconds + 2 * phase),
    height: 0.55 + 0.3 * Math.sin(TAU * 2.2 * u + 0.5 * seconds + phase) + 0.15 * Math.sin(TAU * 7 * u - 1.1 * seconds),
    glow: envelope * (0.72 + 0.28 * Math.sin(TAU * 1.7 * u - 0.4 * seconds + phase)),
  };
};
