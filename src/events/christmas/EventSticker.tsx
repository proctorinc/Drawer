import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import { cn } from '@/utils';

// Each event sticker gets its own bauble color, in the order they're earned
const BAUBLES: Record<string, string> = {
  'first-snow': '#9fd3f0',
  'twelve-days': '#2f9e5b',
  'doodle-claus': '#e5483b',
};

function baubleColor(achievement: Achievement) {
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
  </svg>
);

export default EventSticker;
