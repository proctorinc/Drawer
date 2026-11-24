import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getReaction } from './catalog';
import { ReactionDrawer } from './ReactionDrawer';
import { ReactionSticker } from './ReactionSticker';
import type { FC } from 'react';
import type { Reaction, ReactionId, UserPromptSubmission } from '@/api/Api';
import { queryKeys, useToggleSubmissionReaction } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { HeartIcon } from '@/components/icons';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';
import { refreshProgress } from '@/animations/useProgressWatcher';
import { reactionPop } from '@/sound/sfx';

// Stickers lean their own way, like they were slapped on by hand
const TILTS = ['-rotate-6', 'rotate-3', '-rotate-2', 'rotate-6', '-rotate-3'];
const STICKER_SIZE = 40;

const pressableClass =
  'cursor-pointer transition-[rotate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 hover:scale-110 active:scale-90';

/** Yours first so you can find and change them, then everyone else's, oldest first */
function inOrder(reactions: Array<Reaction>, myId: string) {
  const sorted = [...reactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return [
    ...sorted.filter((reaction) => reaction.user.id === myId),
    ...sorted.filter((reaction) => reaction.user.id !== myId),
  ];
}

type Props = {
  submission: UserPromptSubmission;
  className?: string;
};

/**
 * Every reaction a doodle has, one sticker each with its reactor's face on
 * the corner. Tap one of yours to take it back; the heart adds another (you
 * can't react to your own)
 */
export const ReactionBar: FC<Props> = ({ submission, className }) => {
  const user = useUser();
  const queryClient = useQueryClient();
  const toggleReaction = useToggleSubmissionReaction();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canReact = submission.user.id !== user.id;
  const picked = new Set(
    submission.reactions
      .filter((reaction) => reaction.user.id === user.id)
      .map((reaction) => reaction.reactionId),
  );

  function toggle(reactionId: ReactionId) {
    // Each sticker pops at its own pitch; taking one back is a softer pop
    let pitch = 0;
    for (const char of reactionId) pitch += char.charCodeAt(0);
    reactionPop(pitch % 7, !picked.has(reactionId));
    toggleReaction.mutate(
      { submissionId: submission.id, reactionId },
      {
        onSuccess: () => {
          for (const queryKey of [
            queryKeys.daily,
            queryKeys.myProfile,
            queryKeys.activityFeed,
            queryKeys.promptSubmission(submission.id),
          ]) {
            queryClient.invalidateQueries({ queryKey });
          }
          refreshProgress(queryClient);
        },
      },
    );
  }

  const reactions = inOrder(submission.reactions, user.id);
  if (reactions.length === 0 && !canReact) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      {reactions.map((reaction, index) => {
        const mine = reaction.user.id === user.id;
        const { label } = getReaction(reaction.reactionId);
        const sticker = (
          <ReactionSticker
            reactionId={reaction.reactionId}
            size={STICKER_SIZE}
            className={cn('animate-pop', TILTS[index % TILTS.length])}
          />
        );
        return (
          <div key={reaction.id} className="relative flex-none">
            {mine ? (
              <button
                type="button"
                aria-label={`Take back your ${label}`}
                onClick={() => toggle(reaction.reactionId)}
                className={cn('block', pressableClass)}
              >
                {sticker}
              </button>
            ) : (
              <span
                role="img"
                aria-label={`${label} from ${reaction.user.username}`}
                className="block"
              >
                {sticker}
              </span>
            )}
            <UserProfileIcon
              user={reaction.user}
              size="xs"
              showLevel={false}
              className="absolute -bottom-1.5 -right-2"
            />
          </div>
        );
      })}
      {canReact && (
        <button
          type="button"
          aria-label="Add a reaction"
          aria-haspopup="dialog"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            'flex-none flex items-center justify-center size-10 rounded-full border-[1.5px] border-dashed border-ink bg-white text-pencil hover:text-ink',
            pressableClass,
          )}
        >
          <HeartIcon size={18} strokeWidth={2.2} />
        </button>
      )}
      {canReact && (
        <ReactionDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          reactions={submission.reactions}
          counts={submission.counts}
          onToggle={toggle}
        />
      )}
    </div>
  );
};
