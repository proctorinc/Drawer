import { XMAS_COLORS, countdownDates } from '../useChristmas';
import type { FC } from 'react';
import type { ActiveEvent } from '@/api/events';
import { cn } from '@/utils';

type Props = {
  event: ActiveEvent;
  className?: string;
};

/** One dot per countdown day: filled when drawn, twinkling for today */
const OrnamentTally: FC<Props> = ({ event, className }) => {
  const dates = countdownDates(event);
  const drawn = new Set(event.progress.doodledDays);
  const todayIndex = event.dayNumber - 1;

  return (
    <div
      role="img"
      aria-label={`${event.progress.count} of ${dates.length} doodles done`}
      className={cn(
        'flex items-center justify-between w-full h-3.5',
        className,
      )}
    >
      {dates.map((date, i) => {
        const isLast = i === dates.length - 1;
        const isDone = drawn.has(date);
        const isToday = i === todayIndex && !isDone;
        return (
          <span
            key={date}
            className={cn(
              'box-border animate-in zoom-in-0 fill-mode-both',
              isLast
                ? 'size-3 rotate-45 rounded-[2px]'
                : 'size-[9px] rounded-full',
              isDone && 'border-[1.2px] border-ink',
              isToday &&
                'bg-white border-[1.8px] border-xmas-red animate-twinkle',
              !isDone && !isToday && 'border-[1.2px] border-dashed border-line',
            )}
            style={{
              backgroundColor: isDone
                ? isLast
                  ? 'var(--color-xmas-gold)'
                  : XMAS_COLORS[i % XMAS_COLORS.length]
                : undefined,
              animationDelay: `${i * 18}ms`,
            }}
          />
        );
      })}
    </div>
  );
};

export default OrnamentTally;
