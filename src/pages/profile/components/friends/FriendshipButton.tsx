import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { useRefreshFriendship } from './useFriendInvites';
import type { FC } from 'react';
import type { GetMeResponse } from '@/api/Api';
import {
  useAcceptInvitation,
  useDenyInvitation,
  useInviteFriend,
} from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { CheckIcon, ClockIcon } from '@/components/icons';

type Props = {
  profile: GetMeResponse;
};

/** Where you stand with someone else: add, invited, accept, or already pals */
const FriendshipButton: FC<Props> = ({ profile }) => {
  const currentUser = useUser();
  const inviteFriend = useInviteFriend();
  const acceptInvitation = useAcceptInvitation();
  const takeBackInvitation = useDenyInvitation();
  const refreshFriendship = useRefreshFriendship();
  const { user, invitation } = profile;
  const onSuccess = () => refreshFriendship(user.id);

  if (invitation?.status === 'accepted') {
    return (
      <Chip className="h-10 px-3 bg-me text-base">
        <CheckIcon size={18} />
        pals
      </Chip>
    );
  }

  if (invitation?.status === 'pending') {
    return invitation.inviter.id === currentUser.id ? (
      <div className="flex items-center gap-2">
        <Chip className="h-10 px-3 text-base">
          <ClockIcon size={18} />
          invited
        </Chip>
        <button
          disabled={takeBackInvitation.isPending}
          onClick={() => takeBackInvitation.mutate(user.id, { onSuccess })}
          className="text-pencil underline underline-offset-2 cursor-pointer disabled:opacity-50"
        >
          take back
        </button>
      </div>
    ) : (
      <Button
        size="sm"
        disabled={acceptInvitation.isPending}
        onClick={() => acceptInvitation.mutate(user.id, { onSuccess })}
      >
        <CheckIcon size={18} />
        accept invite
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      icon={faPlusCircle}
      disabled={inviteFriend.isPending}
      onClick={() => inviteFriend.mutate(user.id, { onSuccess })}
    >
      add friend
    </Button>
  );
};

export default FriendshipButton;
