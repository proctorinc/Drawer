import type { FC } from 'react';
import type { UpcomingEvent } from '@/api/events';
import { useUpcomingEvent } from '@/api/events';
import useAuth from '@/auth/hooks/useAuth';
import Lights from '@/events/christmas/Lights';
import { cn } from '@/utils';

const DAY_MS = 86_400_000;

/** Whole UTC days from today until the event's first day (events run on UTC days) */
function daysUntil(startsAt: string, now = new Date()) {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const start = new Date(startsAt).getTime();
  return Math.max(1, Math.ceil((start - today) / DAY_MS));
}

// Fixed flakes so they don't jump around on re-render
const FLAKES = [
  { left: 8, top: 22, size: 10 },
  { left: 22, top: 62, size: 7 },
  { left: 44, top: 40, size: 8 },
  { left: 58, top: 66, size: 9 },
  { left: 80, top: 30, size: 7 },
  { left: 92, top: 64, size: 10 },
];

/**
 * A wrapped present teasing Christmas before it starts: when, and nothing
 * else. What's inside stays a surprise until the event is live.
 */
type TeaserProps = {
  event: UpcomingEvent;
  className?: string;
  /** Sharing a row with another card: tighter type and gift tag */
  compact?: boolean;
};

const ChristmasTeaser: FC<TeaserProps> = ({ event, className, compact }) => {
  const days = daysUntil(event.startsAt);

  return (
    <section
      aria-label={`${event.name} is coming`}
      className={cn('relative w-full -rotate-1 animate-drop', className)}
    >
      <div className="relative overflow-hidden bg-xmas-red border-[2.5px] border-ink rounded-sketch-alt">
        {/* Gold ribbon, both ways, like a wrapped gift, crossing under the tag */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-[42px] w-4 bg-xmas-gold border-x-2 border-ink"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-2 h-3 bg-xmas-gold border-y-2 border-ink"
        />
        {FLAKES.map((flake, i) => (
          <svg
            key={i}
            aria-hidden="true"
            width={flake.size}
            height={flake.size}
            viewBox="0 0 12 12"
            className="absolute animate-pulse"
            style={{
              left: `${flake.left}%`,
              top: `${flake.top}%`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            <path
              d="M6 1v10M1.7 3.5l8.6 5M1.7 8.5l8.6-5"
              stroke="white"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </svg>
        ))}

        <Lights bulbs={11} className="-mt-1 -mb-2" />

        <div
          className={cn(
            'relative flex items-center pb-7',
            compact ? 'gap-2 px-3' : 'gap-3 px-4',
          )}
        >
          <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
            <span className="px-1.5 bg-white text-xmas-green text-[11px] font-bold uppercase tracking-[2px] border-2 border-ink rounded-sketch -rotate-2">
              coming soon
            </span>
            <h2
              className={cn(
                'font-accent font-bold leading-none text-white',
                compact ? 'text-[24px]' : 'text-[30px]',
              )}
            >
              {event.name}
            </h2>
          </div>

          {/* Gift tag with the countdown */}
          <div
            className={cn(
              'relative flex-none flex flex-col items-center px-1.5 pt-3.5 pb-1.5 bg-paper border-2 border-ink rounded-[6px_6px_12px_12px] rotate-6',
              compact ? 'w-[64px]' : 'w-[76px]',
            )}
          >
            <span
              aria-hidden="true"
              className="absolute top-1 left-1/2 -ml-1 size-2.5 rounded-full border-2 border-ink bg-xmas-red"
            />
            <span
              className={cn(
                'font-accent font-bold leading-none text-xmas-red tabular-nums',
                compact ? 'text-[24px]' : 'text-[28px]',
              )}
            >
              {days}
            </span>
            <span className="text-xs text-pencil leading-tight whitespace-nowrap">
              {days === 1 ? 'day' : 'days'} to go
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

/** A plain teaser for any other kind of event */
const GenericTeaser: FC<TeaserProps> = ({ event, className }) => {
  const sleeps = daysUntil(event.startsAt);
  return (
    <section
      className={cn(
        'flex flex-col gap-1 w-full px-4 py-3 bg-white border-2 border-ink rounded-sketch-alt -rotate-1',
        className,
      )}
    >
      <span className="text-sm uppercase tracking-[2px] text-pencil">
        coming soon
      </span>
      <h2 className="font-accent font-bold text-2xl leading-none">
        {event.name}
      </h2>
      <p className="text-pencil">
        starts in {sleeps} {sleeps === 1 ? 'day' : 'days'}
      </p>
    </section>
  );
};

/** Announces the next event shortly before it starts; nothing otherwise */
const ComingSoonCard: FC<{ className?: string; compact?: boolean }> = ({
  className,
  compact,
}) => {
  const { isAuthenticated } = useAuth();
  const { data: event } = useUpcomingEvent(isAuthenticated);
  if (!event) return null;

  return event.theme === 'christmas' ? (
    <ChristmasTeaser event={event} className={className} compact={compact} />
  ) : (
    <GenericTeaser event={event} className={className} compact={compact} />
  );
};

export default ComingSoonCard;
