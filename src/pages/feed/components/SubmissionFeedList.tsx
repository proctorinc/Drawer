import { Card } from '@/components/Card';
import SubmissionComments from './SubmissionComments';
import DrawingFeedImage from '@/drawing/components/DrawingFeedImage';
import { useMyProfilePage } from '@/pages/profile/context/MyProfileContext';
import Banner from '@/components/Banner';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';

export const SubmissionFeedList = () => {
  const { profile } = useMyProfilePage();
  const feed = profile?.feed;

  return (
    <div className="flex flex-col gap-4 w-full max-w-md pb-40">
      {feed?.length === 0 ? (
        <Card className="h-64 justify-center text-center">
          <h2 className="text-primary-foreground font-bold text-xl">
            No Submissions Yet
          </h2>
          <p className="font-bold text-primary">
            It looks like you haven't submitted any prompts. Start drawing!
          </p>
        </Card>
      ) : (
        feed?.map((submission, i) => (
          <div key={submission.id} className="flex flex-col gap-3 pb-10">
            {(i === 0 || submission.day !== feed[i - 1].day) && (
              <>
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
                {submission.createdBy && (
                  <Banner>
                    <UserProfileIcon size="sm" user={submission.createdBy} />
                    Prompt by: {submission.createdBy.username}
                  </Banner>
                )}
              </>
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
