import { useMyProfilePage } from '../context/MyProfileContext';
import { DrawingImage } from '@/drawing/components/DrawingImage';

const SubmissionList = () => {
  const { profile } = useMyProfilePage();

  return (
    <div className="flex flex-col w-full max-w-md gap-4">
      {profile?.prompts.length === 0 ? (
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
          {profile?.prompts.map((submission) => {
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
                <DrawingImage
                  imageUrl={submission.imageUrl}
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
