import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getReaction } from './catalog';
import { ReactionDrawer } from './ReactionDrawer';
import { ReactionSticker } from './ReactionSticker';
import type { CSSProperties, FC } from 'react';
import type { ReactionId, UserPromptSubmission } from '@/api/Api';
import { queryKeys, useToggleSubmissionReaction } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { PlusIcon } from '@/components/icons';
import { cn } from '@/utils';
import { refreshProgress } from '@/animations/useProgressWatcher';
import { reactionPop } from '@/sound/sfx';

// Each pill gets its own wobble and lean, so a row looks drawn one at a time
const PILL_SHAPES = [
  'rounded-[14px_10px_15px_9px/11px_15px_10px_14px]',
  'rounded-[10px_15px_9px_14px/14px_9px_15px_11px]',
  'rounded-[15px_9px_13px_12px/9px_14px_12px_15px]',
];
const PILL_TILTS = [-2, 1.5, -1, 2, -1.5, 1];

const pillClass =
  'inline-flex items-center gap-1 h-8 pl-1.5 pr-2.5 border-[1.5px] border-ink font-accent font-bold text-lg leading-none rotate-[var(--tilt)] transition-[rotate,scale,background-color] duration-300 ease-[var(--ease-spring)]';
const pressableClass =
  'cursor-pointer hover:rotate-0 hover:scale-110 active:scale-90';

const pillStyle = (index: number) =>
  ({
    '--tilt': `${PILL_TILTS[index % PILL_TILTS.length]}deg`,
  }) as CSSProperties;

type Props = {
  submission: UserPromptSubmission;
  className?: string;
};

/** One pill per reaction a doodle has, plus a sticker sheet for adding your own (you can't react to your own) */
export const ReactionBar: FC<Props> = ({ submission, className }) => {
  const user = useUser();
  const queryClient = useQueryClient();
  const toggleReaction = useToggleSubmissionReaction();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped on tap to replay the pop on that sticker
  const [popped, setPopped] = useState<{ id: ReactionId; n: number }>();

  const canReact = submission.user.id !== user.id;
  const picked = new Set(
    submission.reactions
      .filter((reaction) => reaction.user.id === user.id)
      .map((reaction) => reaction.reactionId),
  );

  function toggle(reactionId: ReactionId) {
    setPopped((prev) => ({ id: reactionId, n: (prev?.n ?? 0) + 1 }));
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

  /** "Love it: you, alice" */
  function whoReacted(reactionId: ReactionId) {
    const names = submission.reactions
      .filter((reaction) => reaction.reactionId === reactionId)
      .map((reaction) =>
        reaction.user.id === user.id ? 'you' : reaction.user.username,
      );
    return `${getReaction(reactionId).label}: ${names.join(', ')}`;
  }

  // Nothing to show or do: keep the space, say nothing
  if (!canReact && submission.counts.length === 0) {
    return <div className={className} />;
  }

  return (
    <div
      className={cn('relative flex flex-wrap items-center gap-1.5', className)}
    >
      {submission.counts.map(({ reactionId, count }, index) => {
        const { tint } = getReaction(reactionId);
        const isPicked = picked.has(reactionId);
        const Pill = canReact ? 'button' : 'span';
        return (
          <Pill
            key={reactionId}
            title={whoReacted(reactionId)}
            {...(canReact && {
              type: 'button',
              'aria-pressed': isPicked,
              onClick: () => toggle(reactionId),
            })}
            className={cn(
              pillClass,
              PILL_SHAPES[index % PILL_SHAPES.length],
              canReact && pressableClass,
              isPicked && 'border-2 shadow-pencil-sm',
              // Without a count the pill hugs its sticker
              count <= 1 && 'pr-1.5',
            )}
            style={{
              ...pillStyle(index),
              // Yours in full color, everyone else's washed out
              backgroundColor: isPicked
                ? tint
                : `color-mix(in srgb, ${tint} 45%, white)`,
            }}
          >
            <ReactionSticker
              key={popped?.id === reactionId ? popped.n : 0}
              reactionId={reactionId}
              size={22}
              className={cn(popped?.id === reactionId && 'animate-pop')}
            />
            {/* Only worth saying when more than one person picked it */}
            {count > 1 && `×${count}`}
          </Pill>
        );
      })}
      {canReact && (
        <button
          type="button"
          aria-label="Add a reaction"
          aria-haspopup="dialog"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            pillClass,
            pressableClass,
            PILL_SHAPES[submission.counts.length % PILL_SHAPES.length],
            'px-2 bg-white border-dashed text-pencil hover:text-ink',
          )}
          style={pillStyle(submission.counts.length)}
        >
          <PlusIcon size={16} strokeWidth={2.4} />
          {submission.counts.length === 0 && (
            <span className="font-cursive font-normal text-xl">react</span>
          )}
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
