import type { FC } from 'react';
import { cn } from '@/utils';

// Literal colors rather than CSS variables: these marks are also serialized
// into standalone SVGs (tab icon, Clerk logo), where the page's vars don't exist
const INK = '#2b2a33';
const CORAL = '#ff6b57';
const XMAS_RED = '#e5483b';
const WOOD = '#fbe3c0';

export type MarkProps = {
  animateScribble?: boolean;
};

/** The little line every mark is drawing, bottom left of the tile */
const Scribble: FC<{ color: string; animate?: boolean }> = ({
  color,
  animate,
}) => (
  <path
    d="M3 30q3-3 6 0t6 0"
    fill="none"
    stroke={color}
    strokeWidth={2.2}
    strokeLinecap="round"
    pathLength={40}
    strokeDasharray={40}
    className={cn(animate && 'animate-scribble')}
  />
);

/** A sharpened point at the left end of the drawing tool, in its rotated frame */
const PencilPoint: FC<{ halfWidth: number; baseX: number }> = ({
  halfWidth,
  baseX,
}) => (
  <>
    <path
      d={`M${baseX} ${16 - halfWidth}L2 16l${baseX - 2} ${halfWidth}z`}
      fill={WOOD}
    />
    <path d="M2 16l2.8-2v4z" fill={INK} />
  </>
);

// Marks are drawn in a 32×32 box, angled 45° with the point at bottom left

/** A pencil striped in the house colors */
export const PencilMark: FC<MarkProps> = ({ animateScribble }) => (
  <g stroke={INK} strokeWidth={1.6} strokeLinejoin="round">
    <Scribble color={CORAL} animate={animateScribble} />
    <g transform="rotate(-45 16 16)">
      <rect x="9" y="11" width="6" height="10" fill="#ff6b57" />
      <rect x="15" y="11" width="6" height="10" fill="#3a7bd5" />
      <rect x="21" y="11" width="5" height="10" fill="#ffb400" />
      <rect x="26" y="11" width="4" height="10" rx="1.5" fill="#ffb3a8" />
      <PencilPoint baseX={9} halfWidth={5} />
    </g>
  </g>
);

/** Shaft along the pencil's line, hooked at the far end */
const CANE_PATH = 'M9 16H21.5a5 5 0 0 0 0-10h-1.5';

/** Christmas: a candy cane sharpened to a pencil point */
export const CandyCaneMark: FC<MarkProps> = ({ animateScribble }) => (
  <g stroke={INK} strokeWidth={1.6} strokeLinejoin="round">
    <Scribble color={XMAS_RED} animate={animateScribble} />
    <g transform="rotate(-45 16 16)" fill="none" strokeLinecap="round">
      <path d={CANE_PATH} strokeWidth={7.6} />
      <path d={CANE_PATH} stroke="#fff" strokeWidth={4.8} />
      <path
        d={CANE_PATH}
        stroke={XMAS_RED}
        strokeWidth={4.8}
        strokeLinecap="butt"
        strokeDasharray="3 3"
      />
      {/* Drawn last so it caps the shaft's rounded end */}
      <PencilPoint baseX={9} halfWidth={3.8} />
    </g>
  </g>
);
