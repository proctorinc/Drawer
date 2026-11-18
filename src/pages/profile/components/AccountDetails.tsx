import { useNavigate } from '@tanstack/react-router';
import { faCrown, faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import NotificationSettings from './NotificationSettings';
import useAuth from '@/auth/hooks/useAuth';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import { Card, CardContent, CardHeader } from '@/components/Card';

// Features still being tried out by the app's owner
const isOwner = (username: string) => username === 'matty_p';

/** Account info and app settings; the profile itself is edited elsewhere */
const AccountDetails = () => {
  const navigate = useNavigate();
  const user = useUser();
  const { logout } = useAuth();

  const details = [
    { label: 'name', value: user.username },
    { label: 'email', value: user.email },
    {
      label: 'doodling since',
      value: new Date(user.createdAt).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    },
  ];

  return (
    <>
      <Card>
        <CardContent>
          <CardHeader title="account" />
          <dl className="flex flex-col gap-1">
            {details.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-pencil">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {isOwner(user.username) && <NotificationSettings />}
      {isOwner(user.username) && (
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
    </>
  );
};

export default AccountDetails;
