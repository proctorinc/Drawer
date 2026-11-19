import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FC } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import { queryKeys, useToggleSubmissionFavorite } from '@/api/Api';
import { StarIcon } from '@/components/icons';
import { cn } from '@/utils';

export const pillClass =
  'inline-flex items-center gap-1 h-7 px-2 border-[1.5px] border-ink rounded-[12px_9px_12px_10px] text-[15px] cursor-pointer transition-[scale,background-color] duration-300 ease-[var(--ease-spring)] active:scale-90';

type Props = {
  /** One of your own doodles */
  submission: UserPromptSubmission;
};

/** The star pill that pins your own doodle to your book */
export const PinButton: FC<Props> = ({ submission }) => {
  const queryClient = useQueryClient();
  const toggleFavorite = useToggleSubmissionFavorite();
  // Bumped on tap to replay the pop on the star
  const [popKey, setPopKey] = useState(0);
  const isPinned = !!submission.isFavorite;

  function handleClick() {
    setPopKey((key) => key + 1);
    toggleFavorite.mutate(submission.id, {
      onSuccess: () => {
        for (const queryKey of [
          queryKeys.daily,
          queryKeys.myProfile,
          queryKeys.activityFeed,
          queryKeys.promptSubmission(submission.id),
        ]) {
          queryClient.invalidateQueries({ queryKey });
        }
      },
    });
  }

  return (
    <button
      onClick={handleClick}
      aria-pressed={isPinned}
      aria-label={isPinned ? 'Unpin from your book' : 'Pin to your book'}
      className={cn(pillClass, isPinned ? 'bg-butter' : 'bg-white')}
    >
      <StarIcon
        key={popKey}
        size={14}
        strokeWidth={2.2}
        fill={isPinned ? '#ffb400' : undefined}
        className={cn(popKey > 0 && 'animate-pop')}
      />
    </button>
  );
};
