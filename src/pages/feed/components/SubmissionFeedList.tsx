import { useProfile } from '../../profile/UserProfileContext';
import { UserProfileIcon } from '../../profile/components/UserProfileIcon';
import type { UserPromptSubmission } from '@/api/Api';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';
import { nameToColor } from '@/utils';

type Props = {
  isLoading: boolean;
};

export const SubmissionFeedList: React.FC<Props> = ({ isLoading }) => {
  const { userProfile } = useProfile();
  const feed = userProfile?.feed || {};

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md">
        <div className="flex flex-col gap-4">
          <div className="text-2xl h-[28px] w-[250px] bg-secondary rounded-xl animate-pulse"></div>
          <div className="text-sm h-[16px] w-[150px] bg-secondary rounded-xl animate-pulse"></div>
        </div>
        <div className="flex flex-col animate-pulse aspect-square rounded-2xl bg-secondary"></div>
        <div className="flex flex-col animate-pulse aspect-square rounded-2xl bg-secondary"></div>
      </div>
    );
  }

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
              <div key={date} className="flex flex-col gap-2">
                <div className="text-2xl pl-1 font-bold">
                  <h2 className="text-primary">
                    Draw {submissions[0].prompt.toLowerCase()}
                  </h2>
                  <p className="text-secondary text-sm">{formattedDate}</p>
                </div>
                <div className="flex flex-col gap-4">
                  {submissions.map((submission) => {
                    const { primary } = nameToColor(submission.user.username);
                    return (
                      <div
                        key={`${submission.user.id}-${submission.day}`}
                        className="flex items-center relative bg-card rounded-2xl overflow-hidden p-4 border-2 border-border"
                      >
                        <CanvasRenderer
                          canvasData={submission.canvasData}
                          className="rounded-2xl"
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-bl from-[var(--gradient-color)]/40 to-transparent rounded-2xl"
                          style={
                            {
                              '--gradient-color': primary,
                            } as React.CSSProperties
                          }
                        />
                        <UserProfileIcon
                          user={submission.user}
                          className="absolute top-2 right-2"
                        />
                      </div>
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
