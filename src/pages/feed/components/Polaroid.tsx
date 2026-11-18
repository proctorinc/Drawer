import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { CSSProperties, FC } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import {
  queryKeys,
  useToggleSubmissionFavorite,
  useToggleSubmissionReaction,
} from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { LockedDrawing } from '@/drawing/components/LockedDrawing';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { CommentIcon, HeartIcon, StarIcon } from '@/components/icons';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn, tapeColor } from '@/utils';

// Repeating per-card variety, so the wall looks hand-pinned rather than gridded
const TILTS = [-2, 1.8, 1, -1.4, 2, -0.8];
const TAPES = ['#ffb400', '#3a7bd5', '#ff6b57'];

const pillClass =
  'inline-flex items-center gap-1 h-7 px-2 border-[1.5px] border-ink rounded-[12px_9px_12px_10px] text-[15px] cursor-pointer transition-[scale,background-color] duration-300 ease-[var(--ease-spring)] active:scale-90';

type Props = {
  submission: UserPromptSubmission;
  index: number;
};

const Polaroid: FC<Props> = ({ submission, index }) => {
  const user = useUser();
  const queryClient = useQueryClient();
  const toggleReaction = useToggleSubmissionReaction();
  const toggleFavorite = useToggleSubmissionFavorite();
  const isLocked = useIsDrawingLocked()(submission);
  // Bumped on tap to replay the pop on the icon
  const [popKey, setPopKey] = useState(0);

  const isMine = submission.user.id === user.id;
  const hasHearted = submission.reactions.some(
    (reaction) =>
      reaction.user.id === user.id && reaction.reactionId === 'heart',
  );
  const reactionCount = submission.counts.reduce(
    (sum, reaction) => sum + reaction.count,
    0,
  );
  // Counts come most-picked first
  const topReactions = submission.counts.slice(0, 2);
  const tilt = TILTS[index % TILTS.length];

  function refresh() {
    for (const queryKey of [
      queryKeys.myProfile,
      queryKeys.activityFeed,
      queryKeys.promptSubmission(submission.id),
    ]) {
      queryClient.invalidateQueries({ queryKey });
    }
  }

  function handleReact() {
    setPopKey((key) => key + 1);
    if (isMine) {
      toggleFavorite.mutate(submission.id, { onSuccess: refresh });
    } else {
      toggleReaction.mutate(
        { submissionId: submission.id, reactionId: 'heart' },
        { onSuccess: refresh },
      );
    }
  }

  const isLit = isMine ? submission.isFavorite : hasHearted;
  const Icon = isMine ? StarIcon : HeartIcon;

  return (
    <figure
      className={cn(
        'relative m-0 p-2 pb-0 bg-white shadow-[1px_2px_6px_rgba(43,42,51,0.18)] animate-drop rotate-[var(--tilt)] transition-[rotate,translate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 hover:-translate-y-1 hover:scale-[1.03]',
        index % 2 === 1 && 'mt-3',
      )}
      style={
        {
          '--tilt': `${tilt}deg`,
          '--tilt-from': `${tilt * 4}deg`,
          animationDelay: `${index * 90}ms`,
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className="absolute z-10 -top-2.5 left-1/2 -ml-7 w-14 h-[18px] rotate-3"
        style={{ backgroundColor: tapeColor(TAPES[index % TAPES.length]) }}
      />
      {/* Whose doodle it is, pinned to the corner so you can tell at a glance */}
      <UserProfileIcon
        user={submission.user}
        size="sm"
        className="absolute z-10 -top-3 -left-3 -rotate-6 rounded-full shadow-pencil-sm"
      />
      <Link
        to="/draw/submission/$submissionId"
        params={{ submissionId: submission.id }}
        aria-label={`Open ${isMine ? 'your' : `${submission.user.username}'s`} doodle`}
        className="block aspect-square bg-[#fff8ec] overflow-hidden"
      >
        {isLocked ? (
          <LockedDrawing />
        ) : (
          <DrawingImage imageUrl={submission.imageUrl} draggable={false} />
        )}
      </Link>
      <figcaption className="flex flex-col gap-1 pt-1.5 pb-2">
        <span className="text-lg leading-tight truncate">
          {isMine ? 'you' : submission.user.username}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleReact}
            aria-pressed={!!isLit}
            aria-label={
              isMine
                ? isLit
                  ? 'Unpin from your book'
                  : 'Pin to your book'
                : isLit
                  ? 'Take back your love'
                  : 'Love it'
            }
            className={cn(
              pillClass,
              isLit ? (isMine ? 'bg-butter' : 'bg-blush') : 'bg-white',
            )}
          >
            <Icon
              key={popKey}
              size={14}
              strokeWidth={2.2}
              fill={
                isLit ? (isMine ? '#ffb400' : 'var(--color-coral)') : undefined
              }
              className={cn(popKey > 0 && 'animate-pop')}
            />
          </button>
          {reactionCount > 0 && (
            <Link
              to="/draw/submission/$submissionId"
              params={{ submissionId: submission.id }}
              aria-label={`${reactionCount} ${reactionCount === 1 ? 'reaction' : 'reactions'}`}
              className={cn(pillClass, 'gap-0 pl-1 bg-white')}
            >
              {topReactions.map(({ reactionId }, i) => (
                <ReactionSticker
                  key={reactionId}
                  reactionId={reactionId}
                  size={20}
                  className={cn(i > 0 && '-ml-2 rotate-12')}
                />
              ))}
              <span className="ml-0.5">{reactionCount}</span>
            </Link>
          )}
          <Link
            to="/draw/submission/$submissionId"
            params={{ submissionId: submission.id }}
            aria-label={`${submission.comments.length} comments`}
            className={cn(pillClass, 'bg-white')}
          >
            <CommentIcon size={14} strokeWidth={2.2} />
            {submission.comments.length}
          </Link>
        </div>
      </figcaption>
    </figure>
  );
};

export default Polaroid;
