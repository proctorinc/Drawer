import { faDoorOpen } from '@fortawesome/free-solid-svg-icons';
import { useProfile } from '../UserProfileContext';
import Button from '@/components/Button';

const AccountDetails = () => {
  const { logout } = useProfile();

  return (
    <div className="flex justify-between items-center bg-card border-2 border-border rounded-2xl w-full max-w-md p-4">
      <div>
        <h3 className="text-lg font-bold text-primary">Account</h3>
        <p className="text-sm font-bold text-secondary">Manage account</p>
      </div>
      <Button size="sm" variant="base" icon={faDoorOpen} onClick={logout}>
        Log out
      </Button>
    </div>
  );
};

export default AccountDetails;
