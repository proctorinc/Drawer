import LoadingScreen from '@/components/LoadingScreen';
import Layout from '@/components/Layout';
import { UserProfileIcon } from './components/UserProfileIcon';
import SubmissionCalendar from './components/SubmissionCalendar';
import { FriendList } from './components/friends/FriendList';
import { useProfile } from './context/UserProfileContext';
import {
  faArrowLeft,
  faCheckCircle,
  faFire,
  faPalette,
  faPlusCircle,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Card, CardContent } from '@/components/Card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/components/Button';
import { useRouter } from '@tanstack/react-router';
import { ShareButton } from './components/friends/ShareButton';
import { isFriend } from '@/utils';
import useUser from '@/auth/hooks/useUser';
import { queryKeys, useAddFriend, type User } from '@/api/Api';
import { useQueryClient } from '@tanstack/react-query';
import { DrawingImage } from '@/drawing/components/DrawingImage';
import Tooltip from '@/components/Tooltip';

const UserProfilePage = () => {
  const router = useRouter();
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const { userProfile } = useProfile();
  const addFriend = useAddFriend();

  if (!userProfile?.user) {
    return <LoadingScreen />;
  }

  function handleAddFriend(user: User) {
    addFriend.mutate(user.username, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.userProfile(user.id),
        });
      },
    });
  }

  const isAlreadyFriend = isFriend(currentUser.id, userProfile.friends);

  return (
    <Layout
      header={
        <>
          <div className="relative w-full">
            <div className="flex flex-col items-center gap-3">
              <UserProfileIcon user={userProfile?.user} size="2xl" />
              <div className="flex gap-2 justify-center items-center text-center font-bold w-full max-w-md">
                <div className="pl-1 font-bold">
                  <h2 className="text-2xl text-secondary">
                    {userProfile?.user.username}
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
                className="font-accent text-blue-600/80 bg-blue-300 shadow-blue-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
              >
                {userProfile.prompts.length}
                <FontAwesomeIcon icon={faPalette} />
              </Button>
            </Tooltip>
            <Tooltip content="streak" location="top">
              <Button
                disableLoad
                variant="base"
                size="sm"
                className="font-accent text-orange-600/80 bg-orange-300 shadow-orange-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
              >
                {userProfile.stats.currentStreak}
                <FontAwesomeIcon icon={faFire} />
              </Button>
            </Tooltip>
            <Tooltip content="friends" location="top">
              <Button
                disableLoad
                variant="base"
                size="sm"
                className="font-accent  text-purple-600/80 bg-purple-300 shadow-purple-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
              >
                {userProfile.friends.length}
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
          {isAlreadyFriend && (
            <Button disabled size="sm" icon={faCheckCircle}>
              Your friend!
            </Button>
          )}
          {!isAlreadyFriend && (
            <Button
              size="sm"
              variant="base"
              icon={faPlusCircle}
              onClick={() => handleAddFriend(userProfile.user)}
            >
              Add Friend
            </Button>
          )}
          <ShareButton
            text={`Checkout ${userProfile.user.username}'s daily doodle profile!`}
          >
            Share
          </ShareButton>
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <div className="text-lg font-bold text-primary text-left w-full">
          <h2>Favorite doodles</h2>
        </div>
        <div className="flex flex-row gap-4 w-full justify-between">
          {userProfile.favorites.slice(0, 3).map((favorite) => (
            <Card className="w-1/3">
              <DrawingImage imageUrl={favorite.submission.imageUrl} />
            </Card>
          ))}
          {userProfile.favorites.length === 0 && (
            <Card>
              <CardContent className="text-center font-bold text-secondary">
                No favorite doodles yet
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <SubmissionCalendar profile={userProfile} />
      <FriendList user={userProfile.user} friends={userProfile?.friends} />
    </Layout>
  );
};

export default UserProfilePage;
