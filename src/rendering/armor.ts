/** The bowman's colours, per battleground (data/battlegrounds.ts); the looks map them onto their clothes. */
export interface ArmorPalette {
  /** Limbs (cloth) in front and behind. */
  limb: number;
  limbRear: number;
  outline: number;
  plate: number;
  plateLight: number;
  /** Trim on the armor, hood and buckle. */
  gold: number;
  leather: number;
  /** Face in the shadow of the hood. */
  face: number;
  bow: number;
  bowString: number;
}

/** MOBA: the team's cloth over the map's armor (both teams' bowmen and minions wear their team's colour). */
export const teamArmor = (palette: ArmorPalette, team: 'blue' | 'red'): ArmorPalette => ({
  ...palette,
  ...(team === 'blue' ? { limb: 0x2f5d9a, limbRear: 0x1f3f6e } : { limb: 0xa8343a, limbRear: 0x7a2226 }),
});

/**
 * The second player's armor in co-op: the same cloth, but bronze plates and silver trim instead of steel and
 * gold, so the two bowmen tell apart at a glance on any map.
 */
export const secondPlayerArmor = (palette: ArmorPalette): ArmorPalette => ({
  ...palette,
  plate: 0xa86a3a,
  plateLight: 0xd59a63,
  gold: 0xdfe4ea,
});
