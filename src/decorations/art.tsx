import type { CSSProperties, FC, ReactNode } from 'react';

/*
 * Shared bits for decoration art. Every decoration draws in a 100×100 box laid
 * over the avatar, so the avatar's edge is a circle of radius 50 around
 * (50, 50) whatever size the avatar is. Things may spill past the box a little
 * (hats up, wings out), like the santa hat does. Flat: ink outlines, no
 * shadows, gradients or glows.
 */

/** The ink outline everything gets; non-scaling, so it reads the same at every size */
export const ink = {
  stroke: 'var(--color-ink)',
  strokeWidth: 1.75,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

/** A thinner outline for small details */
export const fineInk = { ...ink, strokeWidth: 1.2 };

export const Overlay: FC<{ children: ReactNode }> = ({ children }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 100 100"
    overflow="visible"
    className="absolute inset-0 size-full pointer-events-none"
  >
    {children}
  </svg>
);

/**
 * Inline style for an animated SVG part, turning around a point of its own
 * box (e.g. '50% 100%' for its bottom middle). The keyframes live in
 * styles.css. Never put this on an element that also has a transform
 * attribute: wrap it in a <g> instead.
 */
export const motion = (
  animation: string,
  origin = '50% 50%',
  extra?: Record<string, string>,
): CSSProperties =>
  ({
    animation,
    transformBox: 'fill-box',
    transformOrigin: origin,
    ...extra,
  }) as CSSProperties;

/** A four-point twinkle, centered on (x, y) */
export const Sparkle: FC<{
  x: number;
  y: number;
  r: number;
  delay?: string;
  fill?: string;
}> = ({ x, y, r, delay = '0s', fill = '#fff' }) => (
  <path
    d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z`}
    fill={fill}
    {...fineInk}
    strokeWidth={0.9}
    className="animate-twinkle [transform-box:fill-box] origin-center"
    style={{ animationDelay: delay }}
  />
);

/** A point on a circle around the avatar's center; degrees clockwise from 3 o'clock */
export const onCircle = (degrees: number, radius: number) => {
  const angle = (degrees * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    x: round(50 + radius * Math.cos(angle)),
    y: round(50 + radius * Math.sin(angle)),
  };
};

export const COLORS = {
  gold: 'var(--color-gold)',
  goldDeep: 'var(--color-gold-deep)',
  goldLight: 'var(--color-gold-light)',
  butter: 'var(--color-butter)',
  coral: 'var(--color-coral)',
  red: 'var(--color-xmas-red)',
  green: 'var(--color-xmas-green)',
  sky: 'var(--color-sky)',
  blush: 'var(--color-blush)',
  ink: 'var(--color-ink)',
  blue: '#5aa9e6',
  pink: '#ff8fb1',
  purple: '#8a6bff',
  lilac: '#c9b8ff',
  wood: '#c98a4b',
  silver: '#c3cad4',
  white: '#fff',
};
