import AccountDetails from './components/AccountDetails';
import { UserProfileIcon } from './components/UserProfileIcon';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import { useState, type FormEvent } from 'react';
import {
  faArrowLeft,
  faFire,
  faPalette,
  faPlusCircle,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useAddFriend } from '@/api/Api';
import SubmissionCalendar from './components/SubmissionCalendar';
import { useMyProfilePage } from './context/MyProfileContext';
import { FriendList } from './components/friends/FriendList';
import Tooltip from '@/components/Tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ShareButton } from './components/friends/ShareButton';
import { useRouter } from '@tanstack/react-router';
import FavoriteSubmissions from './components/FavoriteSubmissions';

const MyProfilePage = () => {
  const router = useRouter();
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
    <Layout
      header={
        <>
          <div className="relative w-full">
            <div className="flex flex-col items-center gap-3">
              <UserProfileIcon user={profile?.user} size="2xl" />
              <div className="flex gap-2 justify-center items-center text-center font-bold w-full max-w-md">
                <div className="pl-1 font-bold">
                  <h2 className="text-2xl text-secondary">
                    {profile?.user.username}
                  </h2>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-4 w-full justify-center pb-6">
            <Tooltip content="doodles" location="top">
              <Button
                disableLoad
                variant="base"
                size="sm"
                className="font-accent text-primary bg-border shadow-secondary rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
              >
                {profile?.prompts.length}
                <FontAwesomeIcon icon={faPalette} />
              </Button>
            </Tooltip>
            <Tooltip content="streak" location="top">
              <Button
                disableLoad
                variant="base"
                size="sm"
                className="font-accent text-primary bg-border shadow-secondary rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
              >
                {profile?.stats.currentStreak}
                <FontAwesomeIcon icon={faFire} />
              </Button>
            </Tooltip>
            <Tooltip content="friends" location="top">
              <Button
                disableLoad
                variant="base"
                size="sm"
                className="font-accent  text-primary bg-border shadow-secondary rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
              >
                {profile?.friends.length}
                <FontAwesomeIcon icon={faUsers} />
              </Button>
            </Tooltip>
          </div>
        </>
      }
    >
      <div className="relative flex w-full h-10">
        <Button
          variant="base"
          className="absolute left-0 top-0 w-10"
          icon={faArrowLeft}
          disableLoad
          onClick={() => router.history.back()}
        />
        <div className="flex w-full gap-2 justify-center items-center">
          <ShareButton
            urlPath={`/draw/profile/${profile?.user.id}`}
            text="Checkout my daily doodle profile!"
          >
            Share
          </ShareButton>
        </div>
      </div>
      <FavoriteSubmissions favorites={profile?.favorites} />
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
