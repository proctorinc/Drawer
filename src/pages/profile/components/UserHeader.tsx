import {
  queryKeys,
  useAddFriend,
  type GetMeResponse,
  type User,
} from '@/api/Api';
import type { FC } from 'react';
import { UserProfileIcon } from './UserProfileIcon';
import { ShareButton } from './friends/ShareButton';
import { isFriend } from '@/utils';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import {
  faCheckCircle,
  faFire,
  faPalette,
  faPlusCircle,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  userProfile?: GetMeResponse;
};

const UserHeader: FC<Props> = ({ userProfile }) => {
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const addFriend = useAddFriend();
  const isMe = currentUser.id === userProfile?.user.id;

  const isAlreadyFriend = isFriend(currentUser.id, userProfile?.friends ?? []);

  function handleAddFriend(user: User) {
    addFriend.mutate(user.username, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.userProfile(user.id),
        });
      },
    });
  }

  return (
    <>
      <div className="z-0 relative w-full">
        <div className="flex flex-col items-center gap-3">
          <UserProfileIcon user={userProfile?.user} size="2xl" />
          <div className="flex gap-2 justify-center items-center text-center font-bold w-full max-w-md">
            <div className="pl-1 font-bold">
              <h2 className="text-3xl font-bold text-base/80 font-cursive">
                {userProfile?.user.username}
              </h2>
            </div>
          </div>
        </div>
        <ShareButton
          urlPath={`/draw/profile/${userProfile?.user.id}`}
          text={`Checkout ${isMe ? 'my' : `${userProfile?.user.username}'s`} daily doodle profile!`}
          className="absolute right-8 top-14 bg-primary text-secondary"
        ></ShareButton>
        {!isMe && isAlreadyFriend && (
          <Button
            size="sm"
            className="absolute left-2 top-14 bg-transparent text-secondary"
            icon={faCheckCircle}
          >
            Friend
          </Button>
        )}
        {!isMe && !isAlreadyFriend && (
          <Button
            size="sm"
            variant="base"
            className="absolute left-6 top-14 bg-primary text-secondary"
            icon={faPlusCircle}
            onClick={() => {
              if (userProfile) {
                handleAddFriend(userProfile.user);
              }
            }}
          >
            Friend
          </Button>
        )}
      </div>
      <div className="z-0 flex gap-4 w-full justify-center pb-6">
        <Button
          disableLoad
          variant="base"
          size="sm"
          className="font-accent text-emerald-600/80 bg-emerald-300 shadow-emerald-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
        >
          {userProfile?.prompts.length}
          <FontAwesomeIcon icon={faPalette} />
        </Button>
        <Button
          disableLoad
          variant="base"
          size="sm"
          className="font-accent text-orange-600/80 bg-orange-300 shadow-orange-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
        >
          {userProfile?.stats.currentStreak}
          <FontAwesomeIcon icon={faFire} />
        </Button>
        <Button
          disableLoad
          variant="base"
          size="sm"
          className="font-accent  text-purple-600/80 bg-purple-300 shadow-purple-400/80 rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
        >
          {userProfile?.friends.length}
          <FontAwesomeIcon icon={faUsers} />
        </Button>
      </div>
    </>
  );
};

export default UserHeader;
