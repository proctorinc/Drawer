import { useState } from 'react';
import { useParams, useRouter } from '@tanstack/react-router';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { Card, CardContent } from '@/components/Card';
import { UserProfileIcon } from '../profile/components/UserProfileIcon';
import Button from '@/components/Button';
import { usePromptSubmission, useAddComment, queryKeys } from '@/api/Api';
import Layout from '@/components/Layout';
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { timeAgo } from '@/utils';
import { useQueryClient } from '@tanstack/react-query';
import LoadingScreen from '@/components/LoadingScreen';

const PromptSubmissionPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { submissionId } = useParams({ strict: false }) as {
    submissionId: string;
  };
  const {
    data: submission,
    isLoading,
    error,
    refetch,
  } = usePromptSubmission(submissionId);
  const addComment = useAddComment();
  const [comment, setComment] = useState('');

  if (isLoading) {
    return <LoadingScreen />;
  }
  if (error || !submission) {
    return <div className="p-8 text-center">Submission not found.</div>;
  }

  return (
    <>
      <Layout>
        <div className="flex w-full">
          <Button
            variant="base"
            className="w-10"
            icon={faArrowLeft}
            disableLoad
            onClick={() => router.history.back()}
          />
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
        </div>
        <div className="w-full transition-all duration-300">
          <Card className="flex items-center relative bg-card rounded-2xl overflow-hidden border-2 border-border">
            <DrawingImage
              imageUrl={submission.imageUrl}
              className="rounded-2xl h-full w-full object-contain"
            />
            <UserProfileIcon
              showTooltip
              user={submission.user}
              className="absolute top-2 right-2"
            />
          </Card>
        </div>
        <div className="flex flex-col w-full gap-4 pb-20">
          <Card>
            <CardContent>
              {submission.comments.length === 0 && (
                <span className="font-bold text-center text-secondary">
                  Be the first to comment!
                </span>
              )}
              {submission.comments.length > 0 &&
                submission.comments.map((comment) => (
                  <div className="flex justify-between items-center font-semibold">
                    <div className="flex gap-4 items-center">
                      <UserProfileIcon size="sm" user={comment.user} />{' '}
                      {comment.text}
                    </div>
                    <span className="text-xs text-secondary ml-2">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </Layout>
      <div className="fixed bottom-24 left-0 flex justify-center w-full">
        <form
          className="bg-base p-4 flex gap-2 items-center max-w-md w-full"
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
                      queryKey: queryKeys.userProfile,
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
            className="font-bold border-2 bg-base text-primary border-border w-full p-4 rounded-2xl"
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            className="h-full"
            icon={faArrowRight}
            type="submit"
            disabled={!comment.trim()}
          ></Button>
        </form>
      </div>
    </>
  );
};

export default PromptSubmissionPage;
