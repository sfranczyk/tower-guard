import type { ArmorPalette } from '../rendering/armor';

/**
 * Battlegrounds: the look of the field a level is fought on (sky, sun, hills, trees, ground) and its
 * weather. Pure data; rendering/Background.ts draws them and systems/WeatherSystem.ts adds lightning.
 */

export type BattlegroundId = 'greenMeadow' | 'crimsonPass' | 'sunscorchDunes' | 'thunderRidge' | 'frostpeakPass' | 'moonlitHollow'
  | 'auroraPeaks' | 'stormwatchRidge' | 'eclipsePass' | 'sandstormDunes';

/**
 * fair: drifting clouds; clear: cloudless sky; storm: dark clouds, rain, lightning; snow: grey sky, snowfall;
 * sandstorm: dust clouds, blowing sand and a haze thickening towards the enemy's side (rendering/Sand.ts).
 */
export type Weather = 'fair' | 'clear' | 'storm' | 'snow' | 'sandstorm';

/** Colours of the aim circles, the predicted path and the player's arrow trails. */
export interface AimColors {
  aim: number;
  /** Ghost of the previous shot. */
  previousShot: number;
  trajectory: number;
  trailGlow: number;
  trailCore: number;
  /** Optional outline under the aim lines, circles and path dots, in a colour opposite the aim's lightness (dark aim: pale halo). */
  halo?: number;
}

export const DEFAULT_AIM_COLORS: Readonly<AimColors> = {
  aim: 0xf5d76e,
  previousShot: 0x9ec5ff,
  trajectory: 0xfff3c4,
  trailGlow: 0xf3c969,
  trailCore: 0xffe7a4,
};

export interface Battleground {
  id: BattlegroundId;
  name: string;
  /** Sky colours from the top down (drawn as horizontal bands). */
  sky: readonly number[];
  /** Omitted when it's hidden (storm). */
  sun?: { x: number; y: number; radius: number; color: number };
  weather: Weather;
  cloudColor: number;
  cloudAlpha: number;
  /** Far and near hill colours; dunes are lower and smoother than hills. */
  hills: readonly [number, number];
  /** dunes are lower and smoother than hills; mountains are snow-capped peaks with rocky slopes in front. */
  hillShape: 'hills' | 'dunes' | 'mountains';
  trees: { style: 'round' | 'pine' | 'cactus' | 'snowPine'; colors: readonly [number, number, number]; trunk: number };
  /** Height of the ground waves (default TERRAIN_AMPLITUDE). */
  terrainAmplitude?: number;
  /** How close together the ground waves come (default 1; more = more, shorter rises and dips). */
  terrainWaviness?: number;
  /** Strongest wind of this map (px/s² on a normal arrow); each level rolls one between −wind and +wind. */
  wind?: number;
  ground: { fill: number; edge: number; tufts: number };
  /** Overrides DEFAULT_AIM_COLORS where the default gold and light blue don't stand out. */
  aimColors?: AimColors;
  /** Page backdrop behind the game and the UI accent (bars, highlights) for this map (CSS colours). */
  ui: { accent: string; backdrop: string };
  /** The bowman's armor colours, picked to stand out against this map. */
  player: ArmorPalette;
  /**
   * The survival sky of this map: `sky` is its darkest (night, eclipse or sandstorm); `dawn` bands, then `day`, come
   * over it as the survival level's time runs out (systems/nightCycle.ts, rendering/NightSky.ts). Maps with one are
   * offered only for survival levels, the others only for battle levels (data/sandbox.ts battlegroundsFor).
   */
  nightCycle?: {
    /** The battle map this is the survival version of (a stored survival level on it moves here). */
    nightOf: BattlegroundId;
    /**
     * night (default): stars, a moon crossing the sky, the sun rising at the end. eclipse: the sun stands at `sunAt`
     * behind the moon, which slides off it; stars and a corona while it's dark. dust: no moon or stars, the sun at
     * `sunAt` dim behind the dust and brightening as it clears.
     */
    kind?: 'night' | 'eclipse' | 'dust';
    /** eclipse / dust: where the sun stands, across the view (0..1) and world y. */
    sunAt?: { x: number; y: number };
    /** How bright the stars shine (default 1; dimmer behind storm clouds). */
    stars?: number;
    /** The weather (rain, lightning, clouds, sand and haze) dies down as day comes (`calm`). */
    calms?: boolean;
    /**
     * The end screen: a held level's title, what was held out until, and (lost) what the time left was short of
     * (default 'Dawn breaks!' / 'sunrise' / 'to dawn').
     */
    ending?: { title: string; until: string; left: string };
    dawn: readonly number[];
    day: readonly number[];
    moon: number;
    sun: number;
    shade: number;
    /** The hills by day (far, near), fading in over the night ones as it brightens. */
    dayHills: readonly [number, number];
    /** Northern lights waving over the sky (rendering/aurora.ts), in these colours; they fade with the stars at dawn. */
    aurora?: readonly number[];
  };
}

/**
 * The bowman's look per map: cloth in a colour opposite the map's dominant hue, plates darker on pale maps
 * and brighter on dark ones, so he never blends into the background.
 */
const PLAYER_COLORS: Readonly<Record<BattlegroundId, ArmorPalette>> = {
  // Crimson cloth and bright steel against the green grass, trees and blue-teal hills.
  greenMeadow: {
    limb: 0x9a2230, limbRear: 0x6e1a24, outline: 0x22151a, plate: 0xa9afb8, plateLight: 0xe1e4e8,
    gold: 0xf2b632, leather: 0x5a3b28, face: 0x2a1b1f, bow: 0x2b1d17, bowString: 0x4a3a33,
  },
  // Teal cloth, pale steel and aqua trim against the dusky red and purple pass.
  crimsonPass: {
    limb: 0x1f7a80, limbRear: 0x175a5f, outline: 0x0f1c20, plate: 0xc8d3da, plateLight: 0xf2f6f8,
    gold: 0x7fe6df, leather: 0x3a2a22, face: 0x10282b, bow: 0x14262a, bowString: 0x6aa9a8,
  },
  // Deep navy cloth, dark steel and red trim against the pale sand and hazy sky.
  sunscorchDunes: {
    limb: 0x262c6e, limbRear: 0x1d225a, outline: 0x13152c, plate: 0x5f687c, plateLight: 0x8f99ad,
    gold: 0xe0442c, leather: 0x4a2e22, face: 0x161a3f, bow: 0x1a1c36, bowString: 0x3b3f66,
  },
  // Amber cloth, bright steel and a light bow against the near-black storm.
  thunderRidge: {
    limb: 0xd08a2c, limbRear: 0xa06820, outline: 0x24180c, plate: 0xd6dce3, plateLight: 0xffffff,
    gold: 0xffd75a, leather: 0x8a5a33, face: 0x3a2610, bow: 0xe9c48a, bowString: 0xf6e7c8,
  },
  // Rust-orange cloth and dark steel against the snow, pale sky and grey-blue rock (the navy aim stays clear of him).
  frostpeakPass: {
    limb: 0xb8432a, limbRear: 0x8b3220, outline: 0x1d1820, plate: 0x566074, plateLight: 0x8790a4,
    gold: 0xf2b632, leather: 0x4e3426, face: 0x2b1a14, bow: 0x2b1d17, bowString: 0x4a3a33,
  },
  // Warm amber cloth, bright steel and a pale bow against the blue night (and still clear of the dawn's pinks).
  moonlitHollow: {
    limb: 0xd9932f, limbRear: 0xa86f22, outline: 0x22160b, plate: 0xd6dce3, plateLight: 0xffffff,
    gold: 0xffd75a, leather: 0x8a5a33, face: 0x3a2610, bow: 0xe9c48a, bowString: 0xf6e7c8,
  },
  // Rust cloth like Frostpeak's, brighter, with bright steel against the navy night and the moonlit snow.
  auroraPeaks: {
    limb: 0xd0582c, limbRear: 0xa04420, outline: 0x22140c, plate: 0xd6dce3, plateLight: 0xffffff,
    gold: 0xffd75a, leather: 0x8a5a33, face: 0x3a2010, bow: 0xe9c48a, bowString: 0xf6e7c8,
  },
  // Thunder Ridge's amber, a shade lighter, against the near-black storm night.
  stormwatchRidge: {
    limb: 0xe39a3a, limbRear: 0xb07428, outline: 0x24180c, plate: 0xd6dce3, plateLight: 0xffffff,
    gold: 0xffd75a, leather: 0x8a5a33, face: 0x3a2610, bow: 0xe9c48a, bowString: 0xf6e7c8,
  },
  // Crimson Pass's teal, brighter, against the dark crimson of the eclipse.
  eclipsePass: {
    limb: 0x2a9ca2, limbRear: 0x1f767b, outline: 0x0f1c20, plate: 0xc8d3da, plateLight: 0xf2f6f8,
    gold: 0x7fe6df, leather: 0x3a2a22, face: 0x10282b, bow: 0x14262a, bowString: 0x6aa9a8,
  },
  // Sunscorch's navy, a little bluer, against the ochre dust.
  sandstormDunes: {
    limb: 0x2e3480, limbRear: 0x22286a, outline: 0x13152c, plate: 0x5f687c, plateLight: 0x8f99ad,
    gold: 0xe0442c, leather: 0x4a2e22, face: 0x161a3f, bow: 0x1a1c36, bowString: 0x3b3f66,
  },
};

export const BATTLEGROUNDS: Readonly<Record<BattlegroundId, Battleground>> = {
  greenMeadow: {
    id: 'greenMeadow',
    player: PLAYER_COLORS.greenMeadow,
    name: 'Green Meadow',
    sky: [0x80b8d1],
    sun: { x: 790, y: 105, radius: 68, color: 0xf8dc9b },
    weather: 'fair',
    cloudColor: 0xf7fbf5,
    cloudAlpha: 0.88,
    hills: [0x587d85, 0x3f6965],
    hillShape: 'hills',
    trees: { style: 'round', colors: [0x2d594f, 0x35695a, 0x264e4b], trunk: 0x584d42 },
    ground: { fill: 0x79a866, edge: 0xc7e094, tufts: 0x679452 },
    ui: { accent: '#3f6965', backdrop: '#20363b' },
  },
  crimsonPass: {
    id: 'crimsonPass',
    player: PLAYER_COLORS.crimsonPass,
    name: 'Crimson Pass',
    // Sunset: deep violet at the top fading to warm orange at the horizon.
    sky: [0x3b2a52, 0x5e3456, 0x8e4152, 0xc65c45, 0xe8894a],
    sun: { x: 620, y: 300, radius: 58, color: 0xffb35c },
    weather: 'fair',
    cloudColor: 0xf3a27a,
    cloudAlpha: 0.72,
    hills: [0x6e2f3a, 0x4a2230],
    hillShape: 'hills',
    trees: { style: 'pine', colors: [0x26182a, 0x2e1d31, 0x1e1322], trunk: 0x2a1a1f },
    ground: { fill: 0x9a6a43, edge: 0xc99a5b, tufts: 0x7c5233 },
    ui: { accent: '#8e4152', backdrop: '#2e1f33' },
  },
  sunscorchDunes: {
    id: 'sunscorchDunes',
    player: PLAYER_COLORS.sunscorchDunes,
    name: 'Sunscorch Dunes',
    // Hot, hazy desert sky: pale blue at the top bleaching to sandy haze at the horizon.
    sky: [0x7fb6d4, 0x9cc6d6, 0xbdd3cc, 0xdcd8b4, 0xeed9a2],
    sun: { x: 300, y: 92, radius: 60, color: 0xfff3c4 },
    weather: 'clear',
    cloudColor: 0xffffff,
    cloudAlpha: 0,
    hills: [0xd8b479, 0xc89c5c],
    hillShape: 'dunes',
    trees: { style: 'cactus', colors: [0x5b8a4c, 0x6f9e5c, 0x47703c], trunk: 0x47703c },
    ground: { fill: 0xe2c286, edge: 0xf2dba3, tufts: 0xc4a066 },
    // Gold and light blue vanish against sand and pale sky: deep violet (complementary to the sand,
    // much darker than the sky) for aim, path and trails, dark teal for the previous shot.
    aimColors: {
      aim: 0x6a12c9,
      previousShot: 0x00666e,
      trajectory: 0x7a0fb5,
      trailGlow: 0xb54dff,
      trailCore: 0x5a0aa8,
    },
    ui: { accent: '#b0753a', backdrop: '#3a2f22' },
  },
  thunderRidge: {
    id: 'thunderRidge',
    player: PLAYER_COLORS.thunderRidge,
    name: 'Thunder Ridge',
    // Storm: no sun, slate sky under heavy clouds; lightning strikes now and then.
    sky: [0x1b222d, 0x232c39, 0x2c3645, 0x364252],
    weather: 'storm',
    cloudColor: 0x4b5464,
    cloudAlpha: 0.96,
    hills: [0x2e3a44, 0x232e38],
    hillShape: 'hills',
    trees: { style: 'pine', colors: [0x1a2928, 0x213130, 0x152221], trunk: 0x2a2420 },
    ground: { fill: 0x4d5e45, edge: 0x6d7f5e, tufts: 0x3c4b36 },
    ui: { accent: '#5d7189', backdrop: '#161c25' },
  },
  frostpeakPass: {
    id: 'frostpeakPass',
    player: PLAYER_COLORS.frostpeakPass,
    name: 'Frostpeak Pass',
    // Cold, bright winter sky over snow-capped peaks; it snows and the wind pushes arrows aside. The planes step
    // down in lightness (sky, far peaks, near slopes, pines darkest) and the snowfield is pale, so a dark aim
    // stands out everywhere; a faint warm tint at the horizon and sun keeps it from being all grey-blue.
    sky: [0x7d9dc0, 0x9ab3cf, 0xbac9da, 0xd9dde2, 0xe8e2d8],
    sun: { x: 860, y: 110, radius: 46, color: 0xfff1d6 },
    weather: 'snow',
    cloudColor: 0xe9eef3,
    cloudAlpha: 0.85,
    hills: [0x8295b2, 0x5a6a84],
    hillShape: 'mountains',
    trees: { style: 'snowPine', colors: [0x2f4a44, 0x3a5a52, 0x263d38], trunk: 0x4a3b30 },
    ground: { fill: 0xdde5ec, edge: 0xf4f7fa, tufts: 0x9fb0c2 },
    // A mountain pass: high, broad rises and dips, few of them (flat only at the keeps).
    terrainAmplitude: 48,
    terrainWaviness: 0.9,
    wind: 300,
    // Red or gold has the same lightness as the grey-blue rock (it shimmers, no clear edge): deep navy instead,
    // much darker than sky, peaks and snow, dark violet for the previous shot. A faint pale halo, barely wider than
    // the lines (AIM_HALO), keeps them visible over the dark pines.
    aimColors: {
      aim: 0x1b2a6b,
      previousShot: 0x6a1f8f,
      trajectory: 0x1b2a6b,
      trailGlow: 0x4a5fc4,
      trailCore: 0x101a4a,
      halo: 0xeef3f7,
    },
    ui: { accent: '#5b6f8c', backdrop: '#1c2533' },
  },
  moonlitHollow: {
    id: 'moonlitHollow',
    player: PLAYER_COLORS.moonlitHollow,
    name: 'Moonlit Hollow',
    // Survival: hold out the night. Deep blue sky, a moon crossing it; dawn pinks the horizon, then the sun rises.
    sky: [0x0a1024, 0x111a38, 0x19264c, 0x22335f, 0x2d4270],
    weather: 'clear',
    cloudColor: 0xffffff,
    cloudAlpha: 0,
    hills: [0x22364d, 0x182a3c],
    hillShape: 'hills',
    trees: { style: 'round', colors: [0x143026, 0x1a3a2e, 0x10261f], trunk: 0x2c2620 },
    ground: { fill: 0x3a5a44, edge: 0x5f8466, tufts: 0x2c4836 },
    ui: { accent: '#4a6a9c', backdrop: '#0c1224' },
    nightCycle: {
      nightOf: 'greenMeadow',
      dawn: [0x2b3a6e, 0x4f4f86, 0x8a6390, 0xd88a84, 0xf4b98a],
      day: [0x6fa8d0, 0x8cbcd8, 0xaccfdc, 0xcfe0d8, 0xf1e2b8],
      moon: 0xeef1e4,
      sun: 0xffd890,
      // Night shade over the hills and trees (fades at dawn).
      shade: 0x070c1e,
      // Green like the meadow's, a little darker.
      dayHills: [0x557d66, 0x3d6450],
    },
  },
  auroraPeaks: {
    id: 'auroraPeaks',
    player: PLAYER_COLORS.auroraPeaks,
    name: 'Aurora Peaks',
    // Survival: Frostpeak Pass by night. Northern lights wave over the navy sky and fade at dawn, the peaks turn pink,
    // then the bright winter sky. It snows lightly and the wind blows as on the pass.
    sky: [0x050b1f, 0x0a1530, 0x0f1e3f, 0x15284d, 0x1c335a],
    weather: 'snow',
    cloudColor: 0x2a3656,
    cloudAlpha: 0.25,
    hills: [0x2a3a5c, 0x1c2944],
    hillShape: 'mountains',
    trees: { style: 'snowPine', colors: [0x172b2a, 0x1e3532, 0x122220], trunk: 0x2a2420 },
    // Snow in moonlight: blue-grey, darker than by day.
    ground: { fill: 0x8a9cba, edge: 0xb8c7dc, tufts: 0x5f7194 },
    terrainAmplitude: 48,
    terrainWaviness: 0.9,
    wind: 300,
    // Frostpeak's navy aim would vanish in the night: the default gold, with a dark halo over the pale snow.
    aimColors: { ...DEFAULT_AIM_COLORS, halo: 0x0a1228 },
    ui: { accent: '#3f8f86', backdrop: '#08111f' },
    nightCycle: {
      nightOf: 'frostpeakPass',
      dawn: [0x24305e, 0x45487f, 0x7e6293, 0xd394a4, 0xf0c2ae],
      day: [0x7d9dc0, 0x9ab3cf, 0xbac9da, 0xd9dde2, 0xe8e2d8],
      moon: 0xeef3ff,
      sun: 0xfff1d6,
      shade: 0x050a1c,
      // Frostpeak's grey-blue rock by day.
      dayHills: [0x8295b2, 0x5a6a84],
      aurora: [0x5cf0a0, 0x3fd8c4, 0xa47cf2],
    },
  },
  stormwatchRidge: {
    id: 'stormwatchRidge',
    player: PLAYER_COLORS.stormwatchRidge,
    name: 'Stormwatch Ridge',
    // Survival: Thunder Ridge by night. The moon glimpses through gaps in the storm deck, lightning lights up the field;
    // at dawn the storm dies down (less rain, thinner clouds, rarer bolts) and the sun rises into a rain-washed sky.
    sky: [0x070a10, 0x0b1018, 0x0f1520, 0x141b28],
    weather: 'storm',
    cloudColor: 0x2a303a,
    cloudAlpha: 0.96,
    hills: [0x232d39, 0x19222c],
    hillShape: 'hills',
    trees: { style: 'pine', colors: [0x10191a, 0x152020, 0x0c1414], trunk: 0x1e1a18 },
    ground: { fill: 0x34402f, edge: 0x4b5a42, tufts: 0x262f22 },
    ui: { accent: '#4f6178', backdrop: '#0a0e14' },
    nightCycle: {
      nightOf: 'thunderRidge',
      dawn: [0x2a3040, 0x3e4458, 0x5e5e70, 0x8a7c80],
      day: [0x6f8fae, 0x8fa8c0, 0xb0c0cc, 0xd8d8c8],
      moon: 0xdfe4ea,
      sun: 0xffe0a0,
      shade: 0x04060c,
      stars: 0.35,
      calms: true,
      // Washed green slopes once the storm has gone.
      dayHills: [0x4e6a6a, 0x3a5452],
      ending: { title: 'The storm passes!', until: 'the storm passed', left: 'to dawn' },
    },
  },
  eclipsePass: {
    id: 'eclipsePass',
    player: PLAYER_COLORS.eclipsePass,
    name: 'Eclipse Pass',
    // Survival: Crimson Pass under a total eclipse: a pale corona round the hidden sun, stars over a dark crimson sky.
    // Then a crescent of sun shows and grows, and the light comes back fast to the pass's red-orange evening sky.
    sky: [0x12070f, 0x1e0b18, 0x2c1020, 0x3d1626, 0x52202a],
    weather: 'clear',
    cloudColor: 0xffffff,
    cloudAlpha: 0,
    hills: [0x3a1a24, 0x28121c],
    hillShape: 'hills',
    trees: { style: 'pine', colors: [0x140b16, 0x1a0f1c, 0x0f0812], trunk: 0x1a1014 },
    ground: { fill: 0x6a4a32, edge: 0x8a6642, tufts: 0x4e3624 },
    ui: { accent: '#9c3a4a', backdrop: '#1a0c14' },
    nightCycle: {
      nightOf: 'crimsonPass',
      kind: 'eclipse',
      sunAt: { x: 0.62, y: 120 },
      dawn: [0x2a1838, 0x4a2244, 0x6e2c48, 0x9c4044, 0xc05c40],
      day: [0x3b2a52, 0x5e3456, 0x8e4152, 0xc65c45, 0xe8894a],
      // Only the map thumbnail's dark disc: in the game the moon just hides the sun.
      moon: 0x0c0608,
      sun: 0xffc27a,
      shade: 0x10050c,
      dayHills: [0x6e2f3a, 0x4a2230],
      ending: { title: 'The eclipse ends!', until: 'the sun came back', left: 'of the eclipse left' },
    },
  },
  sandstormDunes: {
    id: 'sandstormDunes',
    player: PLAYER_COLORS.sandstormDunes,
    name: 'Sandstorm Dunes',
    // Survival: Sunscorch Dunes in a sandstorm. Ochre dust hides the sky and the sun, sand blows across the field and
    // the far side is lost in haze, so enemies come out of the dust; at the end it clears under the blazing sun.
    sky: [0x9c7c4c, 0xac8a56, 0xbc985f, 0xc8a468, 0xd2ae72],
    weather: 'sandstorm',
    cloudColor: 0xc09a62,
    cloudAlpha: 0.75,
    hills: [0xb0905c, 0xa07e4c],
    hillShape: 'dunes',
    trees: { style: 'cactus', colors: [0x4e7442, 0x5f8650, 0x3d5e34], trunk: 0x3d5e34 },
    ground: { fill: 0xd2b27a, edge: 0xe4ca94, tufts: 0xb4925c },
    wind: 260,
    // As on Sunscorch: deep violet stands out against sand and dust.
    aimColors: {
      aim: 0x6a12c9,
      previousShot: 0x00666e,
      trajectory: 0x7a0fb5,
      trailGlow: 0xb54dff,
      trailCore: 0x5a0aa8,
    },
    ui: { accent: '#a0703a', backdrop: '#2e2416' },
    nightCycle: {
      nightOf: 'sunscorchDunes',
      kind: 'dust',
      sunAt: { x: 0.25, y: 92 },
      dawn: [0xa8b0a8, 0xbab8a2, 0xccc29c, 0xdac694, 0xe4ca8e],
      day: [0x7fb6d4, 0x9cc6d6, 0xbdd3cc, 0xdcd8b4, 0xeed9a2],
      moon: 0xffffff,
      sun: 0xfff3c4,
      // Dust browning the dunes and cacti.
      shade: 0x6a4a28,
      calms: true,
      dayHills: [0xd8b479, 0xc89c5c],
      ending: { title: 'The sandstorm clears!', until: 'the sandstorm cleared', left: 'of the storm left' },
    },
  },
};

export const BATTLEGROUND_IDS = Object.keys(BATTLEGROUNDS) as BattlegroundId[];
export const DEFAULT_BATTLEGROUND: BattlegroundId = 'greenMeadow';

export const aimColorsOf = (battleground: Battleground): AimColors => battleground.aimColors ?? DEFAULT_AIM_COLORS;
