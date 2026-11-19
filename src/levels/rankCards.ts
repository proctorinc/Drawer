import { rankFor } from './ranks';
import type { RankTier } from './ranks';

/**
 * How a card dresses up for each rank. Low ranks are plain paper with a
 * colored pin; the middle ranks get tinted paper, a colored rim and a glint;
 * the top ranks go dark with gold or rainbow rims that turn, twinkles and a
 * pulsing outline. Flat like the badges: solid fills and hard-edged bands.
 */
export type RankCardStyle = {
  /** Card fill (any CSS background) */
  background: string;
  /** Main text */
  text: string;
  /** Secondary text; replaces the pencil gray inside the card */
  muted: string;
  /** Highlighter swipe behind the title */
  highlight: string;
  /** Push pin head */
  pin: string;
  /** Progress bar fill (color or gradient) */
  fill: string;
  /** A band between the ink outline and the fill (any CSS background) */
  rim?: string;
  /** Rim thickness in px */
  rimWidth?: number;
  /** A faint pattern laid over the fill */
  pattern?: string;
  /** How strongly the pattern shows; defaults to fully */
  patternOpacity?: number;
};

const RAINBOW =
  '#ff6b9d 0 14%, #ffb400 0 28%, #f2f25a 0 42%, #4de0a6 0 57%, #3ab8ff 0 71%, #8a6bff 0 85%, #ff6bf0 0';

export const RANK_CARDS: Record<string, RankCardStyle> = {
  graphite: {
    background: '#ffffff',
    text: 'var(--color-ink)',
    muted: '#6a6475',
    highlight: '#e4e0ea',
    pin: '#9a94a6',
    fill: '#dcd8e3',
  },
  bronze: {
    background: '#fcf3ea',
    text: 'var(--color-ink)',
    muted: '#7a5a44',
    highlight: '#f2cba8',
    pin: '#c47a45',
    fill: '#d9935e',
  },
  silver: {
    background: '#f2f4f7',
    text: 'var(--color-ink)',
    muted: '#5f6876',
    highlight: '#d3dae3',
    pin: '#8f9aa8',
    fill: '#c3cad4',
    // Brushed metal
    pattern:
      'repeating-linear-gradient(100deg, transparent 0 10px, rgb(255 255 255 / 0.7) 10px 12px)',
  },
  gold: {
    background: '#fff7dc',
    text: 'var(--color-ink)',
    muted: '#7a5a10',
    highlight: '#ffd666',
    pin: '#ffb400',
    fill: '#ffc233',
    rim: '#ffc233',
    rimWidth: 4,
  },
  platinum: {
    background: '#e9fbf7',
    text: 'var(--color-ink)',
    muted: '#2f6d63',
    highlight: '#a9eedf',
    pin: '#2fb59f',
    fill: '#4fcfb9',
    rim: 'repeating-linear-gradient(135deg, #4fcfb9 0 8px, #c9fff5 8px 14px)',
    rimWidth: 5,
  },
  diamond: {
    background: '#eaf5ff',
    text: 'var(--color-ink)',
    muted: '#3a5f8a',
    highlight: '#b8dcff',
    pin: '#3d84f0',
    fill: '#7cc4ff',
    rim: 'repeating-linear-gradient(135deg, #3d84f0 0 10px, #7cc4ff 10px 20px, #d9f1ff 20px 26px)',
    rimWidth: 6,
    // Big flat facets
    pattern:
      'conic-gradient(from 45deg at 85% 15%, rgb(124 196 255 / 0.18) 0 25%, transparent 0 50%, rgb(124 196 255 / 0.18) 0 75%, transparent 0)',
  },
  master: {
    background: '#7a32d0',
    text: '#ffffff',
    muted: '#e3d0ff',
    highlight: '#a35cf5',
    pin: '#ffc233',
    fill: '#ffc233',
    rim: '#ffc233',
    rimWidth: 6,
    pattern:
      'repeating-linear-gradient(-45deg, transparent 0 14px, rgb(255 255 255 / 0.05) 14px 28px)',
  },
  grandmaster: {
    background: '#d42e25',
    text: '#fff3e0',
    muted: '#ffd6c8',
    highlight: '#a51d17',
    pin: '#ffc233',
    fill: '#ffc233',
    rim: 'repeating-linear-gradient(135deg, #ffc233 0 10px, #fff0a8 10px 16px)',
    rimWidth: 7,
    pattern:
      'repeating-linear-gradient(-45deg, transparent 0 14px, rgb(255 255 255 / 0.06) 14px 28px)',
  },
  champion: {
    background: '#1d1a26',
    text: '#ffc233',
    muted: '#cdbd8e',
    highlight: '#5a4410',
    pin: '#ffc233',
    fill: 'repeating-linear-gradient(90deg, #ffc233 0 12px, #fff0a8 12px 18px)',
    rim: 'conic-gradient(from var(--rank-angle), #ffc233 0 25%, #fff0a8 0 50%, #ffc233 0 75%, #fff0a8 0)',
    rimWidth: 7,
    pattern:
      'repeating-linear-gradient(-45deg, transparent 0 14px, rgb(255 194 51 / 0.07) 14px 28px)',
  },
  mythic: {
    background: '#1d1a26',
    text: '#ffffff',
    muted: '#d7ccff',
    highlight: '#6b4fd8',
    pin: '#ff6bf0',
    fill: `linear-gradient(90deg, #ff6b9d, #ffb400, #f2f25a, #4de0a6, #3ab8ff, #8a6bff, #ff6bf0)`,
    rim: `conic-gradient(from var(--rank-angle), ${RAINBOW})`,
    rimWidth: 8,
    pattern: `conic-gradient(from var(--rank-angle) at 50% 130%, ${RAINBOW})`,
    patternOpacity: 0.2,
  },
};

export function rankCardFor(level: number): {
  tier: RankTier;
  card: RankCardStyle;
} {
  const tier = rankFor(level);
  return { tier, card: RANK_CARDS[tier.id] };
}
