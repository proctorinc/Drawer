/**
 * Rank tiers for levels, climbing like a competitive ladder: plain metals at
 * the bottom, gems in the middle, then pulsing, shimmering and finally
 * rainbow badges at the top. Everything stays flat, like the rest of the UI:
 * solid fills and hard-edged bands, no shading, highlights or blur.
 *
 * Prod's highest player was level 9 (Gold) when these were set, so the ladder
 * runs well past that: Mythic starts at 30, about ten times their XP.
 */
export type RankTier = {
  id: string;
  name: string;
  /** Lowest level in this tier */
  from: number;
  /** Badge fill (any CSS background) */
  background: string;
  /** Number color */
  text: string;
  /** Colored ring between the badge and its ink outline */
  ring?: string;
  /** A light sweep that glints across the badge */
  sheen?: boolean;
  /** Little stars twinkling around the badge */
  sparkle?: boolean;
  /** A flat outer ring in this color that pulses outward */
  glow?: string;
  /** Spinning rainbow bands */
  holo?: boolean;
};

export const RANK_TIERS: Array<RankTier> = [
  {
    id: 'graphite',
    name: 'Graphite',
    from: 1,
    background: '#dcd8e3',
    text: 'var(--color-ink)',
  },
  {
    id: 'bronze',
    name: 'Bronze',
    from: 3,
    background: '#c47a45',
    text: '#fff7ef',
  },
  {
    id: 'silver',
    name: 'Silver',
    from: 5,
    background: '#c3cad4',
    text: 'var(--color-ink)',
  },
  {
    id: 'gold',
    name: 'Gold',
    from: 7,
    background: '#ffc233',
    text: '#5a3700',
    sheen: true,
  },
  {
    id: 'platinum',
    name: 'Platinum',
    from: 10,
    background: '#4fcfb9',
    text: '#073b35',
    ring: '#c9fff5',
    sheen: true,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    from: 13,
    // Flat facets: hard stops, two blues, like a gem in a sticker
    background:
      'conic-gradient(from 45deg, #7cc4ff 0 25%, #3d84f0 0 50%, #7cc4ff 0 75%, #3d84f0 0)',
    text: '#ffffff',
    ring: '#d9f1ff',
    sheen: true,
    sparkle: true,
  },
  {
    id: 'master',
    name: 'Master',
    from: 16,
    background: '#8b3fe0',
    text: '#ffffff',
    ring: '#ffc233',
    sheen: true,
    sparkle: true,
    glow: '#b47bff',
  },
  {
    id: 'grandmaster',
    name: 'Grandmaster',
    from: 20,
    background: '#e5352b',
    text: '#fff3e0',
    ring: '#ffc233',
    sheen: true,
    sparkle: true,
    glow: '#ff7a5c',
  },
  {
    id: 'champion',
    name: 'Champion',
    from: 25,
    // Ink-black with gold numerals and a turning gold-striped rim
    background: '#1d1a26',
    text: '#ffc233',
    ring: 'conic-gradient(from var(--rank-angle), #ffc233 0 25%, #fff0a8 0 50%, #ffc233 0 75%, #fff0a8 0)',
    sheen: true,
    sparkle: true,
    glow: '#ffc233',
  },
  {
    id: 'mythic',
    name: 'Mythic',
    from: 30,
    // Flat rainbow bands that turn
    background:
      'conic-gradient(from var(--rank-angle), #ff6b9d 0 14%, #ffb400 0 28%, #f2f25a 0 42%, #4de0a6 0 57%, #3ab8ff 0 71%, #8a6bff 0 85%, #ff6bf0 0)',
    text: '#ffffff',
    ring: '#ffffff',
    sheen: true,
    sparkle: true,
    glow: '#c08bff',
    holo: true,
  },
];

export function rankFor(level: number): RankTier {
  let tier = RANK_TIERS[0];
  for (const candidate of RANK_TIERS) {
    if (level >= candidate.from) tier = candidate;
  }
  return tier;
}

/** XP each level adds over the last; matches xpPerLevelStep on the server */
export const LEVEL_XP_STEP = 50;

/** Total XP needed to reach a level (level 1 starts at 0) */
export function xpToReach(level: number): number {
  return (LEVEL_XP_STEP * level * (level - 1)) / 2;
}

/** The levels a tier covers; the top tier has no end */
export function tierRange(tier: RankTier): { from: number; to?: number } {
  const index = RANK_TIERS.indexOf(tier);
  if (index === RANK_TIERS.length - 1) return { from: tier.from };
  return { from: tier.from, to: RANK_TIERS[index + 1].from - 1 };
}

/** What a player at each level is called; the last one sticks from then on */
const LEVEL_TITLES = [
  'Doodler',
  'Scribbler',
  'Sketcher',
  'Inker',
  'Shader',
  'Illustrator',
  'Art Goblin',
  'Picasso-ish',
  'Pencil Legend',
];

export const levelTitle = (level: number) =>
  LEVEL_TITLES[Math.max(1, Math.min(level, LEVEL_TITLES.length)) - 1];
