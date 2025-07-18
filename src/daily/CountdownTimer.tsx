import useAuth from '@/auth/hooks/useAuth';
import { cn } from '@/utils';
import { useEffect, useState, type FC } from 'react';

type Props = {
  className?: string;
};

export const CountDownTimer: FC<Props> = ({ className }) => {
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

  return (
    <div className="bg-gradient-to-br from-base via-secondary to-primary bg-clip-text">
      <span className={cn('text-transparent', className)}>
        {formatTime(time)}
      </span>
    </div>
  );
};
