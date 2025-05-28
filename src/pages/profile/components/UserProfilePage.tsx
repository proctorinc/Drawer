import { faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from '@tanstack/react-router';
import AccountDetails from './AccountDetails';
import SubmissionList from '@/pages/profile/components/SubmissionList';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { FriendList } from '@/pages/profile/components/friends/FriendList';
import Header from '@/components/Header';
import Layout from '@/components/Layout';

const UserProfilePage = () => {
  const { userProfile } = useProfile();

  return (
    <Layout>
      <Header
        title={userProfile?.user.username}
        subtitle="My Profile"
        isLoading={!userProfile}
      >
        <HomeButton />
      </Header>
      <FriendList />
      <SubmissionList />
      <AccountDetails />
    </Layout>
  );
};

const HomeButton = () => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate({ to: '/app' })}
      className="w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center"
    >
      <FontAwesomeIcon icon={faHome} />
    </div>
  );
};

export default UserProfilePage;
