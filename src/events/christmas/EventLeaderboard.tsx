import type { FC } from 'react';
import { useEventLeaderboard } from '@/api/events';
import useUser from '@/auth/hooks/useUser';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { cn } from '@/utils';

const MEDALS = ['bg-xmas-gold', 'bg-[#d9dde3]', 'bg-[#e0a46b]'];

type Props = {
  slug: string;
  className?: string;
};

/** You and your friends, ranked by event XP, then doodles drawn */
const EventLeaderboard: FC<Props> = ({ slug, className }) => {
  const me = useUser();
  const { data: entries } = useEventLeaderboard(slug);
  if (!entries?.length) return null;

  return (
    <ol className={cn('flex flex-col gap-2 w-full stagger', className)}>
      {entries.map((entry) => {
        // Players tied on doodles and XP share the rank of the first of them
        const rank = entries.findIndex(
          (e) => e.doodles === entry.doodles && e.xp === entry.xp,
        );
        // Sitting the event out isn't a placing
        const placed = entry.doodles > 0 || entry.xp > 0;
        return (
          <li
            key={entry.user.id}
            className={cn(
              'flex items-center gap-3 px-3 py-2 border-[1.5px] border-ink rounded-sketch-alt',
              entry.user.id === me.id ? 'bg-me' : 'bg-white',
            )}
          >
            <span
              className={cn(
                'flex flex-none items-center justify-center size-7 rounded-full border-[1.5px] border-ink font-accent font-bold',
                (placed && MEDALS[rank]) || 'bg-paper',
              )}
            >
              {placed ? rank + 1 : '–'}
            </span>
            <UserProfileIcon user={entry.user} size="sm" />
            <span className="flex-1 text-lg truncate">
              {entry.user.id === me.id ? 'you' : entry.user.username}
            </span>
            <span className="text-pencil whitespace-nowrap">
              <b className="font-accent font-bold text-xl text-ink">
                {entry.xp}
              </b>{' '}
              xp
              <span className="block text-right text-sm leading-none">
                {entry.doodles} {entry.doodles === 1 ? 'doodle' : 'doodles'}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default EventLeaderboard;
