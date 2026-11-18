import type { FC } from 'react';
import Chip from '@/components/Chip';
import { ClockIcon } from '@/components/icons';
import { cn } from '@/utils';

type SeasonalEvent = {
  name: string;
  blurb: string;
  /** Inclusive MM-DD range within one year */
  from: string;
  to: string;
  className: string;
};

// Flavor only for now: nothing here is tracked or rewarded by the server
const events: Array<SeasonalEvent> = [
  {
    name: 'New Year, New Doodles',
    blurb: 'Start the year with a streak. Future you is watching.',
    from: '01-01',
    to: '01-14',
    className: 'bg-sky',
  },
  {
    name: 'Love Letters',
    blurb:
      "Draw something sweet for a friend. Or something weird. They'll know.",
    from: '02-07',
    to: '02-14',
    className: 'bg-blush',
  },
  {
    name: 'Spooky Scribbles',
    blurb: 'Every prompt is secretly a haunted prompt. Add a ghost.',
    from: '10-20',
    to: '10-31',
    className: 'bg-[#e6dcff]',
  },
  {
    name: 'Doodlevember',
    blurb: 'Draw every day this month and let your streak do the bragging.',
    from: '11-01',
    to: '11-30',
    className: 'bg-butter',
  },
  {
    name: 'Festive Scribbles',
    blurb: 'Hide a tiny snowman in every drawing. Friends get to find it.',
    from: '12-01',
    to: '12-31',
    className: 'bg-[#d8f0dc]',
  },
];

const monthDay = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function daysLeft(now: Date, to: string) {
  const [month, day] = to.split('-').map(Number);
  const end = new Date(now.getFullYear(), month - 1, day + 1);
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

const EventBanner: FC = () => {
  const now = new Date();
  const today = monthDay(now);
  const event = events.find((e) => e.from <= today && today <= e.to);
  if (!event) return null;

  const remaining = daysLeft(now, event.to);

  return (
    <section
      className={cn(
        'relative flex flex-col gap-1 w-full px-4 pt-5 pb-4 border-2 border-ink rounded-sketch-alt shadow-pencil rotate-[-1deg]',
        event.className,
      )}
    >
      <span className="absolute -top-3 left-4 px-2 bg-coral text-white text-sm border-2 border-ink rounded-sketch -rotate-3">
        special event
      </span>
      <h2 className="font-accent font-bold text-[30px] leading-none">
        {event.name}
      </h2>
      <p className="text-pencil leading-snug">{event.blurb}</p>
      <Chip className="self-start mt-1">
        <ClockIcon size={14} />
        {remaining <= 1 ? 'last day!' : `${remaining} days left`}
      </Chip>
    </section>
  );
};

export default EventBanner;
