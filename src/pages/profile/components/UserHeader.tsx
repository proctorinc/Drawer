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
  faPlusCircle,
} from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/utils';

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

  const stats = [
    { value: userProfile?.prompts.length, label: 'doodles' },
    { value: userProfile?.stats.currentStreak, label: 'streak' },
    { value: userProfile?.friends.length, label: 'pals' },
  ];

  return (
    <div className={cn('relative flex flex-col gap-4 w-full', className)}>
      <div className="relative flex items-center gap-4 p-4 bg-white border-2 border-ink rounded-sketch shadow-pencil">
        <span
          aria-hidden="true"
          className="absolute -top-2.5 right-8 w-12 h-[18px] bg-coral/50 rotate-6"
        />
        <div className="flex-none -rotate-4">
          <UserProfileIcon user={userProfile?.user} size="xl" />
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="font-accent font-bold text-[30px] leading-none truncate">
            {userProfile?.user.username}
          </h1>
          <div className="flex gap-3 text-pencil">
            {stats.map((stat) => (
              <span key={stat.label}>
                <b className="font-accent font-bold text-[22px] text-ink">
                  {stat.value ?? 0}
                </b>{' '}
                {stat.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!isMe && userProfile?.invitation?.status === 'accepted' && (
          <Button size="sm" variant="base" disableLoad icon={faCheckCircle}>
            friends
          </Button>
        )}
        {!isMe &&
          userProfile?.invitation?.status === 'pending' &&
          userProfile.invitation.inviter.id === currentUser.id && (
            <Button size="sm" variant="base" disableLoad icon={faClock}>
              invited
            </Button>
          )}
        {!isMe &&
          userProfile?.invitation?.status === 'pending' &&
          userProfile.invitation.inviter.id !== currentUser.id && (
            <Button
              size="sm"
              icon={faCheckCircle}
              onClick={() => handleAccept(userProfile.user.id)}
            >
              accept invite
            </Button>
          )}
        {!isMe && !userProfile?.invitation && (
          <Button
            size="sm"
            icon={faPlusCircle}
            onClick={() => {
              if (userProfile) {
                handleInviteFriend(userProfile.user);
              }
            }}
          >
            add friend
          </Button>
        )}
        <ShareButton
          urlPath={`/draw/profile/${userProfile?.user.id}`}
          text={`Checkout ${isMe ? 'my' : `${userProfile?.user.username}'s`} daily doodle profile!`}
          className="ml-auto"
        >
          share
        </ShareButton>
      </div>
    </div>
  );
};

export default UserHeader;
