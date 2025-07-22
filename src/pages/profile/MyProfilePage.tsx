import AccountDetails from './components/AccountDetails';
import Layout from '@/components/Layout';
import SubmissionCalendar from './components/SubmissionCalendar';
import { useMyProfilePage } from './context/MyProfileContext';
import { FriendList } from './components/friends/FriendList';
import FavoriteSubmissions from './components/FavoriteSubmissions';
import LoadingScreen from '@/components/LoadingScreen';
import NotificationSettings from './components/NotificationSettings';
import UserHeader from './components/UserHeader';

const MyProfilePage = () => {
  const { profile } = useMyProfilePage();

  if (!profile?.user) {
    return <LoadingScreen />;
  }

  return (
    <Layout back header={<UserHeader userProfile={profile} />}>
      <FavoriteSubmissions profile={profile} />
      <SubmissionCalendar profile={profile} />
      <FriendList user={profile.user} friends={profile.friends} />
      {profile.user.username === 'matty_p' && <NotificationSettings />}
      <AccountDetails />
    </Layout>
  );
};

export default MyProfilePage;
