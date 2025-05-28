import { faDoorOpen, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useProfile } from '../UserProfileContext';
import { cn } from '@/utils';

const AccountDetails = () => {
  const { logout } = useProfile();
  const [isClicked, setIsClicked] = useState(false);

  const handleLogout = () => {
    setIsClicked(true);
    setTimeout(() => {
      setIsClicked(false);
    }, 1000);
    logout();
  };

  return (
    <div className="flex justify-between items-center bg-white border border-gray-200 rounded-2xl w-full max-w-md p-4">
      <div className="border-gray-200">
        <div className="border-gray-200">
          <h3 className="text-lg font-bold">Account</h3>
          <p className="text-sm text-gray-500">Manage account</p>
        </div>
      </div>
      <button
        className={cn(
          'flex gap-2 px-3 font-bold text-sm items-center cursor-pointer transition-all duration-300 border border-gray-200 justify-center h-10 rounded-xl',
          isClicked
            ? 'bg-purple-100 text-purple-700 border-purple-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 hover:scale-110',
        )}
        onClick={handleLogout}
      >
        <FontAwesomeIcon
          icon={isClicked ? faSpinner : faDoorOpen}
          className={cn(isClicked && 'animate-spin')}
        />
        Log out
      </button>
    </div>
  );
};

export default AccountDetails;
