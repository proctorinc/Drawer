import { Card } from '@/components/Card';
import { useProfile } from '../../profile/UserProfileContext';
import SubmissionComments from './SubmissionComments';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import DrawingFeedImage from '@/drawing/components/DrawingFeedImage';

export const SubmissionFeedList = () => {
  const { userProfile } = useProfile();
  const feed = userProfile?.feed;

  return (
    <div className="flex flex-col gap-4 w-full max-w-md pb-40">
      {feed?.length === 0 ? (
        <div className="flex flex-col h-64 justify-center text-center border-border bg-border rounded-2xl p-4">
          <h2 className="text-primary-foreground font-bold text-xl">
            No Submissions Yet
          </h2>
          <p className="font-bold text-primary">
            It looks like you haven't submitted any prompts. Start drawing!
          </p>
        </div>
      ) : (
        feed?.map((submission, i) => (
          <div key={submission.id} className="flex flex-col gap-3">
            {(i === 0 || submission.day !== feed[i - 1].day) && (
              <div className="pl-1 font-bold">
                <h2 className="text-2xl text-primary">{submission.prompt}</h2>
                <p className="text-secondary">
                  {new Date(submission.day).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
            <div
              key={`${submission.user.id}-${submission.day}`}
              className="flex flex-col gap-3"
            >
              <DrawingFeedImage submission={submission} />
              <SubmissionComments
                submissionId={submission.id}
                comments={submission.comments}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
};
