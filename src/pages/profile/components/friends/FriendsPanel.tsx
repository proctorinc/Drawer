import { UserProfileIcon } from '../profile-icons/UserProfileIcon';
import { FriendList } from './FriendList';
import IncomingInvites from './IncomingInvites';
import { ShareButton } from './ShareButton';
import { useFriendInvites } from './useFriendInvites';
import type { GetMeResponse } from '@/api/Api';
import type { FC } from 'react';
import { ClockIcon } from '@/components/icons';

type Props = {
  profile: GetMeResponse;
};

/** Everything friend-shaped: requests, the invite link and the friend list */
const FriendsPanel: FC<Props> = ({ profile }) => {
  const { outgoing, deny, isPending } = useFriendInvites();

  return (
    <>
      <IncomingInvites />

      <div className="relative flex flex-col gap-3 p-4 bg-sky border-2 border-ink rounded-sketch shadow-pencil">
        <p className="font-accent font-bold text-2xl leading-none">
          doodling is better with friends
        </p>
        <p className="text-pencil leading-tight">
          send your link. when they tap "add friend", you'll see each other's
          doodles every day.
        </p>
        <ShareButton
          urlPath={`/draw/profile/${profile.user.id}`}
          text={`Come draw with me! Add ${profile.user.username} on Drawer, one doodle a day:`}
          className="self-start"
        >
          send invite link
        </ShareButton>
      </div>

      <FriendList user={profile.user} friends={profile.friends} />

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-pencil">
            <ClockIcon size={16} />
            waiting to hear back from
          </h3>
          {outgoing.map(({ invitee }) => (
            <div
              key={invitee.id}
              className="flex items-center gap-3 px-3 py-2 border-[1.5px] border-dashed border-ink rounded-sketch-alt"
            >
              <UserProfileIcon size="sm" user={invitee} />
              <span className="flex-1 text-lg truncate">
                {invitee.username}
              </span>
              <button
                disabled={isPending}
                onClick={() => deny(invitee.id)}
                className="text-pencil underline underline-offset-2 cursor-pointer disabled:opacity-50"
              >
                take back
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
};

export default FriendsPanel;
