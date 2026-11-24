import { Link } from '@tanstack/react-router';
import { useUnfinishedDoodle } from './useUnfinishedDoodle';
import type { FC } from 'react';
import { PencilIcon } from '@/components/icons';
import { cn } from '@/utils';

/**
 * The way back to a doodle the rollover interrupted: today's prompt has taken
 * over the desk, but yesterday's drawing is still on this device and can be
 * pinned until today's rolls over too. Nothing at all otherwise.
 */
export const UnfinishedDoodleButton: FC<{ className?: string }> = ({
  className,
}) => {
  const unfinished = useUnfinishedDoodle();
  if (!unfinished) return null;

  return (
    <Link
      to="/draw/finish"
      className={cn(
        'press inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 bg-[#fff6c9] border-2 border-ink rounded-sketch-alt shadow-pencil-sm text-base leading-none -rotate-1 hover:rotate-0 transition-[rotate] duration-300',
        className,
      )}
    >
      <PencilIcon size={15} className="flex-none" />
      <span className="truncate">
        finish yesterday's{' '}
        <span className="font-accent font-bold">
          {unfinished.prompt.toLowerCase()}
        </span>
      </span>
    </Link>
  );
};
