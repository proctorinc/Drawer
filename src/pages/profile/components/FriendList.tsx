import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useProfile } from '../UserProfileContext';
import { UserProfileIcon } from './UserProfileIcon';
import { faShareAlt, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { cn } from '@/utils';

export const FriendList = () => {
  const { userProfile } = useProfile();
  const [isShared, setIsShared] = useState(false);

  if (!userProfile) {
    return <></>;
  }

  const handleShare = () => {
    setIsShared(true);
    setTimeout(() => {
      setIsShared(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-4 bg-white border border-gray-200 rounded-2xl w-full max-w-md p-4">
      <div className="flex justify-between items-center">
        <div className="border-gray-200">
          <h3 className="text-lg font-bold">Friend list</h3>
          <p className="text-sm text-gray-500">My friends</p>
        </div>
        <button
          className={cn(
            'flex gap-2 px-3 font-bold text-sm items-center cursor-pointer transition-all duration-300 border border-gray-200 justify-center h-10 rounded-xl',
            isShared
              ? 'bg-green-100 text-green-700 border-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 hover:scale-110',
          )}
          onClick={handleShare}
        >
          <FontAwesomeIcon icon={isShared ? faCheck : faShareAlt} />
          {isShared ? 'Shared!' : 'Share'}
        </button>
      </div>
      {userProfile.friends.length === 0 && (
        <div className="border border-gray-200 p-4 bg-gray-100 rounded-2xl">
          None
        </div>
      )}
      {userProfile.friends.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-md">
          {userProfile.friends.map((friend) => (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl w-full px-4 py-2">
              <UserProfileIcon user={friend} size="sm" />
              <h3 className="font-bold">{friend.username}</h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
