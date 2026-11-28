import { GrinchHead } from './GrinchOutline';
import type { GrinchHeadState } from './GrinchOutline';
import type { FC } from 'react';
import type { ActiveEvent, GrinchDay } from '@/api/events';
import { cn } from '@/utils';

const shortDate = (day: string) =>
  new Date(`${day}T00:00:00Z`)
    .toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    .toLowerCase();

/** The event's day (YYYY-MM-DD) as it stands now, on its own clock */
const eventToday = (event: ActiveEvent) =>
  new Date(Date.parse(event.startsAt) + (event.dayNumber - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

type Props = {
  event: ActiveEvent;
  days: Array<GrinchDay>;
  className?: string;
};

/**
 * A head for each day the Grinch judges, filling in with whose side you took:
 * his grinning face if you joined him, a heart if you turned him down. Shows up
 * once his first day comes around.
 */
const GrinchDays: FC<Props> = ({ event, days, className }) => {
  const today = eventToday(event);
  if (days.length === 0 || days[0].day > today) return null;

  const picked = days.filter((d) => d.joined !== null).length;

  const look = (d: GrinchDay): [GrinchHeadState, string] => {
    if (d.joined === true) return ['joined', 'joined him'];
    if (d.joined === false) return ['refused', 'turned him down'];
    if (d.day === today) return ['empty', 'pick a side'];
    if (d.day < today) return ['empty', 'sat it out'];
    return ['empty', 'coming up'];
  };

  return (
    <section className={cn('flex flex-col gap-3 w-full', className)}>
      <div className="flex items-end justify-between gap-2">
        <h2 className="font-accent font-bold text-[28px] leading-none">
          grinch days
        </h2>
        <span className="text-pencil">
          {picked} of {days.length} picked
        </span>
      </div>
      <ul
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        {days.map((d) => {
          const [state, label] = look(d);
          const isToday = d.day === today && d.joined === null;
          return (
            <li
              key={d.day}
              className="flex flex-col items-center gap-1 text-center"
            >
              <GrinchHead
                state={state}
                color={isToday ? 'var(--color-xmas-red)' : undefined}
                className={cn(
                  'w-full max-w-14 h-16',
                  isToday && 'animate-breathe',
                )}
              />
              <span className="font-accent font-bold text-lg leading-none">
                {shortDate(d.day)}
              </span>
              <span
                className={cn(
                  'text-sm leading-tight',
                  d.joined === null && 'text-pencil',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default GrinchDays;
