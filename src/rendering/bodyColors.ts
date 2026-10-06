/** Bone and blood colours of a stickman: humans are white with red blood, zombies pale green with green blood. */
export interface BodyColors {
  bone: number;
  boneRear: number;
  blood: number;
  bloodDark: number;
  /** Blood stains on the ground. */
  stain: number;
}

export const HUMAN_BODY: Readonly<BodyColors> = { bone: 0xf4f7fb, boneRear: 0xb7c1d1, blood: 0xc33d48, bloodDark: 0x8f2035, stain: 0x7e2637 };

export const ZOMBIE_BODY: Readonly<BodyColors> = { bone: 0xc8deaa, boneRear: 0x94ad7f, blood: 0x72c43c, bloodDark: 0x3f8023, stain: 0x4b7029 };
