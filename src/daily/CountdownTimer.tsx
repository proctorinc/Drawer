import { useState, useEffect } from 'react';

export const CountDownTimer = () => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const timeRemaining = Math.floor((nextMidnight.getTime() - now.getTime()) / 1000); // Time in seconds
      setTime(timeRemaining);
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
    <div>
      <h1 className="text-2xl font-bold">{formatTime(time)}</h1>
    </div>
  );
};