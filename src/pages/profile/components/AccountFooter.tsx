import { useNavigate } from '@tanstack/react-router';
import { faCrown, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import NotificationSettings from './NotificationSettings';
import useAuth from '@/auth/hooks/useAuth';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';

// Features still being tried out by the app's owner
const isOwner = (username: string) => username === 'matty_p';

/** The last page of my book: log out, plus admin tools for admins */
const AccountFooter = () => {
  const navigate = useNavigate();
  const user = useUser();
  const { logout } = useAuth();
  const owner = isOwner(user.username);

  return (
    <footer className="flex flex-col items-center gap-4 w-full pt-6 border-t-2 border-dashed border-line">
      {owner && <NotificationSettings />}
      <div className="flex flex-wrap justify-center gap-2">
        {user.isAdmin && (
          <Button
            size="sm"
            variant="base"
            icon={faCrown}
            disableLoad
            onClick={() => navigate({ to: '/draw/admin' })}
          >
            admin dashboard
          </Button>
        )}
        <Button size="sm" variant="base" icon={faDoorOpen} onClick={logout}>
          log out
        </Button>
      </div>
    </footer>
  );
};

export default AccountFooter;
