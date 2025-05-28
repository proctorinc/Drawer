import { useProfile } from '../../UserProfileContext';
import { UserProfileIcon } from '../UserProfileIcon';
import { ShareButton } from './ShareButton';
import { nameToColor } from '@/utils';

export const FriendList = () => {
  const { userProfile } = useProfile();

  return (
    <div className="flex flex-col gap-4 bg-card border-2 border-border rounded-2xl w-full max-w-md p-4">
      <div className="flex justify-between items-center">
        <div className="border-gray-200">
          <h3 className="text-lg font-bold text-primary">Friend list</h3>
          <p className="text-sm font-bold text-secondary">My friends</p>
        </div>
        <ShareButton />
      </div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {!userProfile && (
          <>
            <div className="flex animate-pulse bg-secondary h-[50px] items-center gap-2 rounded-2xl w-full px-4 py-2"></div>
            <div className="flex animate-pulse bg-secondary h-[50px] items-center gap-2 rounded-2xl w-full px-4 py-2"></div>
            <div className="flex animate-pulse bg-secondary h-[50px] items-center gap-2 rounded-2xl w-full px-4 py-2"></div>
          </>
        )}
        {userProfile && userProfile.friends.length === 0 && (
          <div className="flex bg-card h-[50px] items-center gap-2 border text-sm text-gray-500 border-gray-200 rounded-2xl w-full px-4 py-2">
            Share a link to add friends!
          </div>
        )}
        {userProfile &&
          userProfile.friends.length > 0 &&
          userProfile.friends.map((friend) => {
            const { secondary } = nameToColor(friend.username);
            return (
              <div
                className="flex items-center gap-2 rounded-2xl w-full px-4 py-2"
                style={{ backgroundColor: secondary }}
              >
                <UserProfileIcon user={friend} size="sm" />
                <h3 className="text-primary font-bold">{friend.username}</h3>
              </div>
            );
          })}
      </div>
    </div>
  );
};
