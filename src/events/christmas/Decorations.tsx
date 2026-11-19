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

/** A four-point twinkle, centered on (x, y) */
const Sparkle: FC<{ x: number; y: number; r: number; delay: string }> = ({
  x,
  y,
  r,
  delay,
}) => (
  <path
    d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z`}
    fill="#fff"
    className="animate-twinkle [transform-box:fill-box] origin-center"
    style={{ animationDelay: delay }}
  />
);

/** The hat itself, drawn in a 40×32 box */
const SantaHatArt: FC<{ golden?: boolean }> = ({ golden }) => (
  <>
    <path
      d="M6 24C10 10 22 2 34 6c-4 4-4 10-2 16z"
      fill={golden ? 'var(--color-xmas-gold)' : 'var(--color-xmas-red)'}
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
    {golden && (
      <>
        {/* A sheen down the hat, and a couple of glints */}
        <path
          d="M12 20C14 13 20 8 27 7"
          fill="none"
          stroke="var(--color-butter)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Sparkle x={20} y={15} r={3.5} delay="0s" />
        <Sparkle x={39} y={1} r={2.5} delay="0.7s" />
      </>
    )}
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
  </>
);

/** Fits on any round avatar; its parent must be the avatar's square, positioned box */
export const SantaHat: FC<Props & { golden?: boolean }> = ({
  className,
  golden,
}) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 40 32"
    overflow="visible"
    className={cn('absolute pointer-events-none', className)}
    style={hatStyle}
  >
    <SantaHatArt golden={golden} />
  </svg>
);

/** A santa hat on its own, as an icon */
export const SantaHatIcon: FC<Props & { size?: number }> = ({
  className,
  size = 20,
}) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 -2 40 36"
    overflow="visible"
    className={className}
  >
    <SantaHatArt />
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

/** Snow resting on the navbar: puffy lumps on top, a few drips over the edge */
export const SnowCap: FC<Props> = ({ className }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 342 24"
    preserveAspectRatio="none"
    className={cn(
      // y=18 in the box lines up with the bar's top edge
      'absolute -top-[18px] inset-x-0 w-full h-6 pointer-events-none',
      className,
    )}
  >
    <path
      d="M18 18C16 12 24 10 34 10a20 8 0 0 1 40 0 a24 6 0 0 1 48 0 a18 9 0 0 1 36 0 a26 6.5 0 0 1 52 0 a22 8.5 0 0 1 44 0 a29 7 0 0 1 58 0C321 10 326 14 324 18L292 18q-4 8-10 0L206 18q-4 7-9 0L126 18q-4 8-10 0L70 18q-4 6-8 0z"
      fill="#fff"
      stroke="var(--color-ink)"
      strokeWidth={1.8}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** A little snowman built into the navbar's snow, swaying a little */
export const Snowman: FC<Props> = ({ className }) => (
  <svg
    aria-hidden="true"
    width="30"
    height="36"
    viewBox="0 0 30 36"
    className={cn(
      'absolute pointer-events-none origin-bottom animate-sway',
      className,
    )}
  >
    <g stroke="var(--color-ink)" strokeWidth={1.8} strokeLinecap="round">
      {/* Twig arms */}
      <path d="M7 21L1 16M3 17.5l-1.5-3M23 21l6-5M27 17.5l1.5-3" fill="none" />
      {/* Body: outlined only over the top, so its base melts into the snow */}
      <circle cx="15" cy="26" r="8.5" fill="#fff" stroke="none" />
      <path d="M8 30.9A8.5 8.5 0 1 1 22 30.9" fill="none" />
      <circle cx="15" cy="13" r="6.5" fill="#fff" />
      {/* Scarf, with a tail blowing to the side */}
      <path
        d="M9 18.5q6 3 12 0M19 19.5l2 5"
        fill="none"
        stroke="var(--color-xmas-red)"
        strokeWidth={2.6}
      />
      {/* Hat */}
      <path d="M9 7.5h12" />
      <rect
        x="11"
        y="1"
        width="8"
        height="6.5"
        rx="1"
        fill="var(--color-ink)"
      />
    </g>
    <circle cx="12.6" cy="12" r="1" fill="var(--color-ink)" />
    <circle cx="17.4" cy="12" r="1" fill="var(--color-ink)" />
    <path d="M15 14l5 1.2-5 1z" fill="#ff9f43" />
    <circle cx="15" cy="24" r="0.9" fill="var(--color-ink)" />
    <circle cx="15" cy="28" r="0.9" fill="var(--color-ink)" />
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
