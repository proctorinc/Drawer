import type { FC } from 'react';
import { cn } from '@/utils';

type Props = { className?: string };

// Santa hat geometry, all as fractions of the avatar's size so it fits any avatar.
// The brim's center (19, 25 in the hat's 40×32 box) is pinned to a point just
// inside the head's outline, up and to the right, and the hat tilts to match.
const HAT_ANGLE = 55; // degrees up from the head's horizontal center line
const HAT_SINK = 0.44; // brim sits this far out from center (0.5 = the edge)
const HAT_WIDTH = 0.62;
const BRIM = { x: 19 / 40, y: 25 / 32 };

const hatStyle = (() => {
  const angle = (HAT_ANGLE * Math.PI) / 180;
  const anchorX = 0.5 + HAT_SINK * Math.cos(angle);
  const anchorY = 0.5 - HAT_SINK * Math.sin(angle);
  const height = HAT_WIDTH * (32 / 40);
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  return {
    width: pct(HAT_WIDTH),
    left: pct(anchorX - BRIM.x * HAT_WIDTH),
    // Percentages for top resolve against width, and avatars are square
    top: pct(anchorY - BRIM.y * height),
    transformOrigin: `${pct(BRIM.x)} ${pct(BRIM.y)}`,
    rotate: `${90 - HAT_ANGLE}deg`,
  };
})();

/** Fits on any round avatar; its parent must be the avatar's square, positioned box */
export const SantaHat: FC<Props> = ({ className }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 40 32"
    className={cn('absolute pointer-events-none', className)}
    style={hatStyle}
  >
    <path
      d="M6 24C10 10 22 2 34 6c-4 4-4 10-2 16z"
      fill="var(--color-xmas-red)"
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
    <path
      d="M3 22q16-6 32 0v6q-16-6-32 0z"
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
    <circle
      cx="34"
      cy="6"
      r="4.5"
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

export const Holly: FC<Props> = ({ className }) => (
  <svg
    aria-hidden="true"
    width="26"
    height="22"
    viewBox="0 0 26 22"
    className={className}
  >
    <path
      d="M12 12C6 14 2 10 1 5c4 2 6 0 8 2 1-3 4-3 5-5 0 4 2 6-2 10z"
      fill="var(--color-xmas-green)"
      stroke="var(--color-ink)"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <path
      d="M14 12c5-3 9 0 11 4-4-1-5 2-8 0 0 3-3 4-4 5 0-4-3-5 1-9z"
      fill="var(--color-xmas-green)"
      stroke="var(--color-ink)"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    {[
      [12, 13],
      [16, 11],
      [14, 16],
    ].map(([cx, cy]) => (
      <circle
        key={`${cx}-${cy}`}
        cx={cx}
        cy={cy}
        r={2.6}
        fill="var(--color-xmas-red)"
        stroke="var(--color-ink)"
        strokeWidth={1.2}
      />
    ))}
  </svg>
);

/** Lumpy snow along the top edge of the navbar */
export const SnowCap: FC<Props> = ({ className }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 342 16"
    preserveAspectRatio="none"
    className={cn(
      'absolute -top-3 inset-x-0 w-full h-4 pointer-events-none',
      className,
    )}
  >
    <path
      d="M14 9q8-8 22-3 8-5 18 0 10 7 18 0 12-6 20 2 8-6 18-1 10 6 20 0 10-6 20 1 12 6 22-1 10-6 22 2 10-6 20 0 10 6 22 0 10-6 20 2 12-6 22 0 10 6 20-1 10-5 18 2 10-4 14 4-6 6-14 2-8 6-18 1-10 6-20 0-10 6-22 1-10-6-20 1-12 6-22 0-10-6-20 1-10 6-20 0-12-6-22 1-10-6-20 0-10 6-20 0-10-5-18 1-10-6-20 0-8 6-14-2z"
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={1.8}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** Red-and-white striped tape, for taping canvases and cards */
export const candyCaneTape = (color = 'var(--color-xmas-red)') =>
  `repeating-linear-gradient(45deg, ${color} 0 8px, #fff 8px 16px)`;

/** A small tree icon for buttons */
export const TreeIcon: FC<Props & { size?: number }> = ({
  className,
  size = 20,
}) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size * 1.2}
    viewBox="0 0 20 24"
    className={className}
  >
    <path
      d="M10 2l6 8h-3l5 7H2l5-7H4z"
      fill="var(--color-xmas-green)"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <rect x="8" y="17" width="4" height="5" fill="currentColor" />
    <circle cx="10" cy="2.5" r="2" fill="var(--color-xmas-gold)" />
  </svg>
);
