import ProgressBar from './ProgressBar';
import type { FC } from 'react';
import type { Achievement } from '@/api/Api';
import { isOneShot } from '@/achievements/oneShot';
import { cn } from '@/utils';

/** The count beside an unearned achievement's name: 3/10, or your best on a one-shot */
export const AchievementCount: FC<{
  achievement: Achievement;
  className?: string;
}> = ({ achievement, className }) => {
  const { progress, achievementValue: goal } = achievement;
  if (isOneShot(achievement)) {
    return (
      <span
        className={cn(
          'font-accent font-bold text-lg leading-none whitespace-nowrap text-pencil',
          className,
        )}
      >
        {progress > 0 ? `best ${progress}` : 'no tries yet'}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'font-accent font-bold text-lg leading-none whitespace-nowrap',
        className,
      )}
    >
      {Math.min(progress, goal)}/{goal}
    </span>
  );
};

/**
 * An unearned achievement's bar. A one-shot (score a 9 with a judge) isn't
 * filled up bit by bit, so its bar is a muted record of your best, not progress.
 */
export const AchievementBar: FC<{
  achievement: Achievement;
  /** Fill for progress you're building on; one-shots are always muted */
  fill?: string;
}> = ({ achievement, fill }) => {
  const { progress, achievementValue: goal } = achievement;
  if (isOneShot(achievement)) {
    return (
      <ProgressBar
        value={progress}
        max={goal}
        label={`${achievement.name}: best ${progress}, needs ${goal}`}
        fill="bg-line"
        className="h-3 border-pencil/60"
      />
    );
  }
  return (
    <ProgressBar
      value={progress}
      max={goal}
      label={`${achievement.name} progress`}
      fill={fill}
      className="h-3"
    />
  );
};

/** How near done an unearned achievement is, for sorting; one-shots don't count */
export const completion = (a: Achievement) =>
  a.achievementValue > 0 && !isOneShot(a) ? a.progress / a.achievementValue : 0;
