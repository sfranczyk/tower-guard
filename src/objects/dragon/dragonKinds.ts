import { DRAGON_ALTITUDE, DRAGON_ARCHER_HOVER, DRAGON_HOVER_OFFSET, FIRE_DRAGON_ALTITUDE, FIRE_DRAGON_HOVER, FIRE_DRAGON_HOVER_OFFSET, FIRE_DRAGON_WAIT } from '../../config';
import type { HoverRanges } from '../../systems/dragonManoeuvre';
import type { FlyingType } from '../../data/enemyKinds';
import { HUMAN_BODY, type BodyColors } from '../../rendering/bodyColors';
import { DRAGON_PALETTES, type DragonPalette } from '../../rendering/dragon';
import { dragonArcherLook, dragonKnightLook } from '../../rendering/designs/heavySkins';
import type { HumanoidLook } from '../../rendering/designs/skinKit';

/** The dragons (data/enemyKinds: the enemies whose archetype flies). */
export type DragonKind = FlyingType;

export type DragonRider = 'archer' | 'unarmed';

/** How a dragon looks and flies: hide, rider, height and hover distance flying in, its hovers. */
export interface DragonLook {
  palette: DragonPalette;
  rider: DragonRider;
  altitude: number;
  hoverOffset: number;
  /** Where and how long it hovers before flying to the next point (systems/dragonManoeuvre.ts). */
  hovers: HoverRanges;
  /** Where it hovers while everyone hides in the keep (none: as usual, it attacks the keep). */
  waits?: HoverRanges;
}

export const DRAGON_KINDS: Readonly<Record<DragonKind, DragonLook>> = {
  dragon: { palette: DRAGON_PALETTES.dark, rider: 'archer', altitude: DRAGON_ALTITUDE, hoverOffset: DRAGON_HOVER_OFFSET, hovers: DRAGON_ARCHER_HOVER },
  fireDragon: { palette: DRAGON_PALETTES.red, rider: 'unarmed', altitude: FIRE_DRAGON_ALTITUDE, hoverOffset: FIRE_DRAGON_HOVER_OFFSET, hovers: FIRE_DRAGON_HOVER, waits: FIRE_DRAGON_WAIT },
};

/** MOBA: the blue lane's dragon archer, the dragon archer in the bowman's blue. */
export const BLUE_DRAGON_LOOK: DragonLook = { ...DRAGON_KINDS.dragon, palette: DRAGON_PALETTES.blue };

/** The riders' looks (rendering/designs): the dragon archer's hooded bandit; the fire dragon's knight is animated. */
export const DRAGON_ARCHER_LOOK = dragonArcherLook();

/** Colours of a blown-apart rider's pieces. */
export const RIDER_GIB_COLORS: Readonly<Record<DragonRider, BodyColors>> = {
  archer: { ...HUMAN_BODY, bone: 0xd2a07a, boneRear: 0x5a4a6a },
  unarmed: { ...HUMAN_BODY, bone: 0x6d7380, boneRear: 0xa8343a },
};

/** The rider's look once he's off the dragon (both legs show). */
export const thrownRiderLook = (rider: DragonRider, timeMs: number): HumanoidLook => ({
  ...(rider === 'archer' ? DRAGON_ARCHER_LOOK : dragonKnightLook(timeMs)),
  hideFarLeg: false,
});
