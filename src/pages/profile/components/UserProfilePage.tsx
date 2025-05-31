import AccountDetails from './AccountDetails';
import { UserProfileIcon } from './UserProfileIcon';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { FriendList } from '@/pages/profile/components/friends/FriendList';
import Layout from '@/components/Layout';

const UserProfilePage = () => {
  const { userProfile } = useProfile();

  return (
    <Layout>
      {userProfile && (
        <div className="flex gap-2 items-center ml-1 font-bold w-full max-w-md">
          <UserProfileIcon user={userProfile.user} />
          <div className="pl-1 font-bold">
            <h2 className="text-2xl text-primary">
              Hi, {userProfile.user.username}
            </h2>
            <p className="text-secondary">
              You've done {userProfile.stats.totalDrawings} doodles!
            </p>
          </div>
        </div>
      )}
      <FriendList />
      <AccountDetails />
    </Layout>
  );
};

export default UserProfilePage;
