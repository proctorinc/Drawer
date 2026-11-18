import { useDailyPrompt } from './DailyPromptContext';
import type { UserPromptSubmission } from '@/api/Api';
import useUser from '@/auth/hooks/useUser';

/**
 * Whether a drawing should stay hidden from you: it's someone else's take on
 * today's prompt and you haven't drawn yours yet. Past days are always open.
 */
export function useIsDrawingLocked() {
  const user = useUser();
  const { dailyPrompt } = useDailyPrompt();

  return (submission: Pick<UserPromptSubmission, 'day' | 'user'>) =>
    !!dailyPrompt &&
    !dailyPrompt.isCompleted &&
    submission.user.id !== user.id &&
    // Compare dates only, in case one side carries a time
    submission.day.slice(0, 10) === dailyPrompt.day.slice(0, 10);
}
