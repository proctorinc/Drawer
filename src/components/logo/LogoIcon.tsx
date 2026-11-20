import { CandyCaneMark, PencilMark } from './marks';
import type { FC, ReactNode, Ref } from 'react';
import type { MarkProps } from './marks';
import { Holly } from '@/events/christmas/Decorations';

type LogoTheme = {
  Mark: FC<MarkProps>;
  /** A small decoration beside the "the daily" kicker */
  accent?: ReactNode;
};

const DEFAULT_THEME: LogoTheme = { Mark: PencilMark };

/** Event themes swap in their own mark; any theme not listed keeps the pencil */
const EVENT_THEMES: Record<string, LogoTheme | undefined> = {
  christmas: {
    Mark: CandyCaneMark,
    accent: (
      <Holly className="-my-[0.4em] h-[1.6em] w-auto animate-in zoom-in-0 duration-500 delay-300 fill-mode-both" />
    ),
  },
};

export function logoTheme(theme: string | null): LogoTheme {
  return (theme && EVENT_THEMES[theme]) || DEFAULT_THEME;
}

type Props = {
  theme: string | null;
  size: number;
  animateScribble?: boolean;
  className?: string;
  ref?: Ref<SVGSVGElement>;
};

/**
 * The square app icon: a sketchy tile holding the theme's mark. This one SVG is
 * the logo everywhere: in the masthead, the loading screen, the tab icon and
 * the sign-in cards.
 */
const LogoIcon: FC<Props> = ({
  theme,
  size,
  animateScribble,
  className,
  ref,
}) => {
  const { Mark } = logoTheme(theme);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 52 52"
      aria-hidden="true"
      className={className}
    >
      {/* A second pencil line just off the tile, like the app's cards */}
      <path
        d="M17 7h22c5 0 9 4 9 9v22c0 6-4 10-9 10H16c-5 0-9-4-9-9V17c0-6 4-10 10-10z"
        fill="none"
        stroke="#2b2a33"
        strokeWidth={2}
      />
      <path
        d="M14 3h21c6 0 10 4 10 10v21c0 5-4 9-10 9H13c-6 0-10-4-10-9V12c0-5 5-9 11-9z"
        fill="#fff"
        stroke="#2b2a33"
        strokeWidth={2.5}
      />
      <svg x="8" y="7" width="32" height="32" viewBox="0 0 32 32">
        <Mark animateScribble={animateScribble} />
      </svg>
    </svg>
  );
};

export default LogoIcon;
