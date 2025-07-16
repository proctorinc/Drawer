import LoadingScreen from '@/components/LoadingScreen';
import Layout from '@/components/Layout';
import { UserProfileIcon } from './components/UserProfileIcon';
import SubmissionCalendar from './components/SubmissionCalendar';
import { FriendList } from './components/friends/FriendList';
import { useProfile } from './context/UserProfileContext';
import {
  faCheckCircle,
  faFire,
  faPalette,
  faPlusCircle,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Card, CardContent } from '@/components/Card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/components/Button';
import { useNavigate } from '@tanstack/react-router';
import { ShareButton } from './components/friends/ShareButton';
import { isFriend } from '@/utils';
import useUser from '@/auth/hooks/useUser';
import { queryKeys, useAddFriend, type User } from '@/api/Api';
import { useQueryClient } from '@tanstack/react-query';
import { DrawingImage } from '@/drawing/components/DrawingImage';

const UserProfilePage = () => {
  const navigate = useNavigate();
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
              <UserProfileIcon user={userProfile.user} size="2xl" />
              <div className="flex gap-2 justify-center items-center text-center font-bold w-full max-w-md">
                <div className="pl-1 font-bold">
                  <h2 className="text-2xl text-secondary font-cursive">
                    {userProfile?.user.username}
                  </h2>
                </div>
              </div>
            </div>
            <ShareButton
              urlPath={`/draw/profile/${userProfile?.user.id}`}
              text="Checkout my daily doodle profile!"
              className="absolute right-8 top-14 bg-primary text-secondary"
            ></ShareButton>
            {isAlreadyFriend && (
              <Button
                size="sm"
                className="absolute left-6 top-14 bg-primary-foreground text-secondary"
                icon={faCheckCircle}
              >
                Friend
              </Button>
            )}
            {!isAlreadyFriend && (
              <Button
                size="sm"
                variant="base"
                className="absolute left-6 top-14 bg-primary text-secondary"
                icon={faPlusCircle}
                onClick={() => handleAddFriend(userProfile.user)}
              >
                Friend
              </Button>
            )}
          </div>
          <div className="flex gap-4 w-full justify-center pb-6">
            <Button
              disableLoad
              variant="base"
              size="sm"
              className="font-accent text-emerald-600/80 bg-emerald-300 shadow-emerald-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
            >
              {userProfile.prompts.length}
              <FontAwesomeIcon icon={faPalette} />
            </Button>
            <Button
              disableLoad
              variant="base"
              size="sm"
              className="font-accent text-orange-600/80 bg-orange-300 shadow-orange-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
            >
              {userProfile.stats.currentStreak}
              <FontAwesomeIcon icon={faFire} />
            </Button>
            <Button
              disableLoad
              variant="base"
              size="sm"
              className="font-accent  text-purple-600/80 bg-purple-300 shadow-purple-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
            >
              {userProfile.friends.length}
              <FontAwesomeIcon icon={faUsers} />
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-2 w-full">
        <div className="text-lg font-bold text-primary text-left w-full">
          <h2>Favorite doodles</h2>
        </div>
        <div className="flex flex-row gap-4 w-full justify-between">
          {userProfile.favorites.slice(0, 3).map((favorite) => (
            <Card className="w-1/3">
              <DrawingImage
                imageUrl={favorite.submission.imageUrl}
                onClick={() =>
                  navigate({
                    to: `/draw/submission/${favorite.submission.id}`,
                  })
                }
              />
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
