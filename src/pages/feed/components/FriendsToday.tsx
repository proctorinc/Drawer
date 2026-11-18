import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { usePokeFriend } from '../api';
import { rollCall } from '../rollCall';
import type { FC } from 'react';
import type { FriendSubmissionStatus } from '@/api/Api';
import { useActivityFeed } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { CheckIcon, ClockIcon } from '@/components/icons';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

const menuItemClass =
  'flex items-center w-full h-10 px-3 text-left text-lg hover:bg-paper cursor-pointer disabled:cursor-default disabled:text-pencil';

/** Tap a friend for a little menu: poke them if they haven't drawn, or open their book */
const FriendMenu: FC<{
  friend: FriendSubmissionStatus;
  align: 'left' | 'right';
  onClose: () => void;
}> = ({ friend, align, onClose }) => {
  const poke = usePokeFriend();
  const poked = friend.pokedToday || poke.isSuccess;
  const { user, hasSubmittedToday } = friend;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        role="menu"
        aria-label={user.username}
        className={cn(
          'absolute top-full z-50 mt-2 w-44 py-1 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm animate-in fade-in zoom-in-95 duration-150',
          align === 'left'
            ? 'left-0 origin-top-left'
            : 'right-0 origin-top-right',
        )}
      >
        <p className="px-3 pt-1 pb-0.5 font-bold truncate">{user.username}</p>
        <p className="px-3 pb-1 text-sm text-pencil">
          {hasSubmittedToday ? 'drew today' : 'still drawing…'}
        </p>
        {!hasSubmittedToday && (
          <button
            role="menuitem"
            onClick={() => poke.mutate(user.id)}
            disabled={poke.isPending || poked}
            className={cn(menuItemClass, poked && 'animate-wiggle')}
          >
            {poked ? 'poked! 👉' : poke.isError ? 'try again' : 'poke 👉'}
          </button>
        )}
        <Link
          role="menuitem"
          to="/draw/profile/$userId"
          params={{ userId: user.id }}
          className={menuItemClass}
        >
          open their book
        </Link>
      </div>
    </>
  );
};

const FriendAvatar: FC<{ friend: FriendSubmissionStatus }> = ({ friend }) => {
  const [menuAlign, setMenuAlign] = useState<'left' | 'right' | null>(null);
  const drew = friend.hasSubmittedToday;

  return (
    <li
      className="relative flex-none"
      onKeyDown={(event) => event.key === 'Escape' && setMenuAlign(null)}
    >
      <button
        aria-label={`${friend.user.username}, ${drew ? 'drew today' : 'still drawing'}`}
        aria-haspopup="menu"
        aria-expanded={menuAlign !== null}
        onClick={(event) => {
          // Open toward whichever side has room
          const { left } = event.currentTarget.getBoundingClientRect();
          setMenuAlign(left < window.innerWidth / 2 ? 'left' : 'right');
        }}
        className="relative block cursor-pointer"
      >
        {/* The button handles the tap, so the avatar shouldn't navigate */}
        <UserProfileIcon
          user={friend.user}
          size="sm"
          className={cn('pointer-events-none', !drew && 'opacity-50 grayscale')}
        />
        <span
          className={cn(
            'absolute -top-1 -left-1 flex items-center justify-center size-4 border-[1.5px] border-ink rounded-full',
            drew ? 'bg-butter' : 'bg-white text-pencil',
          )}
        >
          {drew ? (
            <CheckIcon size={9} strokeWidth={4} />
          ) : (
            <ClockIcon size={10} strokeWidth={2.5} />
          )}
        </span>
      </button>
      {menuAlign && (
        <FriendMenu
          friend={friend}
          align={menuAlign}
          onClose={() => setMenuAlign(null)}
        />
      )}
    </li>
  );
};

/** A compact roll call: friends who drew today in color, the rest greyed out */
export const FriendsToday = () => {
  const user = useUser();
  const { data } = useActivityFeed();
  if (!data) return null;

  const { drawn, stillDrawing } = rollCall(data.friends, user.id);
  const total = drawn.length + stillDrawing.length;

  if (total === 0) {
    return (
      <p className="w-full text-center text-pencil">
        drawing solo?{' '}
        <Link to="/draw/profile/me" className="text-ink underline">
          add friends from your book
        </Link>
      </p>
    );
  }

  return (
    <section
      aria-label="Who drew today"
      className="flex flex-col gap-1.5 w-full"
    >
      <div className="flex justify-between items-baseline text-pencil">
        <h2>who drew today</h2>
        <span>
          {drawn.length} of {total}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {[...drawn, ...stillDrawing].map((friend) => (
          <FriendAvatar key={friend.user.id} friend={friend} />
        ))}
      </ul>
    </section>
  );
};
