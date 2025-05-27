import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useProfile } from "../UserProfileContext";
import { UserProfileIcon } from "./UserProfileIcon";
import { faShare } from "@fortawesome/free-solid-svg-icons";

export const FriendList = () => {
    const { userProfile } = useProfile();

    if (!userProfile) {
        return <></>;
    }

    const handleShare = async () => {
        if (navigator.share) {
            try {
            await navigator.share({
                text: `Hey, let's draw! ${window.location.origin}/app/add-friend/${userProfile.user.id}`,
            });
                console.log('Data was shared successfully');
            } catch (error) {
                console.error('Sharing failed:', error);
            }
        } else {
            alert('Web Share API is not supported on this device/browser.');
            navigator.clipboard.writeText(`Hey, let's draw! ${window.location.origin}/app/add-friend/${userProfile.user.id}`);
        }
    };

    return (
        <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-2xl w-full max-w-md p-4">
            <div className="flex justify-between items-center">
                <div className="border-gray-200">
                    <h3 className="text-lg font-bold">Friend list</h3>
                    <p className="text-sm text-gray-500">My friends</p>
                </div>
                <button className="flex items-center bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200 hover:text-gray-900 hover:scale-110 transition-all duration-300 border border-gray-200 justify-center w-10 h-10 rounded-xl border-gray-200" onClick={handleShare}>
                    <FontAwesomeIcon icon={faShare} />
                </button>
            </div>
            {userProfile.friends.length === 0 && <div className="border border-gray-200 p-4 bg-gray-100 rounded-2xl">None</div>}
            {userProfile.friends.length > 0 && (
                <div className="flex flex-col gap-4 w-full max-w-md">
                    {userProfile.friends.map((friend) => (
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl w-full px-4 py-2">
                            <UserProfileIcon user={friend} />
                            <h3 className="text-lg font-bold">{friend.username}</h3>
                        </div>
                    ))}
                </div>
            )}
        </div>

    );
};