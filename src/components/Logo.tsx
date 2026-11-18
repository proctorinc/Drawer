import { useState } from 'react';
import type { FC } from 'react';
import { cn } from '@/utils';

// The intro animation plays once per app load, not on every page change
let introPlayed = false;

const sizes = {
  md: {
    tile: 'w-[46px] h-[46px] border-[2.5px] shadow-pencil-sm',
    mark: 34,
    kicker: 'text-[13px] tracking-[3px]',
    word: 'text-[40px]',
  },
  lg: {
    tile: 'w-20 h-20 border-[3px] shadow-pencil',
    mark: 60,
    kicker: 'text-base tracking-[4px]',
    word: 'text-[64px]',
  },
};

type PencilMarkProps = {
  size: number;
  animateScribble?: boolean;
};

// A crayon pencil striped in the house colors, drawing a little squiggle
export const PencilMark: FC<PencilMarkProps> = ({ size, animateScribble }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    stroke="var(--color-ink)"
    strokeWidth={1.6}
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path
      d="M3 30q3-3 6 0t6 0"
      fill="none"
      stroke="var(--color-coral)"
      strokeWidth={2.2}
      strokeLinecap="round"
      pathLength={40}
      strokeDasharray={40}
      className={cn(animateScribble && 'animate-scribble')}
    />
    <g transform="rotate(-45 16 16)">
      <rect x="9" y="11" width="6" height="10" fill="#ff6b57" />
      <rect x="15" y="11" width="6" height="10" fill="#3a7bd5" />
      <rect x="21" y="11" width="5" height="10" fill="#ffb400" />
      <rect x="26" y="11" width="4" height="10" rx="1.5" fill="#ffb3a8" />
      <path d="M9 11L2 16l7 5z" fill="#fbe3c0" />
      <path d="M2 16l2.8-2v4z" fill="var(--color-ink)" />
    </g>
  </svg>
);

type Props = {
  size?: keyof typeof sizes;
  className?: string;
};

const Logo: FC<Props> = ({ size = 'md', className }) => {
  const [playIntro] = useState(() => {
    const play = !introPlayed;
    introPlayed = true;
    return play;
  });
  // Bumping the key remounts the tile, replaying its wiggle
  const [wiggleKey, setWiggleKey] = useState(0);
  const s = sizes[size];

  return (
    <div
      role="img"
      aria-label="The Daily Doodle"
      className={cn('flex items-center gap-2.5', className)}
      onPointerDown={() => setWiggleKey((key) => key + 1)}
    >
      <div className="-rotate-5">
        <div
          key={wiggleKey}
          className={cn(
            'flex flex-none items-center justify-center box-border bg-white border-ink rounded-sketch',
            s.tile,
            wiggleKey > 0 && 'animate-wiggle',
            playIntro &&
              wiggleKey === 0 &&
              'animate-in zoom-in-50 spin-in-45 duration-500 ease-[var(--ease-spring)]',
          )}
        >
          <PencilMark size={s.mark} animateScribble={playIntro} />
        </div>
      </div>
      <div
        className={cn(
          'flex flex-col leading-none',
          playIntro &&
            'animate-in fade-in slide-in-from-left-3 duration-500 delay-150 fill-mode-both',
        )}
      >
        <span className={cn('uppercase text-pencil pl-[3px]', s.kicker)}>
          the daily
        </span>
        <span className={cn('font-cursive font-bold leading-[0.85]', s.word)}>
          Doodle
        </span>
      </div>
    </div>
  );
};

export default Logo;
