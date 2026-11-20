import { useCallback, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { usePokeFriend } from '../api';
import { collapsedLayout, expandedLayout, rollCall } from '../rollCall';
import type { Spot } from '../rollCall';
import type { FC } from 'react';
import type { FriendSubmissionStatus } from '@/api/Api';
import { useActivityFeed } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { CheckIcon, ChevronDownIcon, ClockIcon } from '@/components/icons';
import { useDailyPrompt } from '@/daily/DailyPromptContext';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

const menuItemClass =
  'flex items-center w-full h-10 px-3 text-left text-lg hover:bg-paper cursor-pointer disabled:cursor-default disabled:text-pencil';

/** Tap a friend for a little menu: poke them if they haven't drawn, or open their book */
const FriendMenu: FC<{
  friend: FriendSubmissionStatus;
  isMe: boolean;
  align: 'left' | 'right';
  onClose: () => void;
}> = ({ friend, isMe, align, onClose }) => {
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
        <p className="px-3 pt-1 pb-0.5 font-bold truncate">
          {isMe ? 'you' : user.username}
        </p>
        <p className="px-3 pb-1 text-sm text-pencil">
          {hasSubmittedToday ? 'drew today' : 'still drawing…'}
        </p>
        {!hasSubmittedToday && !isMe && (
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
          {...(isMe
            ? { to: '/draw/profile/me' }
            : { to: '/draw/profile/$userId', params: { userId: user.id } })}
          className={menuItemClass}
        >
          {isMe ? 'open your book' : 'open their book'}
        </Link>
      </div>
    </>
  );
};

const AVATAR = 36;

const FriendAvatar: FC<{
  friend: FriendSubmissionStatus;
  isMe: boolean;
  spot: Spot | null;
  z: number;
  expanded: boolean;
}> = ({ friend, isMe, spot, z, expanded }) => {
  const [menuAlign, setMenuAlign] = useState<'left' | 'right' | null>(null);
  const drew = friend.hasSubmittedToday;
  const name = isMe ? 'you' : friend.user.username;

  return (
    <li
      className={cn(
        'absolute top-0 left-0 transition-[translate,opacity] duration-500 ease-[var(--ease-spring)]',
        !spot && 'opacity-0 pointer-events-none',
      )}
      style={{
        translate: spot ? `${spot.x}px ${spot.y}px` : undefined,
        zIndex: menuAlign ? 60 : z,
      }}
      aria-hidden={!spot || undefined}
      onKeyDown={(event) => event.key === 'Escape' && setMenuAlign(null)}
    >
      <button
        aria-label={`${name}, ${drew ? 'drew today' : 'still drawing'}`}
        aria-haspopup="menu"
        aria-expanded={menuAlign !== null}
        // Folded up, the whole row is one button that spreads everyone out
        tabIndex={expanded && spot ? 0 : -1}
        onClick={(event) => {
          // Open toward whichever side has room
          const { left } = event.currentTarget.getBoundingClientRect();
          setMenuAlign(left < window.innerWidth / 2 ? 'left' : 'right');
        }}
        className={cn(
          'relative block cursor-pointer',
          !expanded && 'pointer-events-none',
        )}
      >
        {/* A solid backing, so faded avatars don't show the ones they overlap */}
        <span className="block rounded-full bg-paper">
          {/* The button handles the tap, so the avatar shouldn't navigate */}
          <UserProfileIcon
            user={friend.user}
            size="sm"
            showLevel={expanded}
            className={cn(
              'pointer-events-none',
              !drew && 'opacity-50 grayscale',
            )}
          />
        </span>
        <span
          className={cn(
            'absolute -top-1 -left-1 flex items-center justify-center size-4 border-[1.5px] border-ink rounded-full transition-opacity duration-300',
            drew ? 'bg-butter' : 'bg-white text-pencil',
            // Overlapping neighbours would cover them anyway
            !expanded && 'opacity-0',
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
          isMe={isMe}
          align={menuAlign}
          onClose={() => setMenuAlign(null)}
        />
      )}
    </li>
  );
};

/** Tracks an element's width as the page resizes */
function useWidth() {
  const [width, setWidth] = useState(0);
  // A callback ref, since the row only mounts once the roll call loads
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * A compact roll call: who drew stacks up from the left, who hasn't from the
 * right. Tap it to spread everyone out
 */
export const FriendsToday = () => {
  const user = useUser();
  const { dailyPrompt } = useDailyPrompt();
  const { data } = useActivityFeed();
  const [expanded, setExpanded] = useState(false);
  const [rowRef, width] = useWidth();

  if (!data) return null;

  const { drawn, stillDrawing, friendCount } = rollCall(
    data.friends,
    user,
    !!dailyPrompt?.isCompleted,
  );

  if (friendCount === 0) {
    return (
      <p className="text-pencil">
        drawing solo?{' '}
        <Link to="/draw/profile/me" className="text-ink underline">
          add friends from your book
        </Link>
      </p>
    );
  }

  const everyone = [...drawn, ...stillDrawing];
  const layout = (expanded ? expandedLayout : collapsedLayout)(
    drawn.length,
    stillDrawing.length,
    width,
    AVATAR,
  );

  return (
    <section aria-label="Who drew today" className="flex flex-col gap-2">
      <button
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="flex justify-between items-baseline text-pencil cursor-pointer"
      >
        <h2 className="flex items-center gap-1">
          who drew today
          <ChevronDownIcon
            size={14}
            className={cn(
              'transition-[rotate] duration-300',
              expanded && 'rotate-180',
            )}
          />
        </h2>
        <span>
          {drawn.length} of {everyone.length}
        </span>
      </button>
      <div
        ref={rowRef}
        className="relative transition-[height] duration-500 ease-[var(--ease-spring)]"
        style={{ height: layout.height }}
      >
        {width > 0 && (
          <ul>
            {everyone.map((friend, index) => {
              const isDrawn = index < drawn.length;
              // The ends of the row sit on top: you and the first few on
              // the left, the rightmost still-drawing on the right
              const z = isDrawn
                ? everyone.length - index
                : everyone.length - (index - drawn.length);
              return (
                <FriendAvatar
                  key={friend.user.id}
                  friend={friend}
                  isMe={friend.user.id === user.id}
                  spot={layout.spots[index]}
                  z={z}
                  expanded={expanded}
                />
              );
            })}
          </ul>
        )}
        {!expanded && (
          <button
            aria-label="Show everyone"
            onClick={() => setExpanded(true)}
            className="absolute inset-0 z-[70] cursor-pointer"
          />
        )}
      </div>
    </section>
  );
};
