import { Link } from '@tanstack/react-router';
import { countdownCopy } from '../useChristmas';
import EventBadge from './EventBadge';
import EventLeaderboard from './EventLeaderboard';
import OrnamentTally from './OrnamentTally';
import type { FC } from 'react';
import type { ActiveEvent } from '@/api/events';

type Props = { event: ActiveEvent };

/** The live Christmas event on Trophies: badge, progress, standings, recap */
const ChristmasEventCard: FC<Props> = ({ event }) => {
  const copy = countdownCopy(event);

  return (
    <section className="flex flex-col items-center gap-4 w-full pt-2">
      <EventBadge days={event.countdownDays ?? event.dayNumber} />
      <p className="text-lg text-pencil">
        {copy.day} · {copy.left}
      </p>
      {event.countdownDays && <OrnamentTally event={event} />}
      <div className="flex justify-between items-end w-full pt-2">
        <h2 className="font-accent font-bold text-[28px] leading-none">
          christmas standings
        </h2>
        <span className="text-pencil">doodles drawn</span>
      </div>
      <EventLeaderboard slug={event.slug} />
      <Link
        to="/draw/event/$slug"
        params={{ slug: event.slug }}
        className="press inline-flex items-center gap-2 h-11 px-4 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm font-accent font-bold text-xl"
      >
        {event.countdownDays && event.dayNumber > event.countdownDays
          ? 'see your recap'
          : 'see your christmas so far'}
      </Link>
    </section>
  );
};

export default ChristmasEventCard;
