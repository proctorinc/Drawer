import type { FC } from 'react';
import { cn } from '@/utils';

/** What something is worth, as a little sticker like the feed's judge score */
const XPSticker: FC<{ xp: number; className?: string }> = ({
  xp,
  className,
}) => (
  <span
    className={cn(
      'shrink-0 inline-flex items-baseline gap-0.5 px-1.5 py-0.5 -rotate-6 rounded-sketch-alt border-2 border-ink bg-me font-accent font-bold leading-none whitespace-nowrap',
      className,
    )}
    aria-label={`worth ${xp} XP`}
  >
    <span className="text-base">+{xp}</span>
    <span className="text-xs text-pencil">XP</span>
  </span>
);

export default XPSticker;
