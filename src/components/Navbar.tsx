import { faCalendar, faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { cn } from '@/utils';

const Navbar = () => {
  const navigate = useNavigate();
  const { userProfile } = useProfile();
  const location = useLocation();

  if (
    location.href.startsWith('/app/login') ||
    location.href.startsWith('/app/create-profile')
  ) {
    return <></>;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center items-center">
      <div className="z-50 flex justify-around w-full max-w-md bg-primary-foreground rounded-t-2xl p-4 pb-8">
        <button
          onClick={() => navigate({ to: '/app/calendar' })}
          className={cn(
            'w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center',
            location.pathname === '/app/calendar' &&
              'ring-3 ring-base/50 bg-base text-primary',
          )}
        >
          <FontAwesomeIcon icon={faCalendar} />
        </button>
        <button
          onClick={() => navigate({ to: '/app' })}
          className={cn(
            'w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center',
            location.pathname === '/app' &&
              'ring-3 ring-base/50 bg-base text-primary',
          )}
        >
          <FontAwesomeIcon icon={faHome} />
        </button>
        <button
          onClick={() => navigate({ to: '/app/user-profile' })}
          className="cursor-pointer hover:scale-110 transition-all duration-300"
        >
          <UserProfileIcon
            className={cn(
              location.pathname === '/app/user-profile' &&
                'ring-3 ring-base/50 rounded-full',
            )}
            user={userProfile?.user}
            size="lg"
          />
        </button>
      </div>
    </div>
  );
};

export default Navbar;
