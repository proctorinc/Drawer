import { faCalendar, faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { UserProfileIcon } from '@/pages/profile/components/UserProfileIcon';
import { useProfile } from '@/pages/profile/UserProfileContext';

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
      <div className="flex justify-around w-full max-w-md bg-primary-foreground border-t-2 border-border rounded-t-2xl p-4">
        <button
          onClick={() => navigate({ to: '/app/calendar' })}
          className="w-9 h-9 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center"
        >
          <FontAwesomeIcon icon={faCalendar} />
        </button>
        <button
          onClick={() => navigate({ to: '/app' })}
          className="w-9 h-9 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center"
        >
          <FontAwesomeIcon icon={faHome} />
        </button>
        <button
          onClick={() => navigate({ to: '/app/user-profile' })}
          className="w-9 h-9 cursor-pointer hover:scale-110 transition-all duration-300"
        >
          <UserProfileIcon user={userProfile?.user} size="sm" />
        </button>
      </div>
    </div>
  );
};

export default Navbar;
