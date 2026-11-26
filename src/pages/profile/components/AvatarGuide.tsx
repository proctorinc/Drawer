import type { FC } from 'react';
import { cn } from '@/utils';

// In the 100×100 box decorations draw in (src/decorations/art.tsx). The face sits
// a little small, leaving room around it for hair that hats then sit on
const Outline: FC = () => (
  <>
    <circle cx={50} cy={46} r={25} />
    <path d="M16 100C16 89 30 76 50 76C70 76 84 89 84 100" />
  </>
);

/** A dashed head and shoulders to draw over, so faces line up with decorations */
const AvatarGuide: FC<{ visible: boolean }> = ({ visible }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 100 100"
    fill="none"
    strokeWidth={0.9}
    strokeLinecap="round"
    className={cn(
      'absolute inset-0 size-full pointer-events-none transition-opacity duration-300',
      visible ? 'opacity-100' : 'opacity-0',
    )}
  >
    {/* Ink dashes on white, like the canvas edge lines, so it shows on any color */}
    <g stroke="white">
      <Outline />
    </g>
    <g stroke="var(--color-ink)" strokeDasharray="2.5 1.5">
      <Outline />
    </g>
  </svg>
);

export default AvatarGuide;
