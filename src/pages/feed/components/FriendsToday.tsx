import { Link } from '@tanstack/react-router';
import { usePokeFriend } from '../api';
import { rollCall, rollCallTagline } from '../rollCall';
import type { FC } from 'react';
import type { FriendSubmissionStatus } from '@/api/Api';
import { useActivityFeed } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { CheckIcon, PencilIcon } from '@/components/icons';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

const PokeButton: FC<{ friend: FriendSubmissionStatus }> = ({ friend }) => {
  const poke = usePokeFriend();
  const poked = friend.pokedToday || poke.isSuccess;

  return (
    <button
      onClick={() => poke.mutate(friend.user.id)}
      disabled={poke.isPending || poked}
      className={cn(
        'press h-6 px-2 border-[1.5px] border-ink rounded-[12px_9px_12px_10px] text-sm leading-none cursor-pointer disabled:cursor-default',
        poked ? 'bg-butter animate-wiggle' : 'bg-white',
      )}
    >
      {poked ? 'poked!' : poke.isError ? 'try again' : 'poke'}
    </button>
  );
};

const FriendAvatar: FC<{ friend: FriendSubmissionStatus }> = ({ friend }) => {
  const drew = friend.hasSubmittedToday;

  return (
    <li className="flex flex-none flex-col items-center gap-1 w-16">
      <div className="relative">
        <UserProfileIcon
          user={friend.user}
          className={cn(!drew && 'opacity-60 grayscale-[60%]')}
        />
        <span
          className={cn(
            'absolute -right-1.5 -bottom-1 flex items-center justify-center size-6 border-2 border-ink rounded-full',
            drew ? 'bg-butter' : 'bg-white',
          )}
        >
          {drew ? (
            <CheckIcon size={14} strokeWidth={3} />
          ) : (
            <PencilIcon size={13} className="animate-nudge" />
          )}
        </span>
      </div>
      <span className="w-full text-center text-sm leading-tight truncate">
        {friend.user.username}
      </span>
      {!drew && <PokeButton friend={friend} />}
    </li>
  );
};

/** Who's drawn today's prompt so far, with a nudge for the stragglers */
export const FriendsToday: FC<{ iDrew: boolean }> = ({ iDrew }) => {
  const user = useUser();
  const { data } = useActivityFeed();
  if (!data) return null;

  const { drawn, stillDrawing } = rollCall(data.friends, user.id);
  const total = drawn.length + stillDrawing.length;

  if (total === 0) {
    return (
      <p className="w-full px-4 py-3 border-2 border-dashed border-line rounded-sketch text-center text-pencil text-lg">
        drawing solo?{' '}
        <Link to="/draw/profile/me" className="text-ink underline">
          add friends from your book
        </Link>{' '}
        to see who drew today
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-end">
        <h2 className="font-accent font-bold text-[28px] leading-none">
          who drew today
        </h2>
        <span className="text-pencil text-[17px]">
          {drawn.length} of {total}
        </span>
      </div>
      {/* One segment per friend, colored in as they draw */}
      <div className="flex gap-1 h-3.5 p-0.5 bg-white border-2 border-ink rounded-sketch-alt">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 rounded-sm transition-colors duration-500',
              i < drawn.length && 'bg-butter',
            )}
          />
        ))}
      </div>
      <p className="text-pencil">
        {rollCallTagline(drawn.length, total, iDrew)}
      </p>
      <ul className="flex gap-2 -mx-6 px-6 pt-1 pb-2 overflow-x-auto stagger">
        {[...drawn, ...stillDrawing].map((friend) => (
          <FriendAvatar key={friend.user.id} friend={friend} />
        ))}
      </ul>
    </section>
  );
};
