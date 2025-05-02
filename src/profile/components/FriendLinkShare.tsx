import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useProfile } from "../UserProfileContext";
import { faCopy } from "@fortawesome/free-solid-svg-icons";

export const FriendLinkShare = () => {
    const { userProfile } = useProfile();

    if (!userProfile) {
        return <></>;
    }

    const handleShare = async () => {
        if (navigator.share) {
            try {
            await navigator.share({
                text: `Hey, let's draw! ${window.location.origin}/add-friend/${userProfile.user.id}`,
            });
                console.log('Data was shared successfully');
            } catch (error) {
                console.error('Sharing failed:', error);
            }
        } else {
            alert('Web Share API is not supported on this device/browser.');
            navigator.clipboard.writeText(`Hey, let's draw! ${window.location.origin}/add-friend/${userProfile.user.id}`);
        }
    };

    return (
        <div className="flex justify-between items-center bg-white border border-gray-200 rounded-2xl w-full max-w-md p-4">
            <div className="border-gray-200">
                <h3 className="text-lg font-bold">Add friends</h3>
                <p className="text-sm text-gray-500">Share this link to add friends</p>
            </div>
            <button className="flex items-center bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200 hover:text-gray-900 hover:scale-110 transition-all duration-300 border border-gray-200 justify-center w-10 h-10 rounded-xl border-gray-200" onClick={handleShare}>
                <FontAwesomeIcon icon={faCopy} />
            </button>
        </div>
    );
};