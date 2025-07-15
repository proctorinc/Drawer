import AccountDetails from './components/AccountDetails';
import { UserProfileIcon } from './components/UserProfileIcon';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import { useState, type FormEvent } from 'react';
import { faFire, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { useAddFriend } from '@/api/Api';
import SubmissionCalendar from './components/SubmissionCalendar';
import { useMyProfilePage } from './context/MyProfileContext';
import { FriendList } from './components/friends/FriendList';
import Banner from '@/components/Banner';

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

  return (
    <Layout>
      <div className="flex flex-col items-center gap-3">
        <UserProfileIcon user={profile?.user} size="xl" />
        <div className="flex gap-2 justify-center items-center text-center font-bold w-full max-w-md">
          <div className="pl-1 font-bold">
            <h2 className="text-2xl text-primary">
              Hi, {profile?.user.username}
            </h2>
          </div>
        </div>
      </div>
      <Banner icon={faFire}>
        You're on a {profile?.stats.currentStreak} day streak!
      </Banner>
      <SubmissionCalendar profile={profile} />
      <FriendList user={profile?.user} friends={profile?.friends} />
      <Card>
        <form onSubmit={handleAddFriend}>
          <CardContent>
            <CardHeader title="Add Friend" />
            <div className="flex gap-2 rounded-2xl">
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
      <AccountDetails />
    </Layout>
  );
};

export default MyProfilePage;
