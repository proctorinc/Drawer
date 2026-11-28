import { useDailyPrompt } from './DailyPromptContext';
import { useUnfinishedDoodle } from './useUnfinishedDoodle';
import type { UserPromptSubmission } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';

/**
 * Whether a drawing should stay hidden from you: it's someone else's take on
 * a day you can still draw. The server marks those `locked` (today's until
 * you've drawn it, a missed day you can redo); today's and the one you're
 * finishing late are also caught here, so they lock the moment the day turns.
 */
export function useIsDrawingLocked() {
  const user = useUser();
  const { dailyPrompt } = useDailyPrompt();
  const unfinished = useUnfinishedDoodle();

  return (
    submission: Pick<UserPromptSubmission, 'day' | 'user' | 'locked'>,
  ) => {
    if (submission.user.id === user.id) return false;
    if (submission.locked) return true;
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
