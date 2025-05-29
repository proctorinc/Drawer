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
import { Config } from '@/config/Config';

const UserProfilePage = () => {
  const { userProfile } = useProfile();

  return (
    <Layout>
      <Header
        title={
          <span className="font-cursive tracking-widest">
            {Config.APP_NAME}
          </span>
        }
        subtitle="My Profile"
      >
        <HomeButton />
      </Header>
      {userProfile && (
        <div className="flex gap-2 items-center py-2 ml-1 font-bold w-full max-w-md">
          <UserProfileIcon user={userProfile.user} />
          <div className="pl-1 font-bold">
            <h2 className="text-2xl text-primary">
              Hi, {userProfile.user.username}
            </h2>
            <p className="text-secondary">
              You've done {userProfile.prompts.length} doodles!
            </p>
          </div>
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
      className="w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-full bg-primary/80 text-secondary hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center"
    >
      <FontAwesomeIcon icon={faHome} />
    </div>
  );
};

export default UserProfilePage;
