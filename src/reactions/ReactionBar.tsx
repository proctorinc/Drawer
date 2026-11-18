import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getReaction } from './catalog';
import { ReactionPicker } from './ReactionPicker';
import { ReactionSticker } from './ReactionSticker';
import type { CSSProperties, FC } from 'react';
import type { ReactionId, UserPromptSubmission } from '@/api/Api';
import { queryKeys, useToggleSubmissionReaction } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { PlusIcon } from '@/components/icons';
import { cn } from '@/utils';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  // Bumped on tap to replay the pop on that sticker
  const [popped, setPopped] = useState<{ id: ReactionId; n: number }>();
  const barRef = useRef<HTMLDivElement>(null);

  const canReact = submission.user.id !== user.id;
  const picked = new Set(
    submission.reactions
      .filter((reaction) => reaction.user.id === user.id)
      .map((reaction) => reaction.reactionId),
  );

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOnOutside = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [pickerOpen]);

  function toggle(reactionId: ReactionId) {
    setPopped((prev) => ({ id: reactionId, n: (prev?.n ?? 0) + 1 }));
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

  if (!canReact && submission.counts.length === 0) {
    return (
      <p className={cn('font-cursive text-xl text-pencil', className)}>
        no reactions yet
      </p>
    );
  }

  return (
    <div
      ref={barRef}
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
            {count}
          </Pill>
        );
      })}
      {canReact && (
        <button
          type="button"
          aria-label="Add a reaction"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className={cn(
            pillClass,
            pressableClass,
            PILL_SHAPES[submission.counts.length % PILL_SHAPES.length],
            'px-2 bg-white border-dashed text-pencil hover:text-ink',
            pickerOpen && 'rotate-0 border-solid text-ink bg-butter',
          )}
          style={pillStyle(submission.counts.length)}
        >
          <PlusIcon size={16} strokeWidth={2.4} />
          {submission.counts.length === 0 && (
            <span className="font-cursive font-normal text-xl">react</span>
          )}
        </button>
      )}
      {pickerOpen && (
        <ReactionPicker
          picked={picked}
          onPick={(id) => {
            toggle(id);
            setPickerOpen(false);
          }}
          className="absolute top-full left-0 mt-2"
        />
      )}
    </div>
  );
};
