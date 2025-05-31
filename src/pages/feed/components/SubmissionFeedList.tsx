import { Card, CardContent } from '@/components/Card';
import { useProfile } from '../../profile/UserProfileContext';
import { UserProfileIcon } from '../../profile/components/UserProfileIcon';
import type { UserPromptSubmission } from '@/api/Api';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';

export const SubmissionFeedList = () => {
  const { userProfile } = useProfile();
  const feed = userProfile?.feed || {};

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      {Object.keys(feed).length === 0 ? (
        <div className="flex flex-col h-64 justify-center text-center border-border bg-border rounded-2xl p-4">
          <h2 className="text-primary-foreground font-bold text-xl">
            No Submissions Yet
          </h2>
          <p className="font-bold text-primary">
            It looks like you haven't submitted any prompts. Start drawing!
          </p>
        </div>
      ) : (
        Object.entries(feed)
          .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
          .map(([date, data]) => {
            const submissions = data as Array<UserPromptSubmission>;
            const formattedDate = new Date(date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });
            return (
              <div key={date} className="flex flex-col gap-4">
                <div className="pl-1 font-bold">
                  <h2 className="text-2xl text-primary">
                    {submissions[0].prompt}
                  </h2>
                  <p className="text-secondary">{formattedDate}</p>
                </div>
                <div className="flex flex-col gap-6">
                  {submissions.map((submission) => {
                    return (
                      <Card
                        key={`${submission.user.id}-${submission.day}`}
                        className="flex items-center relative bg-card rounded-2xl overflow-hidden border-2 border-border"
                      >
                        <CardContent>
                          <CanvasRenderer
                            canvasData={submission.canvasData}
                            className="rounded-2xl"
                          />
                          <UserProfileIcon
                            user={submission.user}
                            className="absolute top-2 right-2"
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
      )}
    </div>
  );
};
