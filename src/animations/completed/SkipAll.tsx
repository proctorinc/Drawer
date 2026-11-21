import type { FC } from 'react';
import { cn } from '@/utils';

/**
 * The X in a celebration card's corner: closes it and skips everything else
 * waiting to play (the rest of the set, the XP fill, a rank-up, pings).
 */
export const SkipAll: FC<{ onSkip?: () => void; className?: string }> = ({
  onSkip,
  className,
}) => {
  if (!onSkip) return null;
  return (
    <button
      type="button"
      aria-label="Skip the rest"
      onClick={onSkip}
      className={cn(
        'press absolute top-2 right-2 z-10 grid place-items-center size-9 rounded-full text-ink hover:bg-paper cursor-pointer',
        className,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M5 5.5 15 14.5M15 5 5.5 15" />
      </svg>
    </button>
  );
};
