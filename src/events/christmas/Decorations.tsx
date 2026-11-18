import type { FC } from 'react';
import { cn } from '@/utils';

type Props = { className?: string };

/** Sits on an avatar or the logo; position it with className */
export const SantaHat: FC<Props> = ({ className }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 40 32"
    className={cn(
      'absolute pointer-events-none -top-[38%] -right-[22%] w-[65%] rotate-[18deg]',
      className,
    )}
  >
    <path
      d="M6 24C10 10 22 2 34 6c-4 4-4 10-2 16z"
      fill="var(--color-xmas-red)"
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeLinejoin="round"
    />
    <path
      d="M3 22q16-6 32 0v6q-16-6-32 0z"
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeLinejoin="round"
    />
    <circle
      cx="34"
      cy="6"
      r="4.5"
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={2}
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
      'absolute -top-[7px] inset-x-0 w-full h-4 pointer-events-none',
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
