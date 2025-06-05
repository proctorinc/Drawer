import AccountDetails from './AccountDetails';
import { UserProfileIcon } from './UserProfileIcon';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { FriendList } from '@/pages/profile/components/friends/FriendList';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import { useState, type FormEvent } from 'react';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { useAddFriend } from '@/api/Api';

const UserProfilePage = () => {
  const { userProfile } = useProfile();
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
      <Card>
        <form onSubmit={handleAddFriend}>
          <CardContent>
            <CardHeader title="Add Friend" subtitle="Enter username" />
            <div className="flex gap-2 rounded-2xl">
              <input
                type="text"
                placeholder="Username"
                className="font-bold border-2 text-primary border-border w-full p-4 rounded-2xl"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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

export default UserProfilePage;
