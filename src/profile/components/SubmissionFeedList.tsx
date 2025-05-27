import type { UserPromptSubmission } from '@/api/Api';
import { useProfile } from '../UserProfileContext';
import { UserProfileIcon } from './UserProfileIcon';
import { CanvasRenderer } from '@/drawing/components/CanvasRenderer';

type Props = {
    isLoading: boolean
}

export const SubmissionFeedList: React.FC<Props> = ({ isLoading }) => {
    const { userProfile } = useProfile();
    const feed = userProfile?.feed || {};

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 w-full max-w-md">
                <div className="flex flex-col animate-pulse w-[50%] h-12 rounded-2xl bg-gray-200"></div>
                <div className="flex flex-col animate-pulse aspect-square rounded-2xl bg-gray-200"></div>
                <div className="flex flex-col animate-pulse aspect-square rounded-2xl bg-gray-200"></div>
                <div className="flex flex-col animate-pulse aspect-square rounded-2xl bg-gray-200"></div>
            </div>
        )
    }

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
                                <h2>Draw {submissions[0].prompt.toLowerCase()}</h2>
                                <p className="text-sm text-gray-500">{formattedDate}</p>
                            </div>
                            <div className="flex flex-col gap-4">
                                {submissions.map((submission) => (
                                    <div key={submission.day} className="relative bg-white border border-gray-300 rounded-2xl">
                                        <CanvasRenderer 
                                            canvasData={submission.canvasData}
                                            className="rounded-2xl"
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
