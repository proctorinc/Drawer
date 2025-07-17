import AccountDetails from './components/AccountDetails';
import { UserProfileIcon } from './components/UserProfileIcon';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import { useState, type FormEvent } from 'react';
import {
  faFire,
  faPalette,
  faPlusCircle,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useAddFriend } from '@/api/Api';
import SubmissionCalendar from './components/SubmissionCalendar';
import { useMyProfilePage } from './context/MyProfileContext';
import { FriendList } from './components/friends/FriendList';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ShareButton } from './components/friends/ShareButton';
import FavoriteSubmissions from './components/FavoriteSubmissions';
import LoadingScreen from '@/components/LoadingScreen';
import NotificationSettings from './components/NotificationSettings';

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
    <Layout
      back
      header={
        <>
          <div className="z-0 relative w-full">
            <div className="flex flex-col items-center gap-3">
              <UserProfileIcon user={profile.user} size="2xl" />
              <div className="flex gap-2 justify-center items-center text-center font-bold w-full max-w-md">
                <div className="pl-1 font-bold">
                  <h2 className="text-3xl text-secondary font-cursive">
                    {profile.user.username}
                  </h2>
                </div>
              </div>
            </div>
            <ShareButton
              urlPath={`/draw/profile/${profile.user.id}`}
              text="Checkout my daily doodle profile!"
              className="absolute right-8 top-14 bg-primary text-secondary"
            ></ShareButton>
          </div>
          <div className="z-0 flex gap-4 w-full justify-center pb-6">
            <Button
              disableLoad
              variant="base"
              size="sm"
              className="font-accent text-emerald-600/80 bg-emerald-300 shadow-emerald-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
            >
              {profile.prompts.length}
              <FontAwesomeIcon icon={faPalette} />
            </Button>
            <Button
              disableLoad
              variant="base"
              size="sm"
              className="font-accent text-orange-600/80 bg-orange-300 shadow-orange-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
            >
              {profile.stats.currentStreak}
              <FontAwesomeIcon icon={faFire} />
            </Button>
            <Button
              disableLoad
              variant="base"
              size="sm"
              className="font-accent text-purple-600/80 bg-purple-300 shadow-purple-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
            >
              {profile.friends.length}
              <FontAwesomeIcon icon={faUsers} />
            </Button>
          </div>
        </>
      }
    >
      <FavoriteSubmissions favorites={profile.favorites} />
      <SubmissionCalendar profile={profile} />
      <FriendList user={profile.user} friends={profile.friends} />
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
      <NotificationSettings />
      <AccountDetails />
    </Layout>
  );
};

export default MyProfilePage;
