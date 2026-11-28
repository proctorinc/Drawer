import { XMAS_COLORS, countdownDates } from '../useChristmas';
import type { FC } from 'react';
import type { ActiveEvent } from '@/api/events';
import { cn } from '@/utils';

type Props = {
  event: ActiveEvent;
  className?: string;
};

type BeadState = 'done' | 'today' | 'missed' | 'upcoming';

const BEAD_LOOK: Record<BeadState, string> = {
  done: 'size-2 border-[1.2px] border-ink',
  // No entrance zoom here: it would take over the animation from the glow
  today: 'size-3 bg-white border-2 border-xmas-red animate-beacon',
  missed: 'size-2 bg-white border-[1.2px] border-line',
  upcoming: 'size-1.5 bg-line',
};

/**
 * One bead per countdown day, strung on a thread that's inked up to today:
 * filled when drawn, a softly glowing red ring for today, a hollow ring for a
 * missed day, a small grey dot for one still to come, and a diamond at the end
 */
const OrnamentTally: FC<Props> = ({ event, className }) => {
  const dates = countdownDates(event);
  const drawn = new Set(event.progress.doodledDays);
  const todayIndex = event.dayNumber - 1;
  const lastIndex = dates.length - 1;

  const stateOf = (date: string, i: number): BeadState => {
    if (drawn.has(date)) return 'done';
    if (i === todayIndex) return 'today';
    return i < todayIndex ? 'missed' : 'upcoming';
  };

  return (
    <div
      role="img"
      aria-label={`${event.progress.count} of ${dates.length} doodles done`}
      className={cn(
        'relative flex items-center justify-between w-full h-4',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-1 top-1/2 h-px -mt-px bg-line/70"
      />
      <span
        aria-hidden="true"
        className="absolute left-1 top-1/2 h-[1.5px] -mt-px bg-ink/30 rounded-full"
        style={{
          width: `calc((100% - 0.5rem) * ${Math.min(todayIndex, lastIndex) / lastIndex})`,
        }}
      />
      {dates.map((date, i) => {
        const state = stateOf(date, i);
        const isLast = i === lastIndex;
        return (
          <span
            key={date}
            className={cn(
              'relative flex-none box-border',
              BEAD_LOOK[state],
              state !== 'today' && 'animate-in zoom-in-0 fill-mode-both',
              isLast
                ? 'size-2.5 rotate-45 rounded-[2px]'
                : 'rounded-full',
              isLast &&
                state === 'upcoming' &&
                'bg-white border-[1.5px] border-xmas-gold',
            )}
            style={{
              backgroundColor:
                state === 'done'
                  ? isLast
                    ? 'var(--color-xmas-gold)'
                    : XMAS_COLORS[i % XMAS_COLORS.length]
                  : undefined,
              animationDelay: state === 'today' ? undefined : `${i * 18}ms`,
            }}
          />
        );
      })}
    </div>
  );
};

export default OrnamentTally;
