import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { PinButton } from './PinButton';
import { XPNote } from './XPNote';
import type { FC } from 'react';
import type { Comment, ReactionId, UserPromptSubmission } from '@/api/Api';
import { refreshProgress } from '@/animations/useProgressWatcher';
import { AIReviewComment, ScoreSticker } from '@/ai/AIReviewComment';
import {
  queryKeys,
  useAddComment,
  useDeleteComment,
  usePromptSubmission,
  useToggleCommentReaction,
} from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { useAlert, useConfirm } from '@/components/Confirm';
import { HeartIcon, TrashIcon } from '@/components/icons';
import { ReactionDrawer } from '@/reactions/ReactionDrawer';
import { ReactionPile } from '@/reactions/ReactionPile';
import { ReactionSticker } from '@/reactions/ReactionSticker';
import { PIN_COLORS, PushPin } from '@/components/PushPin';
import { Card, CardContent } from '@/components/Card';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { parseDay } from '@/days';
import DrawingFeedImage from '@/drawing/components/DrawingFeedImage';
import { ShareButton } from '@/pages/profile/components/friends/ShareButton';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { ReactionBar } from '@/reactions/ReactionBar';
import { bigPolaroidFrameClass } from '@/components/polaroid';
import { cn, timeAgo } from '@/utils';
import { GoldTrim, goldFrameClass, isMasterpiece } from '@/ai/Masterpiece';
import { CleanText } from '@/moderation/CleanText';

/** A pin color that varies page to page but stays put for a given doodle */
function pinColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PIN_COLORS[Math.abs(hash) % PIN_COLORS.length];
}

type Props = {
  /** The feed's copy shows straight away; the full doodle loads over it */
  doodle: UserPromptSubmission;
};

/** One doodle's whole page: the pinned polaroid, its prompt and the comments */
const SubmissionSheet: FC<Props> = ({ doodle }) => {
  const navigate = useNavigate();
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const toggleReaction = useToggleCommentReaction();
  const isDrawingLocked = useIsDrawingLocked();
  const { data: submission = doodle } = usePromptSubmission(doodle.id, doodle);
  // A perfect 10 is framed in gold, once you can see it
  const golden = !isDrawingLocked(submission) && isMasterpiece(submission);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const confirm = useConfirm();
  const alert = useAlert();
  const [newComment, setNewComment] = useState('');

  // The comment whose reaction drawer is open, if any
  const [reactingTo, setReactingTo] = useState<Comment | null>(null);

  function myReaction(comment: Comment) {
    return comment.reactions.find(
      (reaction) => reaction.user.id === currentUser.id,
    )?.reactionId;
  }

  function reactToComment(comment: Comment, reactionId: ReactionId) {
    toggleReaction.mutate(
      {
        submissionId: submission.id,
        commentId: comment.id,
        reactionId,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.promptSubmission(submission.id),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.activityFeed,
          });
          refreshProgress(queryClient);
        },
      },
    );
  }

  async function removeComment(comment: Comment) {
    const ok = await confirm({
      title: 'delete your comment?',
      message: "it can't be undone.",
      confirmLabel: 'delete',
      cancelLabel: 'keep it',
    });
    if (!ok) return;
    deleteComment.mutate(
      { submissionId: submission.id, commentId: comment.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.promptSubmission(submission.id),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
          queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed });
          refreshProgress(queryClient);
        },
        onError: (err) =>
          alert({ title: "couldn't delete that", message: err.message }),
      },
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full px-2 animate-drop [--tilt:-1deg] -rotate-1">
        <PushPin
          color={pinColor(submission.id)}
          size={40}
          className="absolute z-10 -top-[30px] left-1/2 -ml-5"
        />
        <div
          className={cn(
            'relative p-3',
            golden ? goldFrameClass : bigPolaroidFrameClass,
          )}
        >
          {golden && <GoldTrim size="lg" label />}
          <div className="relative">
            <DrawingFeedImage
              submission={submission}
              showAvatar={false}
              className="border-0 rounded-none shadow-none"
            />
            {/* The AI judge's score, slapped on the photo's top-left corner */}
            {!isDrawingLocked(submission) &&
              submission.aiReview?.score != null && (
                <ScoreSticker
                  score={submission.aiReview.score}
                  mine={submission.user.id === currentUser.id}
                  className="absolute z-10 -top-6 -left-6 pointer-events-none"
                />
              )}
            {/* As on the wall, starring your own sits on the photo's corner */}
            {submission.user.id === currentUser.id && (
              <PinButton submission={submission} variant="corner" />
            )}
          </div>
          {/* Whose it is, what it was meant to be and when */}
          <div className="flex items-center gap-3 mt-3">
            <UserProfileIcon
              user={submission.user}
              size="sm"
              className="flex-none"
            />
            <div className="flex-1 min-w-0">
              <h2 className="font-accent font-bold text-[26px] leading-none text-balance">
                {submission.prompt}
              </h2>
              <p className="text-sm text-pencil">
                {parseDay(submission.day).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <ShareButton
              className="flex-none"
              imageUrl={
                isDrawingLocked(submission) ? undefined : submission.imageUrl
              }
              text={`Checkout ${submission.user.id === currentUser.id ? 'my' : `${submission.user.username}'s`} doodle of ${submission.prompt.toLowerCase()}!`}
            />
          </div>
        </div>
        {submission.user.id === currentUser.id && (
          <XPNote submission={submission} className="mt-4" />
        )}
      </div>
      {/* Just the reactions, each with its reactor's face on the corner */}
      <ReactionBar submission={submission} className="w-full px-2" />
      <ReactionDrawer
        title="react to comment"
        open={!!reactingTo}
        onClose={() => setReactingTo(null)}
        reactions={reactingTo?.reactions ?? []}
        counts={reactingTo?.counts ?? []}
        onToggle={(id) => reactingTo && reactToComment(reactingTo, id)}
      />
      <div className="flex flex-col w-full gap-4">
        <Card>
          <CardContent className="gap-2">
            {/* The AI judge's verdict leads the comments */}
            {submission.aiReview && (
              <AIReviewComment
                review={submission.aiReview}
                mine={submission.user.id === currentUser.id}
              />
            )}
            {submission.comments.length === 0 && !submission.aiReview && (
              <span className="font-bold text-center text-secondary">
                Be the first to comment!
              </span>
            )}
            {submission.comments.length > 0 &&
              submission.comments.map((comment) => {
                const mine = myReaction(comment);

                return (
                  <div key={comment.id} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center font-semibold">
                      <div className="flex gap-4 items-center">
                        <UserProfileIcon
                          size="sm"
                          user={comment.user}
                          onClick={() =>
                            navigate({
                              to: `/draw/profile/${comment.user.id}`,
                            })
                          }
                        />{' '}
                        <CleanText text={comment.text} />
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <span className="text-xs text-secondary ml-2 whitespace-nowrap">
                          {timeAgo(comment.createdAt)}
                        </span>
                        {comment.user.id === currentUser.id && (
                          <button
                            type="button"
                            aria-label="Delete your comment"
                            disabled={deleteComment.isPending}
                            onClick={() => removeComment(comment)}
                            className="grid place-items-center size-7 cursor-pointer text-pencil transition-[scale,color] duration-300 ease-[var(--ease-spring)] hover:scale-110 hover:text-ink active:scale-90 disabled:opacity-50"
                          >
                            <TrashIcon size={18} />
                          </button>
                        )}
                        {comment.user.id !== currentUser.id && (
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-label={
                              mine ? 'Change your reaction' : 'React to comment'
                            }
                            onClick={() => setReactingTo(comment)}
                            className="grid place-items-center size-7 cursor-pointer transition-[scale] duration-300 ease-[var(--ease-spring)] hover:scale-110 active:scale-90"
                          >
                            {mine ? (
                              <ReactionSticker reactionId={mine} size={22} />
                            ) : (
                              <HeartIcon size={16} strokeWidth={2.2} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {comment.counts.length > 0 && (
                      <ReactionPile
                        counts={comment.counts}
                        size={20}
                        className="self-end pr-1"
                      />
                    )}
                  </div>
                );
              })}
            <form
              className="flex gap-2 pt-4 items-center"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newComment.trim()) return;
                try {
                  await addComment.mutateAsync(
                    {
                      submissionId: submission.id,
                      text: newComment,
                    },
                    {
                      onSuccess: () => {
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.myProfile,
                        });
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.promptSubmission(submission.id),
                        });
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.activityFeed,
                        });
                        refreshProgress(queryClient);
                      },
                    },
                  );
                  setNewComment('');
                } catch (err) {
                  // Optionally show error
                }
              }}
            >
              <input
                className="w-full h-12 px-3 bg-white border-2 border-ink rounded-sketch-alt text-lg placeholder:text-pencil/70 focus:outline-none focus:-rotate-1 transition-[rotate] duration-300"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button
                className="h-full"
                size="sm"
                icon={faArrowRight}
                type="submit"
                disabled={!newComment.trim()}
              ></Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <div className="text-left w-full -mt-4">
        <span className="text-xs font-semibold text-secondary pl-2">
          Drawn by {submission.user.username} at{' '}
          {new Date(submission.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
};

export default SubmissionSheet;
