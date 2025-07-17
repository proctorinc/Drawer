import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/Card';
import { UserProfileIcon } from '../profile/components/UserProfileIcon';
import Button from '@/components/Button';
import {
  usePromptSubmission,
  useAddComment,
  queryKeys,
  type Comment,
  useToggleCommentReaction,
} from '@/api/Api';
import Layout from '@/components/Layout';
import { faArrowRight, faHeart } from '@fortawesome/free-solid-svg-icons';
import { cn, timeAgo } from '@/utils';
import { useQueryClient } from '@tanstack/react-query';
import LoadingScreen from '@/components/LoadingScreen';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart as EmptyHeart } from '@fortawesome/free-regular-svg-icons';
import { faHeart as FilledHeart } from '@fortawesome/free-solid-svg-icons';
import DrawingFeedImage from '@/drawing/components/DrawingFeedImage';
import useUser from '@/auth/hooks/useUser';
import { ShareButton } from '../profile/components/friends/ShareButton';
import Tooltip from '@/components/Tooltip';

const PromptSubmissionPage = () => {
  const navigate = useNavigate();
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const { submissionId } = useParams({
    from: '/draw/submission/$submissionId',
  });
  const toggleReaction = useToggleCommentReaction();
  const {
    data: submission,
    isLoading,
    error,
    refetch,
  } = usePromptSubmission(submissionId);
  const addComment = useAddComment();
  const [comment, setComment] = useState('');

  function hasReacted(comment: Comment) {
    return comment.reactions.some(
      (reaction) => reaction.user.id === currentUser.id,
    );
  }

  function heartComment(comment: Comment) {
    if (submission) {
      toggleReaction.mutate(
        {
          submissionId: submission.id,
          commentId: comment.id,
          reactionId: 'heart',
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.promptSubmission(submissionId),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.activityFeed,
            });
          },
        },
      );
    }
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !submission) {
    return (
      <Layout back>
        <h1 className="p-8 text-center text-primary font-bold text-xl">
          I'm sorry, it looks like this doodle doesn't exist
        </h1>
        <Button onClick={() => navigate({ to: '/draw' })}>Go back</Button>
      </Layout>
    );
  }

  return (
    <>
      <Layout
        back
        header={
          <div className="flex flex-col gap-4 w-full pb-6 -mt-6">
            <DrawingFeedImage
              submission={submission}
              className="border-secondary shadow-secondary"
            />
          </div>
        }
      >
        <div className="flex justify-between gap-2 w-full items-center">
          <div className="w-full font-bold">
            <h2 className="text-2xl text-primary">{submission.prompt}</h2>
            <p className="text-secondary">
              {new Date(submission.day).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <ShareButton
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
                                icon={activeHeart ? FilledHeart : EmptyHeart}
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
                            <h3 className="w-fit p-1 text-xs font-semibold text-secondary whitespace-nowrap">
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
                  if (!comment.trim()) return;
                  try {
                    await addComment.mutateAsync(
                      {
                        submissionId,
                        text: comment,
                      },
                      {
                        onSuccess: () => {
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.myProfile,
                          });
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.promptSubmission(submissionId),
                          });
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.activityFeed,
                          });
                        },
                      },
                    );
                    setComment('');
                    refetch();
                  } catch (err) {
                    // Optionally show error
                  }
                }}
              >
                <input
                  className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  className="h-full"
                  size="sm"
                  icon={faArrowRight}
                  type="submit"
                  disabled={!comment.trim()}
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
      </Layout>
    </>
  );
};

export default PromptSubmissionPage;
