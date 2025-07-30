import {
  queryKeys,
  useAcceptInvitation,
  useInviteFriend,
  type GetMeResponse,
  type User,
} from '@/api/Api';
import type { FC } from 'react';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { ShareButton } from './friends/ShareButton';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import {
  faCheckCircle,
  faClock,
  faFire,
  faPalette,
  faPlusCircle,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { cn, nameToColor } from '@/utils';

type Props = {
  userProfile?: GetMeResponse;
  className?: string;
};

const UserHeader: FC<Props> = ({ userProfile, className }) => {
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const inviteFriend = useInviteFriend();
  const acceptInvitation = useAcceptInvitation();
  const isMe = currentUser.id === userProfile?.user.id;
  const { primary, text } = nameToColor(userProfile?.user.username ?? '');

  function handleInviteFriend(user: User) {
    inviteFriend.mutate(user.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.userProfile(user.id),
        });
      },
    });
  }

  function handleAccept(userId: string) {
    acceptInvitation.mutate(userId, {
      onError: (err: any) =>
        console.error(err.message || 'Failed to accept invitation'),
    });
  }

  return (
    <div
      className={cn('flex flex-col gap-4', 'z-0 relative w-full', className)}
    >
      <div>
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
        {!isMe && userProfile?.invitation?.status === 'accepted' && (
          <Button
            size="sm"
            className="absolute left-0 top-14 bg-transparent text-secondary"
            icon={faCheckCircle}
          >
            Friend
          </Button>
        )}
        {!isMe &&
          userProfile?.invitation?.status === 'pending' &&
          userProfile.invitation.inviter.id === currentUser.id && (
            <Button
              size="sm"
              className="absolute left-0 top-14 bg-transparent text-secondary"
              icon={faClock}
            >
              Invited
            </Button>
          )}
        {!isMe &&
          userProfile?.invitation?.status === 'pending' &&
          userProfile.invitation.inviter.id !== currentUser.id && (
            <Button
              size="sm"
              className="absolute left-0 top-14 bg-primary text-secondary"
              icon={faCheckCircle}
              onClick={() => handleAccept(userProfile.user.id)}
            >
              Accept
            </Button>
          )}
        {!isMe && !userProfile?.invitation && (
          <Button
            size="sm"
            variant="base"
            className="absolute left-0 top-14 bg-primary text-secondary"
            icon={faPlusCircle}
            onClick={() => {
              if (userProfile) {
                handleInviteFriend(userProfile.user);
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
          className="font-accent text-primary bg-border shadow-secondary rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
        >
          {userProfile?.prompts.length}
          <FontAwesomeIcon icon={faPalette} />
        </Button>
        <Button
          disableLoad
          variant="base"
          size="sm"
          className="font-accent text-amber-600 bg-amber-400 shadow-secondary rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
          // style={{
          //   backgroundColor: primary,
          //   color: text,
          //   borderColor: primary,
          // }}
        >
          {userProfile?.stats.currentStreak}
          <FontAwesomeIcon icon={faFire} />
        </Button>
        <Button
          disableLoad
          variant="base"
          size="sm"
          className="font-accent  text-secondary bg-border shadow-secondary rounded-full shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]"
          style={{
            backgroundColor: primary,
            color: text,
            borderColor: primary,
          }}
        >
          {userProfile?.friends.length}
          <FontAwesomeIcon icon={faUsers} />
        </Button>
      </div>
    </div>
  );
};

export default UserHeader;
