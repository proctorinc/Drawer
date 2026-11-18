import { Link } from '@tanstack/react-router';
import { countdownCopy } from '../useChristmas';
import ChristmasTree from './ChristmasTree';
import EventBadge from './EventBadge';
import EventLeaderboard from './EventLeaderboard';
import EventSticker from './EventSticker';
import type { FC, ReactNode } from 'react';
import type { Achievement } from '@/api/Api';
import type { ActiveEvent } from '@/api/events';

const Section: FC<{
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}> = ({ title, aside, children }) => (
  <section className="flex flex-col gap-3 w-full">
    <div className="flex items-end justify-between gap-2">
      <h2 className="font-accent font-bold text-[28px] leading-none">
        {title}
      </h2>
      {aside && <span className="text-pencil">{aside}</span>}
    </div>
    {children}
  </section>
);

type Props = {
  event: ActiveEvent;
  /** This event's stickers, earned or not */
  stickers: Array<Achievement>;
};

/** Trophies while Christmas is on: everything about your progress in the event */
const ChristmasTrophies: FC<Props> = ({ event, stickers }) => {
  const copy = countdownCopy(event);
  const countdownOver =
    event.countdownDays !== null && event.dayNumber > event.countdownDays;
  const earned = stickers.filter((sticker) => sticker.achievedAt).length;

  return (
    <>
      <section className="flex flex-col items-center gap-3 w-full pt-2">
        <EventBadge days={event.countdownDays ?? event.dayNumber} />
        <p className="text-lg text-pencil">
          {copy.day} · {copy.left}
        </p>
      </section>

      {event.countdownDays && (
        <Section
          title="your tree"
          aside={`${event.progress.count} of ${event.countdownDays} ornaments`}
        >
          <ChristmasTree event={event} className="self-center" />
          <p className="-mt-1 text-center text-pencil">
            every doodle hangs another ornament
          </p>
        </Section>
      )}

      {stickers.length > 0 && (
        <Section
          title="christmas stickers"
          aside={`${earned}/${stickers.length} collected`}
        >
          <ul className="flex justify-around gap-2 w-full p-4 bg-white border-2 border-ink rounded-sketch shadow-pencil stagger">
            {stickers.map((sticker) => (
              <li
                key={sticker.id}
                className="flex flex-col items-center gap-1 w-24 text-center text-sm leading-tight"
              >
                <EventSticker
                  achievement={sticker}
                  locked={!sticker.achievedAt}
                  className="w-12 h-13"
                />
                <span className={sticker.achievedAt ? '' : 'text-pencil'}>
                  {sticker.name}
                </span>
                {!sticker.achievedAt && (
                  <span className="text-xs text-pencil">
                    {Math.min(sticker.progress, sticker.achievementValue)}/
                    {sticker.achievementValue}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="christmas standings" aside="doodles drawn">
        <EventLeaderboard slug={event.slug} />
      </Section>

      <Link
        to="/draw/event/$slug"
        params={{ slug: event.slug }}
        className="press inline-flex items-center gap-2 h-11 px-4 bg-white border-2 border-ink rounded-sketch shadow-pencil-sm font-accent font-bold text-xl"
      >
        {countdownOver ? 'see your recap' : 'see your christmas so far'}
      </Link>
    </>
  );
};

export default ChristmasTrophies;
