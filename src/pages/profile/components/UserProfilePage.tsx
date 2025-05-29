import { faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from '@tanstack/react-router';
import AccountDetails from './AccountDetails';
import { UserProfileIcon } from './UserProfileIcon';
import SubmissionList from '@/pages/profile/components/SubmissionList';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { FriendList } from '@/pages/profile/components/friends/FriendList';
import Header from '@/components/Header';
import Layout from '@/components/Layout';
import { nameToColor } from '@/utils';

const UserProfilePage = () => {
  const { userProfile } = useProfile();
  const { secondary } = nameToColor(userProfile?.user.username ?? '');

  return (
    <Layout>
      <Header title="Daily Drawer" subtitle="My Profile">
        <HomeButton />
      </Header>

      {userProfile && (
        <div
          style={{ backgroundColor: secondary }}
          className="flex items-center gap-4 bg-card border-2 border-border rounded-2xl w-full max-w-md p-4"
        >
          <UserProfileIcon user={userProfile.user} />
          <h3 className="text-xl text-primary font-bold">
            Hi, {userProfile.user.username}!
          </h3>
        </div>
      )}
      <FriendList />
      <SubmissionList isLoading={!userProfile} />
      <AccountDetails />
    </Layout>
  );
};

const HomeButton = () => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate({ to: '/app' })}
      className="w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-xl bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center"
    >
      <FontAwesomeIcon icon={faHome} />
    </div>
  );
};

export default UserProfilePage;
