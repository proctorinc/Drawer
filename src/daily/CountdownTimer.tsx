import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FC } from 'react';
import { cn } from '@/utils';

type Props = {
  className?: string;
  /** clock: 08:12:44, short: 8h 12m */
  format?: 'clock' | 'short';
  /** Give every character its own fixed-width cell, so nothing shifts as it ticks */
  monospace?: boolean;
};

/** Seconds until the next prompt, which drops at midnight UTC */
function secondsUntilNextPage() {
  const now = new Date();
  const nextMidnightUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.ceil((nextMidnightUTC - now.getTime()) / 1000);
}

const pad = (n: number) => String(n).padStart(2, '0');

const formatClock = (seconds: number) =>
  `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;

const formatShort = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

export const CountDownTimer: FC<Props> = ({
  className,
  format = 'clock',
  monospace,
}) => {
  const queryClient = useQueryClient();
  const [seconds, setSeconds] = useState(secondsUntilNextPage);

  useEffect(() => {
    let previous = secondsUntilNextPage();
    // Re-read the clock every tick rather than counting down, since phones
    // pause timers in background tabs and a countdown would fall behind
    const interval = setInterval(() => {
      const remaining = secondsUntilNextPage();
      // Wrapped past midnight: it's a new page, so refetch everything
      if (remaining > previous) queryClient.invalidateQueries();
      previous = remaining;
      setSeconds(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const text = format === 'short' ? formatShort(seconds) : formatClock(seconds);

  if (monospace) {
    return (
      <span
        aria-label={text}
        role="timer"
        className={cn('inline-flex', className)}
      >
        {[...text].map((char, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              'inline-block text-center',
              /\d/.test(char) ? 'w-[0.62em]' : 'w-[0.32em]',
            )}
          >
            {char}
          </span>
        ))}
      </span>
    );
  }

  return <span className={cn('tabular-nums', className)}>{text}</span>;
};
