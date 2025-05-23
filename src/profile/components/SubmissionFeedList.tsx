import type { UserPromptSubmission } from '@/api/Api';
import { useProfile } from '../UserProfileContext';
import { UserProfileIcon } from './UserProfileIcon';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';

export const SubmissionFeedList: React.FC = () => {
    const { userProfile } = useProfile();
    const feed = userProfile?.feed || {};

    return (
        <div className="flex flex-col gap-4 w-full max-w-md">
            {Object.keys(feed).length === 0 ? (
                <div className="flex flex-col py-10 text-center text-gray-600 flex-grow border border-gray-200 rounded-2xl p-4 bg-gray-200">
                    <h2 className="text-xl font-semibold">No Submissions Yet</h2>
                    <p>It looks like you haven't submitted any prompts. Start drawing!</p>
                </div>
            ) : (
                Object.entries(feed).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, data]) => {
                    const submissions = data as UserPromptSubmission[];
                    const formattedDate = new Date(date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                    });
                    return (
                        <div key={date} className="flex flex-col gap-2">
                            <div className="text-2xl font-bold text-gray-900">
                                <h2>Draw {submissions[0].prompt}</h2>
                                <p className="text-sm text-gray-500">{formattedDate}</p>
                            </div>
                            <div className="flex gap-4 w-full max-w-md overflow-scroll">
                                {submissions.map((submission) => (
                                    <div key={submission.day} className="relative bg-white border border-gray-300 rounded-2xl w-[448px]">
                                        <CanvasRenderer 
                                            canvasData={submission.canvasData}
                                            className="w-full h-auto rounded-2xl"
                                        />
                                        <UserProfileIcon user={submission.user} className="absolute top-2 right-2" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                )
            )}
        </div>
    );
};
