import { DRAGON_ALTITUDE, DRAGON_HOVER_OFFSET, FIRE_DRAGON_ALTITUDE, FIRE_DRAGON_HOVER_OFFSET } from '../../config';
import type { FlyingType } from '../../data/enemyKinds';
import { HUMAN_BODY, type BodyColors } from '../../rendering/bodyColors';
import { DRAGON_PALETTES, type DragonPalette } from '../../rendering/dragon';
import { dragonArcherLook, dragonKnightLook } from '../../rendering/designs/heavySkins';
import type { HumanoidLook } from '../../rendering/designs/skinKit';

/** The dragons (data/enemyKinds: the enemies whose archetype flies). */
export type DragonKind = FlyingType;

export type DragonRider = 'archer' | 'unarmed';

/** How a dragon looks and flies: hide, rider, cruising height and hover distance. */
export interface DragonLook {
  palette: DragonPalette;
  rider: DragonRider;
  altitude: number;
  hoverOffset: number;
}

export const DRAGON_KINDS: Readonly<Record<DragonKind, DragonLook>> = {
  dragon: { palette: DRAGON_PALETTES.dark, rider: 'archer', altitude: DRAGON_ALTITUDE, hoverOffset: DRAGON_HOVER_OFFSET },
  fireDragon: { palette: DRAGON_PALETTES.red, rider: 'unarmed', altitude: FIRE_DRAGON_ALTITUDE, hoverOffset: FIRE_DRAGON_HOVER_OFFSET },
};

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
