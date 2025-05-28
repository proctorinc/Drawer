import { faShareAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useProfile } from '../../UserProfileContext';
import { cn } from '@/utils';

export const ShareButton = () => {
  const { userProfile } = useProfile();
  const [isShared, setIsShared] = useState(false);

  const handleShare = () => {
    if (userProfile) {
      setIsShared(true);
      if (navigator.share) {
        navigator.share({
          text: `Hey, let's draw! ${window.location.origin}/app/add-friend/${userProfile.user.id}`,
        });
      } else {
        navigator.clipboard.writeText(
          `Hey, let's draw! ${window.location.origin}/app/add-friend/${userProfile.user.id}`,
        );
      }
      setTimeout(() => {
        setIsShared(false);
      }, 2000);
    }
  };

  return (
    <button
      disabled={!userProfile}
      className={cn(
        'flex gap-2 px-3 font-bold text-sm items-center cursor-pointer transition-all duration-300  justify-center h-10 rounded-xl',
        isShared
          ? 'bg-purple-100 text-purple-700 border-purple-200'
          : 'bg-base text-primary hover:bg-gray-200 hover:text-gray-900 hover:scale-110',
      )}
      onClick={handleShare}
    >
      <FontAwesomeIcon
        icon={isShared ? faSpinner : faShareAlt}
        className={cn(isShared && 'animate-spin')}
      />
      {isShared ? 'Sharing...' : 'Share'}
    </button>
  );
};
