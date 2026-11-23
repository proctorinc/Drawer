import type { FC } from 'react';
import { hatStyle } from '@/events/christmas/Decorations';
import { cn } from '@/utils';

const FUR = '#7cbf3f';
const FUR_DEEP = '#4d7a24';
const TRIM = '#efe6cf';

const stroke = {
  stroke: 'var(--color-ink)',
  strokeWidth: 2,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

/**
 * The Grinch's own hat, sat where the santa hat goes: his shade of green, its
 * tip flopped over, a patch sewn on, and a moth-eaten trim gone grey. Worn for
 * the day by everyone who joins him, and for keeps by whoever sees all his
 * days through.
 */
export const GrinchHat: FC<{ className?: string }> = ({ className }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 40 32"
    overflow="visible"
    className={cn('absolute pointer-events-none', className)}
    style={hatStyle}
  >
    {/* Up to a point, then flopped over to hang down the side */}
    <path
      d="M6 24C9 11 17 3 26 4c7 1 10 7 9 14c-2-3-5-3-6 0c-1 2 0 4 2 5z"
      fill={FUR}
      {...stroke}
    />
    {/* A patch, stitched on crooked */}
    <path
      d="M13 12l6-2 1 6-6 2z"
      fill="#c95b4a"
      {...stroke}
      strokeWidth={1.5}
    />
    <path
      d="M14 11.2l.6 1.6M18.2 10.4l.5 1.6M19.6 15.4l-1.5.6M14.6 17.2l-.5-1.4"
      stroke="var(--color-ink)"
      strokeWidth={1}
      strokeLinecap="round"
    />
    {/* A ragged trim, chewed along the bottom */}
    <path
      d="M3 22q16-6 32 0v5l-3-2-2.5 2.5-3-2-3 2-2.5-2.5-3.5 2-3-2.5-3 2.5-3-2-2.5 2.5-3-2.5z"
      fill={TRIM}
      {...stroke}
    />
    <circle cx="12" cy="24" r="1.1" fill={FUR_DEEP} />
    <circle cx="24" cy="23.5" r="0.9" fill={FUR_DEEP} />
    {/* A scruffy pom-pom on the end of the droop */}
    <path
      d="M31 19l1.5-2.5 1.5 1.5 2-1.5.5 2.5 2.5.5-1.5 2 1.5 2-2.5.5-1 2.5-2-1.5-2 1-.5-2.5-2-1 1.5-2z"
      fill={TRIM}
      {...stroke}
    />
  </svg>
);
