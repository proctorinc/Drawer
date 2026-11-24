import { Link } from '@tanstack/react-router';
import { pillClass } from './PinButton';
import type { CSSProperties, FC } from 'react';
import type { UserPromptSubmission } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { LockedDrawing } from '@/drawing/components/LockedDrawing';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { CommentIcon } from '@/components/icons';
import { ReactionScatter } from '@/reactions/ReactionScatter';
import { SignatureMark } from '@/signature/Signature';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { PIN_COLORS, PushPin } from '@/components/PushPin';
import { polaroidFrameClass } from '@/components/polaroid';
import { cn } from '@/utils';
import { GoldTrim, goldFrameClass, isMasterpiece } from '@/ai/Masterpiece';
import { ScoreSticker, judgeFace } from '@/ai/AIReviewComment';

// Repeating per-card variety, so the wall looks hand-pinned rather than gridded
const TILTS = [-2, 1.8, 1, -1.4, 2, -0.8];

type Props = {
  submission: UserPromptSubmission;
  index: number;
  /** Christmas event: hangs from a clothespin and swings */
  festive?: boolean;
  /** The artist's signature path, signed in the drawing's bottom corner */
  signature?: string;
};

const Polaroid: FC<Props> = ({
  submission,
  index,
  festive = false,
  signature,
}) => {
  const user = useUser();
  const isLocked = useIsDrawingLocked()(submission);
  const isMine = submission.user.id === user.id;
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

  return (
    <div className={cn('self-start', index % 2 === 1 && 'mt-3')}>
      <figure
        className={cn(
          'relative m-0 p-2 pb-0 animate-drop rotate-[var(--tilt)] transition-[rotate,translate,scale] duration-300 ease-[var(--ease-spring)] hover:rotate-0 hover:-translate-y-1 hover:scale-[1.03]',
          golden ? goldFrameClass : polaroidFrameClass,
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
            aria-label={`Open ${isMine ? 'your' : `${submission.user.username}'s`} doodle${reactionCount > 0 ? `, ${reactionCount} ${reactionCount === 1 ? 'reaction' : 'reactions'}` : ''}`}
            className="relative block aspect-square bg-[#fff8ec] overflow-hidden"
          >
            {isLocked ? (
              <LockedDrawing />
            ) : (
              <>
                <DrawingImage
                  imageUrl={submission.imageUrl}
                  draggable={false}
                />
                {signature && (
                  <SignatureMark
                    path={signature}
                    className="absolute bottom-0.5 right-1 w-2/5 -rotate-3 pointer-events-none"
                  />
                )}
              </>
            )}
          </Link>
          {/* The AI judge's score, slapped on the photo's other corner */}
          {!isLocked && submission.aiReview?.score != null && (
            <ScoreSticker
              score={submission.aiReview.score}
              mine={isMine}
              face={judgeFace(submission.aiReview.judge)}
              className="absolute z-10 -top-5 -left-5 scale-75 origin-top-left pointer-events-none"
            />
          )}
          {/* Reactions stuck all around the photo's border, most-picked first */}
          <ReactionScatter counts={submission.counts} seed={index} />
        </div>
        {/* One line: whose it is and the way into the comments */}
        <figcaption className="flex items-center gap-1.5 pt-2 pb-2">
          <UserProfileIcon
            user={submission.user}
            size="sm"
            className="flex-none"
          />
          {/* Pinned the next day: the prompt rolled over mid-doodle */}
          {(submission.late || submission.redo) && (
            <span className="ml-auto text-xs leading-none text-pencil">
              {submission.redo ? 'redo' : 'late'}
            </span>
          )}
          <Link
            to="/draw/submission/$submissionId"
            params={{ submissionId: submission.id }}
            aria-label={`${commentCount} comments`}
            className={cn(
              pillClass,
              'flex-none bg-white',
              !submission.late && !submission.redo && 'ml-auto',
            )}
          >
            <CommentIcon size={14} strokeWidth={2.2} />
            {commentCount > 0 && commentCount}
          </Link>
        </figcaption>
      </figure>
    </div>
  );
};

export default Polaroid;
