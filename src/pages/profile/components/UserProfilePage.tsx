import AccountDetails from './AccountDetails';
import { UserProfileIcon } from './UserProfileIcon';
import { useProfile } from '@/pages/profile/UserProfileContext';
import { FriendList } from '@/pages/profile/components/friends/FriendList';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import { useState, type FormEvent } from 'react';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';

const UserProfilePage = () => {
  const { userProfile } = useProfile();
  const [username, setUsername] = useState('');

  function handleAddFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
                disabled={username === ''}
                icon={faPlusCircle}
                className="disabled:bg-base"
              ></Button>
            </div>
          </CardContent>
        </form>
      </Card>
      <AccountDetails />
    </Layout>
  );
};

export default UserProfilePage;
