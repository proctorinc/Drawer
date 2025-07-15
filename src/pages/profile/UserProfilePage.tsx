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
import { Card, CardContent, CardHeader } from '@/components/Card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/components/Button';
import { useRouter } from '@tanstack/react-router';
import { ShareButton } from './components/friends/ShareButton';
import { isFriend } from '@/utils';
import useUser from '@/auth/hooks/useUser';
import { queryKeys, useAddFriend, type User } from '@/api/Api';
import { useQueryClient } from '@tanstack/react-query';
import { DrawingImage } from '@/drawing/components/DrawingImage';

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
    <Layout>
      <div className="relative w-full">
        <div className="absolute top-0 left-0">
          <Button
            variant="base"
            className="w-10"
            icon={faArrowLeft}
            disableLoad
            onClick={() => router.history.back()}
          />
        </div>
        <div className="flex flex-col items-center gap-3 pt-10">
          <UserProfileIcon user={userProfile?.user} size="2xl" />
          <div className="flex gap-2 justify-center items-center text-center font-bold w-full max-w-md">
            <div className="pl-1 font-bold">
              <h2 className="text-2xl text-primary">
                {userProfile?.user.username}
              </h2>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
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
        <ShareButton />
      </div>
      <div className="flex flex-row gap-4 w-full justify-between">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center text-blue-600/50 bg-blue-300 shadow-blue-400/80 w-14 h-14 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]">
              <FontAwesomeIcon icon={faPalette} size="2x" />
            </div>
            <h3 className="text-2xl font-bold text-primary">
              {userProfile.prompts.length}
            </h3>
            <h3 className="text-sm font-semibold text-primary">Doodles</h3>
          </CardContent>
        </Card>
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center text-orange-600/50 bg-orange-300 shadow-orange-400/80 w-14 h-14 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]">
              <FontAwesomeIcon icon={faFire} size="2x" />
            </div>
            <h3 className="text-2xl font-bold text-primary">
              {userProfile.stats.currentStreak}
            </h3>
            <h3 className="text-sm font-semibold text-primary">Streak</h3>
          </CardContent>
        </Card>
        <Card className="w-full">
          <CardContent className="items-center gap-2">
            <div className="flex items-center justify-center text-purple-600/50 bg-purple-300 shadow-purple-400/80 w-14 h-14 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]">
              <FontAwesomeIcon icon={faUsers} size="2x" />
            </div>
            <h3 className="text-2xl font-bold text-primary">
              {userProfile.friends.length}
            </h3>
            <h3 className="text-sm font-semibold text-primary">Friends</h3>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <CardHeader title="Favorite Doodles"></CardHeader>
          <div className="flex flex-row gap-4 w-full justify-between">
            {userProfile.feed.slice(0, 3).map((submission) => (
              <DrawingImage imageUrl={submission.imageUrl} />
            ))}
          </div>
        </CardContent>
      </Card>
      <SubmissionCalendar profile={userProfile} />
      <FriendList user={userProfile.user} friends={userProfile?.friends} />
    </Layout>
  );
};

export default UserProfilePage;
