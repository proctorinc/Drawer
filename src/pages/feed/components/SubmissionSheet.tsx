import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { faArrowRight, faHeart } from '@fortawesome/free-solid-svg-icons';
import { faHeart as EmptyHeart } from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PinButton } from './PinButton';
import type { FC } from 'react';
import type { Comment, UserPromptSubmission } from '@/api/Api';
import {
  queryKeys,
  useAddComment,
  usePromptSubmission,
  useToggleCommentReaction,
} from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { Card, CardContent } from '@/components/Card';
import Tooltip from '@/components/Tooltip';
import { useIsDrawingLocked } from '@/daily/useIsDrawingLocked';
import { parseDay } from '@/days';
import DrawingFeedImage from '@/drawing/components/DrawingFeedImage';
import { ShareButton } from '@/pages/profile/components/friends/ShareButton';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { ReactionBar } from '@/reactions/ReactionBar';
import { cn, timeAgo } from '@/utils';

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
  const addComment = useAddComment();
  const [newComment, setNewComment] = useState('');

  function hasReacted(comment: Comment) {
    return comment.reactions.some(
      (reaction) => reaction.user.id === currentUser.id,
    );
  }

  function heartComment(comment: Comment) {
    toggleReaction.mutate(
      {
        submissionId: submission.id,
        commentId: comment.id,
        reactionId: 'heart',
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.promptSubmission(submission.id),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.activityFeed,
          });
        },
      },
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full px-2 animate-drop [--tilt:-1deg] -rotate-1">
        <span
          aria-hidden="true"
          className="absolute z-10 -top-2.5 left-1/2 -ml-10 w-20 h-6 bg-butter/70 rotate-3"
        />
        <div className="p-3 bg-white shadow-[1px_3px_10px_rgba(43,42,51,0.2)]">
          <DrawingFeedImage
            submission={submission}
            className="border-0 rounded-none shadow-none"
          />
          {/* Pin and reactions sit on the polaroid's bottom strip, as on the feed */}
          <div className="flex items-center gap-1.5 mt-3">
            {submission.user.id === currentUser.id && (
              <PinButton submission={submission} />
            )}
            <ReactionBar submission={submission} className="min-h-8" />
          </div>
        </div>
      </div>
      <div className="flex justify-between gap-2 w-full items-center">
        <div className="w-full font-bold">
          <h2 className="font-accent font-bold text-[30px] leading-none text-balance">
            {submission.prompt}
          </h2>
          <p className="text-secondary">
            {parseDay(submission.day).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <ShareButton
          imageUrl={
            isDrawingLocked(submission) ? undefined : submission.imageUrl
          }
          text={`Checkout ${submission.user.id === currentUser.id ? 'my' : `${submission.user.username}'s`} doodle of ${submission.prompt.toLowerCase()}!`}
        ></ShareButton>
      </div>
      <div className="flex flex-col w-full gap-4">
        <Card>
          <CardContent className="gap-2">
            {submission.comments.length === 0 && (
              <span className="font-bold text-center text-secondary">
                Be the first to comment!
              </span>
            )}
            {submission.comments.length > 0 &&
              submission.comments.map((comment) => {
                const activeHeart = hasReacted(comment);

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
                        {comment.text}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <span className="text-xs text-secondary ml-2 whitespace-nowrap">
                          {timeAgo(comment.createdAt)}
                        </span>
                        {comment.user.id !== currentUser.id && (
                          <button onClick={() => heartComment(comment)}>
                            <FontAwesomeIcon
                              className={cn(activeHeart && 'text-red-400')}
                              icon={activeHeart ? faHeart : EmptyHeart}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                    {comment.reactions.length > 0 && (
                      <Tooltip
                        location="bottom"
                        show={comment.reactions.length > 1}
                        content={
                          <div className="flex flex-col w-full text-sm text-center">
                            {comment.reactions.map((reaction) => (
                              <div className="flex gap-2 items-center">
                                <FontAwesomeIcon
                                  icon={faHeart}
                                  className="text-red-400"
                                />
                                <span>
                                  {reaction.user.id === currentUser.id
                                    ? 'you'
                                    : reaction.user.username}
                                </span>
                              </div>
                            ))}
                          </div>
                        }
                      >
                        <div className="flex align-right w-full pr-2">
                          <h3 className="w-fit text-xs font-semibold text-secondary whitespace-nowrap">
                            Loved by{' '}
                            {comment.reactions[0].user.id === currentUser.id
                              ? 'you'
                              : comment.reactions[0].user.username}{' '}
                            {comment.reactions.length > 1 &&
                              `+ ${comment.reactions.length - 1} more`}
                          </h3>
                        </div>
                      </Tooltip>
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
