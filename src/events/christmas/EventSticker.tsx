import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import { cn } from '@/utils';

// Each event sticker gets its own bauble color, in the order they're earned
const BAUBLES: Record<string, string> = {
  'first-snow': '#9fd3f0',
  'twelve-days': '#2f9e5b',
  'doodle-claus': '#e5483b',
  'deck-the-halls': '#e5483b',
  'carol-singer': '#9fd3f0',
  'jingle-bells': '#ffb400',
  'jingle-all-the-way': '#f2c14e',
  'snowed-in': '#cfe6f3',
  'first-flake': '#9fd3f0',
  'night-before': '#6c3fc4',
  'still-festive': '#ff8fb1',
  'secret-santa': '#e5483b',
};

/** The Grinch's ornaments are his shade of green, with his grin on */
const GRINCH_GREEN = '#9bd45a';
const isGrinch = (achievement: Achievement) => achievement.id.includes('grinch');

function baubleColor(achievement: Achievement) {
  if (isGrinch(achievement)) return GRINCH_GREEN;
  const key = Object.keys(BAUBLES).find((k) => achievement.id.endsWith(k));
  return key ? BAUBLES[key] : '#ffb400';
}

type Props = {
  achievement: Achievement;
  locked?: boolean;
  className?: string;
};

/** Event stickers are drawn as ornaments; they have no image on the server */
const EventSticker: FC<Props> = ({ achievement, locked, className }) => (
  <svg
    viewBox="0 0 48 52"
    aria-hidden="true"
    className={cn(locked && 'opacity-55', className)}
  >
    <path
      d="M24 2v6"
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <rect
      x="17"
      y="7"
      width="14"
      height="7"
      rx="1.5"
      fill="var(--color-xmas-gold)"
      stroke="var(--color-ink)"
      strokeWidth={2}
    />
    <circle
      cx="24"
      cy="32"
      r="18"
      fill={baubleColor(achievement)}
      stroke="var(--color-ink)"
      strokeWidth={2.2}
    />
    {isGrinch(achievement) ? (
      <>
        {/* Heavy-lidded eyes and that smug, lopsided grin */}
        <path
          d="M14 27q4-3 8 0M27 25q4-4 8-1"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <path
          d="M13 36q11 5 22-2q-4 8-11 8q-8 0-11-6z"
          fill="#3f6b1e"
          stroke="var(--color-ink)"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </>
    ) : (
      <>
        <path
          d="M8 30q16 8 32 0"
          fill="none"
          stroke="#fff"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="1 5"
        />
        <ellipse cx="17" cy="24" rx="4" ry="2.5" fill="#fff" opacity={0.7} />
      </>
    )}
  </svg>
);

export default EventSticker;
