import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PinButton, cornerButtonClass, pillClass } from './PinButton';
import type { CSSProperties, FC } from 'react';
import type { ReactionId, UserPromptSubmission } from '@/api/Api';
import { queryKeys, useToggleSubmissionReaction } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { LockedDrawing } from '@/drawing/components/LockedDrawing';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { CommentIcon, HeartIcon } from '@/components/icons';
import { ReactionDrawer } from '@/reactions/ReactionDrawer';
import { ReactionPile } from '@/reactions/ReactionPile';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { PIN_COLORS, PushPin } from '@/components/PushPin';
import { polaroidFrameClass } from '@/components/polaroid';
import { cn } from '@/utils';
import { GoldTrim, goldFrameClass, isMasterpiece } from '@/ai/Masterpiece';
import { ScoreSticker } from '@/ai/AIReviewComment';

// Repeating per-card variety, so the wall looks hand-pinned rather than gridded
const TILTS = [-2, 1.8, 1, -1.4, 2, -0.8];

type Props = {
  submission: UserPromptSubmission;
  index: number;
  /** Christmas event: hangs from a clothespin and swings */
  festive?: boolean;
};

const Polaroid: FC<Props> = ({ submission, index, festive = false }) => {
  const user = useUser();
  const queryClient = useQueryClient();
  const toggleReaction = useToggleSubmissionReaction();
  const isLocked = useIsDrawingLocked()(submission);
  // Bumped on each pick to replay the pop on the corner button
  const [popKey, setPopKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMine = submission.user.id === user.id;
  // Your own reaction, if you've left one, stands in for the heart
  const myReaction = submission.reactions.find(
    (reaction) => reaction.user.id === user.id,
  )?.reactionId;
  const reactionCount = submission.counts.reduce(
    (sum, reaction) => sum + reaction.count,
    0,
  );
  // The AI judge's verdict counts as a comment once it's written
  const commentCount =
    submission.comments.length +
    (submission.aiReview?.status === 'done' ? 1 : 0);
  const tilt = TILTS[index % TILTS.length];
  // A perfect 10 is framed in gold, once you can see it
  const golden = !isLocked && isMasterpiece(submission);

  function refresh() {
    for (const queryKey of [
      queryKeys.daily,
      queryKeys.myProfile,
      queryKeys.activityFeed,
      queryKeys.promptSubmission(submission.id),
    ]) {
      queryClient.invalidateQueries({ queryKey });
    }
  }

  function toggle(reactionId: ReactionId) {
    setPopKey((key) => key + 1);
    toggleReaction.mutate(
      { submissionId: submission.id, reactionId },
      { onSuccess: refresh },
    );
  }

  return (
    <figure
      className={cn(
        'relative m-0 p-2 pb-0 animate-drop rotate-[var(--tilt)] transition-[rotate,translate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 hover:-translate-y-1 hover:scale-[1.03]',
        golden ? goldFrameClass : polaroidFrameClass,
        index % 2 === 1 && 'mt-3',
        festive && 'origin-top',
      )}
      style={
        {
          '--tilt': `${tilt}deg`,
          '--tilt-from': `${tilt * 4}deg`,
          '--swing': `${tilt}deg`,
          animationDelay: `${index * 90}ms`,
          // Hung from the lights: drop in, then rock gently on the clothespin
          ...(festive && {
            animation: `drop 0.6s var(--ease-spring) ${index * 90}ms backwards, swing 3.2s ease-in-out ${600 + index * 90}ms infinite`,
          }),
        } as CSSProperties
      }
    >
      {golden && <GoldTrim size="md" />}
      {festive ? (
        <span
          aria-hidden="true"
          className="absolute z-10 -top-3 left-1/2 -ml-[5px] w-2.5 h-[22px] bg-[#c99060] border-[1.5px] border-ink rounded-[3px]"
        />
      ) : (
        <PushPin
          color={PIN_COLORS[index % PIN_COLORS.length]}
          lean={index % 2 === 0 ? 20 : -16}
          className="absolute z-10 -top-[23px] left-1/2 -ml-4"
        />
      )}
      <div className="relative">
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
        {/* The AI judge's score, slapped on the photo's other corner */}
        {!isLocked && submission.aiReview?.score != null && (
          <ScoreSticker
            score={submission.aiReview.score}
            className="absolute z-10 -top-5 -left-5 scale-75 origin-top-left pointer-events-none"
          />
        )}
        {/* Star your own, love a friend's: right on the photo's corner */}
        {isMine ? (
          <PinButton submission={submission} variant="corner" />
        ) : (
          <>
            <button
              onClick={() => setDrawerOpen(true)}
              aria-haspopup="dialog"
              aria-label={myReaction ? 'Change your reaction' : 'React'}
              className={cn(
                cornerButtonClass,
                myReaction ? 'bg-blush' : 'bg-white',
              )}
            >
              {myReaction ? (
                <ReactionSticker
                  key={popKey}
                  reactionId={myReaction}
                  size={22}
                  className={cn(popKey > 0 && 'animate-pop')}
                />
              ) : (
                <HeartIcon size={16} strokeWidth={2.2} />
              )}
            </button>
            <ReactionDrawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              reactions={submission.reactions}
              counts={submission.counts}
              onToggle={toggle}
            />
          </>
        )}
      </div>
      {/* One line: whose it is, its reactions, and the way into the comments */}
      <figcaption className="flex items-center gap-1.5 pt-2 pb-2">
        <UserProfileIcon
          user={submission.user}
          size="sm"
          className="flex-none"
        />
        {reactionCount > 0 && (
          <Link
            to="/draw/submission/$submissionId"
            params={{ submissionId: submission.id }}
            aria-label={`${reactionCount} ${reactionCount === 1 ? 'reaction' : 'reactions'}`}
            className="flex flex-1 min-w-0 transition-[scale] duration-300 ease-[var(--ease-spring)] active:scale-90"
          >
            <ReactionPile counts={submission.counts} className="flex-1" />
          </Link>
        )}
        <Link
          to="/draw/submission/$submissionId"
          params={{ submissionId: submission.id }}
          aria-label={`${commentCount} comments`}
          className={cn(pillClass, 'ml-auto flex-none bg-white')}
        >
          <CommentIcon size={14} strokeWidth={2.2} />
          {commentCount > 0 && commentCount}
        </Link>
      </figcaption>
    </figure>
  );
};

export default Polaroid;
