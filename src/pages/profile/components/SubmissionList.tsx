import { useProfile } from '../UserProfileContext'; // Adjust the path as needed
import type { FC } from 'react';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';

type Props = {
  isLoading: boolean;
};

const SubmissionList: FC<Props> = ({ isLoading }) => {
  const { userProfile } = useProfile();

  return (
    <div className="flex flex-col w-full max-w-md gap-4">
      <h3 className="text-primary text-center text-xl font-bold">My Doodles</h3>
      {userProfile?.prompts.length === 0 ? (
        <div className="flex flex-col h-64 justify-center text-center border-border bg-border rounded-2xl p-4">
          <h2 className="text-primary-foreground font-bold text-xl">
            No Submissions Yet
          </h2>
          <p className="font-bold text-primary">
            It looks like you haven't submitted any prompts. Start drawing!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {isLoading && (
            <>
              <div className="bg-secondary w-full h-[225px] rounded-2xl overflow-clip animate-pulse"></div>
              <div className="bg-secondary w-full h-[225px] rounded-2xl overflow-clip animate-pulse"></div>
              <div className="bg-secondary w-full h-[225px] rounded-2xl overflow-clip animate-pulse"></div>
              <div className="bg-secondary w-full h-[225px] rounded-2xl overflow-clip animate-pulse"></div>
            </>
          )}
          {!isLoading &&
            userProfile?.prompts.map((submission) => {
              const formattedDate = new Date(submission.day).toLocaleDateString(
                'en-US',
                {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                },
              );
              return (
                <div
                  key={submission.day}
                  className="bg-card border-2 border-border rounded-2xl overflow-clip"
                >
                  <CanvasRenderer
                    canvasData={submission.canvasData}
                    className="w-full h-auto rounded-t-2xl"
                  />
                  <div className="px-4 py-2 bg-card border-t-2 border-border">
                    <h3 className="text-primary text-sm font-bold whitespace-nowrap overflow-hidden overflow-ellipsis">
                      {submission.prompt}
                    </h3>
                    <p className="text-xs font-bold text-secondary">
                      {formattedDate}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default SubmissionList;
