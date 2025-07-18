import AccountDetails from './components/AccountDetails';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import { useState, type FormEvent } from 'react';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { useAddFriend } from '@/api/Api';
import SubmissionCalendar from './components/SubmissionCalendar';
import { useMyProfilePage } from './context/MyProfileContext';
import { FriendList } from './components/friends/FriendList';
import FavoriteSubmissions from './components/FavoriteSubmissions';
import LoadingScreen from '@/components/LoadingScreen';
import NotificationSettings from './components/NotificationSettings';
import UserHeader from './components/UserHeader';

const MyProfilePage = () => {
  const { profile } = useMyProfilePage();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const addFriendMutation = useAddFriend();

  function handleAddFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    addFriendMutation
      .mutateAsync(username)
      .then(() => {
        setUsername('');
      })
      .catch((err) => {
        setError(err.message || 'Failed to add friend');
      });
  }

  if (!profile?.user) {
    return <LoadingScreen />;
  }

  return (
    <Layout back header={<UserHeader userProfile={profile} />}>
      <FavoriteSubmissions profile={profile} />
      <SubmissionCalendar profile={profile} />
      <FriendList user={profile.user} friends={profile.friends} />
      <Card>
        <form onSubmit={handleAddFriend}>
          <CardContent>
            <CardHeader title="Add Friend" />
            <div className="flex gap-2 items-center rounded-2xl">
              <input
                type="text"
                placeholder="Username"
                className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
              />
              <Button
                type="submit"
                size="sm"
                disabled={username === '' || addFriendMutation.isPending}
                icon={faPlusCircle}
                className="disabled:bg-base"
              ></Button>
            </div>
            {error && (
              <p className="text-center text-sm font-bold text-red-700 mb-2">
                {error}
              </p>
            )}
          </CardContent>
        </form>
      </Card>
      {profile.user.username === 'matty_p' && <NotificationSettings />}
      <AccountDetails />
    </Layout>
  );
};

export default MyProfilePage;
