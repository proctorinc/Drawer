/**
 * How big the rank-up moment gets for each tier. One component reads this
 * table, so the spectacle escalates by data rather than by ten bespoke
 * animations: Bronze is a tidy flip, the metals add a sheen sweep and paper
 * confetti, the gems crack open with flying facets and sparkles, Master and
 * up pulse flat rings and burst harder, Champion turns a gold rim and slows
 * everything down, and Mythic floods the whole screen with rainbow.
 *
 * Everything stays flat: solid fills, hard-edged bands, ink outlines.
 */
export type RankUpIntensity = {
  /** Timeline multiplier; >1 is a slower, grander reveal */
  pace: number;
  /** How the old badge turns into the new one */
  reveal: 'flip' | 'crack';
  /** Backdrop that washes in first (any CSS background); a deeper shade of
   * the tier's color so the badge stands out against it */
  wash: string;
  /** Spins the wash, for backgrounds using var(--rank-angle) */
  washSpins?: boolean;
  /** Paper colors for confetti, facets and rays */
  palette: Array<string>;
  /** Little ink strokes that flick out when the new badge lands */
  popLines: number;
  /** A hard-edged white band that sweeps across the whole screen */
  sheenSweep: boolean;
  /** Paper confetti raining from the top */
  confetti: number;
  /** Confetti thrown outward from the badge as it lands */
  burst: number;
  /** Flat diamond shards that fly off the badge */
  facets: number;
  /** Twinkles around the badge */
  sparkles: number;
  /** Flat rings that pulse outward from the badge */
  rings: number;
  /** Ring color */
  ringColor?: string;
  /** Hard-stop sunburst rays behind the badge (0 = none) */
  rays: number;
  /** A big turning striped rim around the badge */
  rim?: 'gold' | 'rainbow';
  /** A background that floods the screen after the reveal */
  takeover?: string;
  /** Badge diameter in px */
  badgeSize: number;
  /** Auto-finish after this long (if the user isn't interacting) */
  autoMs: number;
  /** Button colors, for dark cards where an ink button would vanish */
  button?: { background: string; color: string };
};

const RAINBOW =
  '#ff6b9d 0 14%, #ffb400 0 28%, #f2f25a 0 42%, #4de0a6 0 57%, #3ab8ff 0 71%, #8a6bff 0 85%, #ff6bf0 0';

export const RANK_UP_INTENSITY: Record<string, RankUpIntensity> = {
  graphite: {
    pace: 1,
    reveal: 'flip',
    wash: '#8d879a',
    palette: ['#ffffff', '#9a94a6', '#2b2a33'],
    popLines: 6,
    sheenSweep: false,
    confetti: 0,
    burst: 0,
    facets: 0,
    sparkles: 0,
    rings: 0,
    rays: 0,
    badgeSize: 120,
    autoMs: 7000,
  },
  bronze: {
    pace: 1,
    reveal: 'flip',
    wash: '#a85f2e',
    palette: ['#fcf3ea', '#f2cba8', '#d9935e', '#2b2a33'],
    popLines: 8,
    sheenSweep: false,
    confetti: 0,
    burst: 10,
    facets: 0,
    sparkles: 0,
    rings: 0,
    rays: 0,
    badgeSize: 124,
    autoMs: 7000,
  },
  silver: {
    pace: 1,
    reveal: 'flip',
    wash: '#8f9aa8',
    palette: ['#ffffff', '#8f9aa8', '#d3dae3', '#2b2a33', '#ffc233'],
    popLines: 8,
    sheenSweep: true,
    confetti: 28,
    burst: 12,
    facets: 0,
    sparkles: 0,
    rings: 0,
    rays: 0,
    badgeSize: 128,
    autoMs: 7000,
  },
  gold: {
    pace: 1,
    reveal: 'flip',
    wash: '#f29d00',
    palette: ['#ffffff', '#fff0a8', '#d99100', '#ff6b57', '#2b2a33'],
    popLines: 10,
    sheenSweep: true,
    confetti: 44,
    burst: 16,
    facets: 0,
    sparkles: 0,
    rings: 0,
    rays: 12,
    badgeSize: 132,
    autoMs: 7500,
  },
  platinum: {
    pace: 1.05,
    reveal: 'crack',
    wash: '#2fb59f',
    palette: ['#c9fff5', '#ffffff', '#2fb59f', '#073b35', '#ffe27a'],
    popLines: 10,
    sheenSweep: true,
    confetti: 50,
    burst: 18,
    facets: 6,
    sparkles: 6,
    rings: 0,
    rays: 12,
    badgeSize: 136,
    autoMs: 8000,
  },
  diamond: {
    pace: 1.1,
    reveal: 'crack',
    // The badge's own hard-stop facets, blown up to fill the screen
    wash: 'conic-gradient(from 45deg at 50% 38%, #7cc4ff 0 25%, #3d84f0 0 50%, #7cc4ff 0 75%, #3d84f0 0)',
    palette: ['#d9f1ff', '#ffffff', '#7cc4ff', '#3d84f0', '#ffe27a'],
    popLines: 12,
    sheenSweep: true,
    confetti: 56,
    burst: 20,
    facets: 10,
    sparkles: 10,
    rings: 0,
    rays: 16,
    badgeSize: 140,
    autoMs: 8000,
  },
  master: {
    pace: 1.15,
    reveal: 'crack',
    wash: '#6a2bb8',
    palette: ['#ffc233', '#ffffff', '#b47bff', '#e3d0ff', '#2b2a33'],
    popLines: 12,
    sheenSweep: true,
    confetti: 70,
    burst: 28,
    facets: 10,
    sparkles: 10,
    rings: 2,
    ringColor: '#ffc233',
    rays: 20,
    badgeSize: 144,
    autoMs: 9000,
  },
  grandmaster: {
    pace: 1.2,
    reveal: 'crack',
    wash: '#b8231b',
    palette: ['#ffc233', '#fff0a8', '#ffffff', '#ff7a5c', '#2b2a33'],
    popLines: 14,
    sheenSweep: true,
    confetti: 90,
    burst: 36,
    facets: 12,
    sparkles: 12,
    rings: 3,
    ringColor: '#ffc233',
    rays: 24,
    badgeSize: 148,
    autoMs: 9500,
  },
  champion: {
    pace: 1.45,
    reveal: 'crack',
    wash: '#1d1a26',
    palette: ['#ffc233', '#fff0a8', '#d99100', '#ffffff'],
    popLines: 16,
    sheenSweep: true,
    confetti: 100,
    burst: 40,
    facets: 14,
    sparkles: 14,
    rings: 3,
    ringColor: '#ffc233',
    rays: 24,
    rim: 'gold',
    badgeSize: 152,
    autoMs: 10000,
    button: { background: '#ffc233', color: 'var(--color-ink)' },
  },
  mythic: {
    pace: 1.5,
    reveal: 'crack',
    wash: '#1d1a26',
    palette: [
      '#ff6b9d',
      '#ffb400',
      '#f2f25a',
      '#4de0a6',
      '#3ab8ff',
      '#8a6bff',
      '#ff6bf0',
      '#ffffff',
    ],
    popLines: 16,
    sheenSweep: true,
    confetti: 130,
    burst: 48,
    facets: 16,
    sparkles: 18,
    rings: 4,
    ringColor: '#ffffff',
    rays: 28,
    rim: 'rainbow',
    takeover: `conic-gradient(from var(--rank-angle) at 50% 38%, ${RAINBOW})`,
    badgeSize: 156,
    autoMs: 10500,
    button: { background: '#ffffff', color: 'var(--color-ink)' },
  },
};

export function intensityFor(tierId: string): RankUpIntensity {
  return RANK_UP_INTENSITY[tierId] ?? RANK_UP_INTENSITY.bronze;
}

/**
 * The beats, in ms at pace 1. Each one starts at its time × pace:
 * wash → old badge → crack/flip → new badge (burst, rings) → name stamp
 * (confetti, sweep, takeover) → continue button.
 */
export const BEATS = {
  wash: 0,
  old: 380,
  turn: 1250,
  new: 1650,
  stamp: 2150,
  ready: 2950,
} as const;

export type Beat = keyof typeof BEATS;

export const BEAT_ORDER: Array<Beat> = [
  'wash',
  'old',
  'turn',
  'new',
  'stamp',
  'ready',
];

/** A rim's turning stripes */
export const RIMS: Record<'gold' | 'rainbow', string> = {
  gold: 'conic-gradient(from var(--rank-angle), #ffc233 0 12.5%, #fff0a8 0 25%, #ffc233 0 37.5%, #fff0a8 0 50%, #ffc233 0 62.5%, #fff0a8 0 75%, #ffc233 0 87.5%, #fff0a8 0)',
  rainbow: `conic-gradient(from var(--rank-angle), ${RAINBOW})`,
};
