import { useProfile } from '../UserProfileContext'; // Adjust the path as needed
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';

const SubmissionList: React.FC = () => {
  const { userProfile } = useProfile();

  return (
    <div className="flex flex-col w-full max-w-md gap-4">
      <h3 className="text-center text-lg font-bold">My Drawings</h3>
      {userProfile?.prompts.length === 0 ? (
        <div className="flex flex-col py-10 text-center text-gray-600 flex-grow border border-gray-200 rounded-2xl p-4 bg-gray-200">
          <h2 className="text-xl font-semibold">No Submissions Yet</h2>
          <p>It looks like you haven't submitted any drawings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {userProfile?.prompts.map((submission) => {
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
                className="bg-white border border-gray-200 rounded-2xl"
              >
                <CanvasRenderer
                  canvasData={submission.canvasData}
                  className="w-full h-auto rounded-t-2xl"
                />
                <div className="px-4 py-2 border-t border-gray-200">
                  <h3 className="text-sm font-bold whitespace-nowrap overflow-hidden overflow-ellipsis">
                    {submission.prompt}
                  </h3>
                  <p className="text-xs text-gray-500">{formattedDate}</p>
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
