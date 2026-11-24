import type { FC, ReactNode } from 'react';
import { cn } from '@/utils';

type Props = {
  /** Who's talking: a profile picture, or a judge's face */
  portrait: ReactNode;
  /** For screen readers, since only the portrait shows who it is */
  name: string;
  /** Your own words sit on the right in your color, like texts */
  mine?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * An RPG-style dialogue box: the speaker's portrait beside everything they
 * said. Nothing sits under the portrait, so the words get the full width.
 */
export const SpeechBox: FC<Props> = ({
  portrait,
  name,
  mine,
  children,
  className,
}) => {
  const fill = mine ? 'bg-me text-me-ink' : 'bg-white';

  return (
    <div
      className={cn(
        'flex gap-2.5 items-start',
        mine && 'flex-row-reverse',
        className,
      )}
    >
      <div className="flex-none">{portrait}</div>
      <div
        className={cn(
          'relative flex-1 min-w-0 flex flex-col gap-1 px-2.5 py-1.5 border-2 border-ink rounded-sketch-alt',
          fill,
        )}
      >
        {/* The tail points back at the portrait */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-3 size-3 border-ink rotate-45',
            fill,
            mine
              ? '-right-[7px] border-t-2 border-r-2'
              : '-left-[7px] border-l-2 border-b-2',
          )}
        />
        <span className="sr-only">{name} said:</span>
        {children}
      </div>
    </div>
  );
};
