import useAuth from '@/auth/hooks/useAuth';
import { cn } from '@/utils';
import { useEffect, useState, type FC } from 'react';

type Props = {
  className?: string;
  /** clock: 08:12:44, short: 8h 12m */
  format?: 'clock' | 'short';
};

export const CountDownTimer: FC<Props> = ({ className, format = 'clock' }) => {
  const [time, setTime] = useState(0);
  const { reloadUser } = useAuth();

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const nextMidnightUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0,
          0,
          0,
        ),
      );
      const timeRemaining = Math.floor(
        (nextMidnightUTC.getTime() - now.getTime()) / 1000,
      ); // Time in seconds
      if (timeRemaining < 0) {
        reloadUser();
      } else {
        setTime(timeRemaining);
      }
    };

    calculateTimeRemaining(); // Initial calculation

    const interval = setInterval(() => {
      setTime((prevTime) => {
        if (prevTime <= 0) {
          clearInterval(interval);
          return 0; // Stop the timer when it reaches zero
        }
        return prevTime - 1; // Decrement the time
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format time as HH:MM:SS
  const formatTime = (seconds: number) => {
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  };

  const formatShort = (seconds: number) =>
    `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

  return (
    <span className={cn('tabular-nums', className)}>
      {format === 'short' ? formatShort(time) : formatTime(time)}
    </span>
  );
};
