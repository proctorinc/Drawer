import { Link } from '@tanstack/react-router';
import { getReaction } from './catalog';
import { ReactionSticker } from './ReactionSticker';
import type { FC } from 'react';
import type { Reaction, User } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

type Reactor = { user: User; reactions: Array<Reaction> };

/** Everyone who reacted, first to react first, with all the stickers they picked */
function byReactor(reactions: Array<Reaction>): Array<Reactor> {
  const reactors = new Map<string, Reactor>();
  const sorted = [...reactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  for (const reaction of sorted) {
    const reactor = reactors.get(reaction.user.id);
    if (reactor) reactor.reactions.push(reaction);
    else
      reactors.set(reaction.user.id, {
        user: reaction.user,
        reactions: [reaction],
      });
  }
  return [...reactors.values()];
}

// Stickers lean their own way, like they were slapped on by hand
const TILTS = ['-rotate-6', 'rotate-3', '-rotate-2', 'rotate-6'];

type Props = {
  reactions: Array<Reaction>;
  className?: string;
};

/** Who reacted to a doodle: one row per person, their avatar, name and stickers */
export const ReactorList: FC<Props> = ({ reactions, className }) => {
  const currentUser = useUser();
  const reactors = byReactor(reactions);
  if (reactors.length === 0) return null;

  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {reactors.map(({ user, reactions: picked }) => {
        const isMe = user.id === currentUser.id;
        return (
          <li key={user.id} className="flex items-center gap-3">
            <Link
              to="/draw/profile/$userId"
              params={{ userId: user.id }}
              className="flex flex-1 min-w-0 items-center gap-3 font-semibold"
            >
              <UserProfileIcon user={user} size="sm" className="flex-none" />
              <span className="truncate">{isMe ? 'you' : user.username}</span>
            </Link>
            <span
              className="flex flex-none items-center gap-1"
              aria-label={picked
                .map((reaction) => getReaction(reaction.reactionId).label)
                .join(', ')}
            >
              {picked.map((reaction, index) => (
                <ReactionSticker
                  key={reaction.id}
                  reactionId={reaction.reactionId}
                  size={24}
                  className={TILTS[index % TILTS.length]}
                />
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
