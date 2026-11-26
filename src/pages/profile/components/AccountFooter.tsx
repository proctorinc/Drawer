import { useNavigate } from '@tanstack/react-router';
import { faCrown, faFlask } from '@fortawesome/free-solid-svg-icons';
import NotificationSettings from './NotificationSettings';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';

// Features still being tried out by the app's owner
const isOwner = (username: string) => username === 'matty_p';

/** The last page of my book: tools for admins and testers (logging out lives in the settings gear) */
const AccountFooter = () => {
  const navigate = useNavigate();
  const user = useUser();
  const owner = isOwner(user.username);
  const beta = user.hasBeta || user.isAdmin;

  if (!owner && !beta) return null;

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
        {beta && (
          <Button
            size="sm"
            variant="base"
            icon={faFlask}
            disableLoad
            onClick={() => navigate({ to: '/draw/beta' })}
          >
            beta lab
          </Button>
        )}
      </div>
    </footer>
  );
};

export default AccountFooter;
