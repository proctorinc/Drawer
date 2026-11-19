import type { FC } from 'react';
import type { LeaderboardEntry } from '@/api/trophies';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { StarIcon } from '@/components/icons';
import { cn } from '@/utils';

const medals = [
  { label: '1st', className: 'bg-butter' },
  { label: '2nd', className: 'bg-sky' },
  { label: '3rd', className: 'bg-blush' },
];

type Props = {
  entries: Array<LeaderboardEntry>;
  myId: string;
};

const Leaderboard: FC<Props> = ({ entries, myId }) => {
  if (entries.length < 2) {
    return (
      <p className="w-full p-4 text-center text-pencil bg-white border-2 border-dashed border-pencil rounded-sketch">
        A leaderboard of one is just a mirror. Add friends from My Book and race
        them for the gold star.
      </p>
    );
  }

  return (
    <ol className="flex flex-col w-full bg-white border-2 border-ink rounded-sketch shadow-pencil overflow-clip stagger">
      {entries.map((entry, i) => {
        // Entries come sorted by XP, so ties share the rank of the first of them
        const rank = entries.findIndex((e) => e.xp === entry.xp) + 1;
        const medal = entry.xp > 0 ? medals[rank - 1] : undefined;
        const isMe = entry.user.id === myId;
        const isNapping = entry.xp === 0;

        return (
          <li
            key={entry.user.id}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 border-ink/20',
              i > 0 && 'border-t-2 border-dashed',
              isMe && 'bg-sky/50',
            )}
          >
            <span
              className={cn(
                'grid place-items-center w-10 h-8 shrink-0 font-accent font-bold text-lg',
                medal &&
                  'border-2 border-ink rounded-blob shadow-pencil-sm -rotate-6',
                medal?.className,
              )}
            >
              {/* No XP yet isn't a placing */}
              {isNapping ? '–' : (medal?.label ?? rank)}
            </span>
            <UserProfileIcon size="sm" user={entry.user} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="truncate text-lg leading-tight">
                {entry.user.username}
                {isMe && <span className="text-pencil"> (you)</span>}
              </span>
              <span className="text-sm text-pencil leading-tight">
                {isNapping
                  ? 'just getting started'
                  : `${entry.drawings} drawing${entry.drawings === 1 ? '' : 's'}`}
              </span>
            </div>
            <span className="flex items-center gap-1 font-accent font-bold text-2xl leading-none whitespace-nowrap">
              {rank === 1 && entry.xp > 0 && (
                <StarIcon size={20} fill="var(--color-butter)" />
              )}
              {entry.xp}
              <span className="text-base text-pencil">xp</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default Leaderboard;
