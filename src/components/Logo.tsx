import { useState } from 'react';
import LogoIcon, { logoTheme } from './logo/LogoIcon';
import { useLogoTheme } from './logo/useLogoTheme';
import type { FC, ReactNode } from 'react';
import { cn } from '@/utils';

// The intro animation plays once per app load, not on every page change
let introPlayed = false;

const sizes = {
  md: {
    icon: 50,
    kicker: 'text-[13px] tracking-[3px]',
    word: 'text-[40px]',
  },
  lg: {
    icon: 88,
    kicker: 'text-base tracking-[4px]',
    word: 'text-[64px]',
  },
};

type Props = {
  size?: keyof typeof sizes;
  /** Force a theme; by default it follows the live event */
  theme?: string | null;
  /** Stands in for the pencil mark, e.g. a back arrow */
  icon?: ReactNode;
  className?: string;
};

/** The app's logo lockup: the themed icon beside the wordmark */
const Logo: FC<Props> = ({ size = 'md', theme, icon, className }) => {
  const liveTheme = useLogoTheme();
  const themeKey = theme === undefined ? liveTheme : theme;
  const { accent } = logoTheme(themeKey);
  const [playIntro] = useState(() => {
    const play = !introPlayed;
    introPlayed = true;
    return play;
  });
  // Bumping the key remounts the icon, replaying its wiggle
  const [wiggleKey, setWiggleKey] = useState(0);
  const s = sizes[size];

  return (
    <div
      role="img"
      aria-label="The Daily Doodle"
      className={cn('flex items-center gap-2', className)}
      onPointerDown={() => setWiggleKey((key) => key + 1)}
    >
      {icon ?? (
        <div className="-rotate-5">
          {/* Keyed by theme too, so a mark that arrives with the event pops in */}
          <div
            key={`${wiggleKey}-${themeKey ?? 'default'}`}
            className={cn(
              'flex flex-none',
              wiggleKey > 0 && 'animate-wiggle',
              wiggleKey === 0 &&
                (playIntro || themeKey) &&
                'animate-in zoom-in-50 spin-in-45 duration-500 ease-[var(--ease-spring)]',
            )}
          >
            <LogoIcon
              theme={themeKey}
              size={s.icon}
              animateScribble={playIntro}
            />
          </div>
        </div>
      )}
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
        <span className="flex items-end gap-0.5">
          <span className={cn('font-cursive font-bold leading-[0.85]', s.word)}>
            Doodle
          </span>
          {accent}
        </span>
      </div>
    </div>
  );
};

export default Logo;
