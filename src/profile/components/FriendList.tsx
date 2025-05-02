import { useProfile } from "../UserProfileContext";
import { UserProfileIcon } from "./UserProfileIcon";

export const FriendList = () => {
    const { userProfile } = useProfile();

    if (!userProfile) {
        return <></>;
    }

    return (
        <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-2xl w-full max-w-md p-4">
            <div className="border-gray-200">
                <h3 className="text-lg font-bold">Friend list</h3>
                <p className="text-sm text-gray-500">My friends</p>
            </div>
            {userProfile.friends.length === 0 && <div className="border border-gray-200 p-4 bg-gray-100 rounded-2xl">None</div>}
            {userProfile.friends.length > 0 && (
                <div className="flex flex-col gap-4 w-full max-w-md">
                    {userProfile.friends.map((friend) => (
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl w-full px-4 py-2">
                            <UserProfileIcon user={friend} />
                            <h3 className="text-lg font-bold">{friend.name}</h3>
                        </div>
                    ))}
                </div>
            )}
        </div>

    );
};