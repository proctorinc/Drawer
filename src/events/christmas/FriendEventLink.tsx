import { Link } from '@tanstack/react-router';
import { useChristmas } from '../useChristmas';
import { TreeIcon, candyCaneTape } from './Decorations';
import OrnamentTally from './OrnamentTally';
import type { FC } from 'react';
import type { User } from '@/api/Api';
import { useEventRecap } from '@/api/events';

type Props = { user: User };

/** On someone's profile: a jump to their event page, previewing how far they've got */
const FriendEventLink: FC<Props> = ({ user }) => {
  const christmas = useChristmas();
  const { data: recap } = useEventRecap(christmas?.slug, user.id);
  if (!christmas || !recap) return null;

  const { progress, countdownDays } = recap.event;

  return (
    <Link
      to="/draw/event/$slug"
      params={{ slug: christmas.slug }}
      search={{ user: user.id }}
      className="press relative flex flex-col gap-2 w-full px-4 pt-4 pb-3 bg-white border-2 border-ink rounded-sketch shadow-pencil hover:-rotate-1 animate-rise"
    >
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-6 w-16 h-5 border border-ink/20 -rotate-3"
        style={{ background: candyCaneTape() }}
      />
      <span className="flex items-center gap-3">
        <TreeIcon size={26} className="flex-none text-ink" />
        <span className="flex flex-col flex-1 min-w-0 leading-tight">
          <span className="font-accent font-bold text-2xl truncate">
            {user.username}'s christmas
          </span>
          <span className="text-pencil">
            {countdownDays
              ? `${progress.count} of ${countdownDays} ornaments`
              : `${progress.count} doodles this event`}
            {recap.stats.longestStreak > 1 &&
              ` · best streak ${recap.stats.longestStreak}`}
          </span>
        </span>
        <span aria-hidden="true" className="font-accent font-bold text-2xl">
          →
        </span>
      </span>
      {countdownDays && <OrnamentTally event={recap.event} />}
    </Link>
  );
};

export default FriendEventLink;
