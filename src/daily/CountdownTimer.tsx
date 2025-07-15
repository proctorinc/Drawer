import useAuth from '@/auth/hooks/useAuth';
import { useEffect, useState } from 'react';

export const CountDownTimer = () => {
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

  return <>{formatTime(time)}</>;
};
