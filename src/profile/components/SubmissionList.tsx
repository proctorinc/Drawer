import { Config } from '@/config/Config';
import { useProfile } from '../UserProfileContext'; // Adjust the path as needed

const SubmissionList: React.FC = () => {
    const { userProfile } = useProfile();

    // Check if the user has any prompts submitted
    const submissions = userProfile?.prompts || [];

    return (
        <div className="flex flex-col w-full max-w-md gap-4">
            <h3 className="text-center text-lg font-bold">My Drawings</h3>
            {submissions.length === 0 ? (
                <div className="flex flex-col py-10 text-center text-gray-600 flex-grow border border-gray-200 rounded-2xl p-4 bg-gray-200">
                    <h2 className="text-xl font-semibold">No Submissions Yet</h2>
                    <p>It looks like you haven't submitted any drawings yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4 pb-10">
                    {submissions.map((submission) => {
                        const formattedDate = new Date(submission.day).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        });
                        return (
                            <div key={submission.imageUrl} className="bg-white border border-gray-200 rounded-2xl">
                                <img src={`${Config.API_BASE_URL}${submission.imageUrl}`} alt={submission.prompt} className="w-full h-auto rounded-t-2xl" />
                                <div className="px-4 py-2 border-t border-gray-200">
                                    <h3 className="text-lg font-bold">{submission.prompt}</h3>
                                    <p className="text-sm text-gray-500">{formattedDate}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export default SubmissionList;