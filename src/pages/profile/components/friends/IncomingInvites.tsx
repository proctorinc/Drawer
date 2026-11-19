import { UserProfileIcon } from '../profile-icons/UserProfileIcon';
import { useFriendInvites } from './useFriendInvites';
import Button from '@/components/Button';
import { PushPin } from '@/components/PushPin';

/** Friend requests as sticky notes, each answerable with one tap */
const IncomingInvites = () => {
  const { incoming, accept, deny, isPending, error } = useFriendInvites();

  if (incoming.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 w-full stagger">
      {incoming.map(({ inviter }, i) => (
        <div
          key={inviter.id}
          className={`relative flex flex-col gap-3 p-4 pt-5 bg-blush shadow-[1px_2px_6px_rgba(43,42,51,0.18)] ${i % 2 ? 'rotate-1' : '-rotate-1'}`}
        >
          <PushPin
            color={'#ffb400'}
            lean={-14}
            className="absolute z-10 -top-[23px] left-1/2 -ml-4"
          />
          <div className="flex items-center gap-3">
            <UserProfileIcon user={inviter} />
            <p className="text-lg leading-tight">
              <b className="font-accent font-bold text-2xl">
                {inviter.username}
              </b>{' '}
              wants to be friends!
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="base"
              disableLoad
              disabled={isPending}
              onClick={() => deny(inviter.id)}
            >
              not now
            </Button>
            <Button
              size="sm"
              disableLoad
              disabled={isPending}
              onClick={() => accept(inviter.id)}
            >
              yes, add them!
            </Button>
          </div>
        </div>
      ))}
      {error && <p className="text-coral text-center">{error.message}</p>}
    </div>
  );
};

export default IncomingInvites;
