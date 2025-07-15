import { faHome, faList } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import { cn } from '@/utils';
import useUser from '@/auth/hooks/useUser';

const Navbar = () => {
  const navigate = useNavigate();
  const user = useUser();
  const location = useLocation();

  return (
    <div className="z-50 fixed bottom-0 left-0 right-0 flex justify-center items-center">
      <div className="flex justify-around w-full max-w-md bg-primary-foreground rounded-t-3xl p-4 pb-8">
        <button
          onClick={() => navigate({ to: '/draw/activity' })}
          className={cn(
            'w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center',
            location.pathname === '/draw/activity' &&
              'ring-3 ring-base/50 bg-base text-primary',
          )}
        >
          <FontAwesomeIcon icon={faList} />
        </button>
        <button
          onClick={() => navigate({ to: '/draw' })}
          className={cn(
            'w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center',
            location.pathname === '/draw' &&
              'ring-3 ring-base/50 bg-base text-primary',
          )}
        >
          <FontAwesomeIcon icon={faHome} />
        </button>
        <button
          className="cursor-pointer hover:scale-110 transition-all duration-300"
          onClick={() => navigate({ to: '/draw/profile/me' })}
        >
          <UserProfileIcon
            className={cn(
              location.pathname === `/draw/profile/${user.id}` &&
                'ring-3 ring-base/50 rounded-full',
            )}
            user={user}
            size="lg"
            onClick={() => {}}
          />
        </button>
      </div>
    </div>
  );
};

export default Navbar;
