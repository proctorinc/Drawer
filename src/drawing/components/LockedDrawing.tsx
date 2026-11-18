import type { FC } from 'react';
import { LockIcon } from '@/components/icons';
import { cn } from '@/utils';

/** Stands in for a friend's drawing of today's prompt until you've drawn yours */
export const LockedDrawing: FC<{ className?: string }> = ({ className }) => (
  <div
    role="img"
    aria-label="Locked: draw today's prompt first to see it"
    className={cn(
      '@container flex flex-col items-center justify-center gap-1 w-full h-full aspect-square bg-paper border-[1.5px] border-dashed border-line text-pencil text-center select-none',
      className,
    )}
  >
    <LockIcon
      size={40}
      fill="var(--color-butter)"
      className="w-[40%] max-w-12 h-auto -rotate-6 text-ink"
    />
    {/* Too cramped for words in the tiny calendar cells */}
    <span className="hidden @min-[7rem]:block px-2 leading-tight">
      draw first to unlock
    </span>
  </div>
);
