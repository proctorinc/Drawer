import LoadingScreen from '@/components/LoadingScreen';
import Layout from '@/components/Layout';
import SubmissionCalendar from './components/SubmissionCalendar';
import { FriendList } from './components/friends/FriendList';
import { useProfile } from './context/UserProfileContext';
import UserHeader from './components/UserHeader';
import FavoriteSubmissions from './components/FavoriteSubmissions';

const UserProfilePage = () => {
  const { userProfile } = useProfile();

  if (!userProfile?.user) {
    return <LoadingScreen />;
  }

  return (
    <Layout back header={<UserHeader userProfile={userProfile} />}>
      <FavoriteSubmissions profile={userProfile} />
      <SubmissionCalendar profile={userProfile} />
      <FriendList user={userProfile.user} friends={userProfile?.friends} />
    </Layout>
  );
};

export default UserProfilePage;
