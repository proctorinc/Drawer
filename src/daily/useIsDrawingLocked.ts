import { useDailyPrompt } from './DailyPromptContext';
import { useUnfinishedDoodle } from './useUnfinishedDoodle';
import type { UserPromptSubmission } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';

/**
 * Whether a drawing should stay hidden from you: it's someone else's take on
 * today's prompt and you haven't drawn yours yet, or yesterday's while you're
 * still finishing yours. Other past days are always open.
 */
export function useIsDrawingLocked() {
  const user = useUser();
  const { dailyPrompt } = useDailyPrompt();
  const unfinished = useUnfinishedDoodle();

  return (submission: Pick<UserPromptSubmission, 'day' | 'user'>) => {
    if (submission.user.id === user.id) return false;
    // Compare dates only, in case one side carries a time
    const day = submission.day.slice(0, 10);
    if (unfinished && day === unfinished.day.slice(0, 10)) return true;
    return (
      !!dailyPrompt &&
      !dailyPrompt.isCompleted &&
      day === dailyPrompt.day.slice(0, 10)
    );
  };
}
