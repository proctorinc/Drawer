import { useDailyPrompt } from './DailyPromptContext';
import { hasDraft } from './drafts';
import type { DailyPrompt } from '@/api/Api';
import { useGetUnfinishedPrompt } from '@/api/Api';

/**
 * Yesterday's prompt, if the rollover caught you mid-doodle: the server saw
 * you start it in time, you haven't pinned it, and the drawing is on this
 * device. Undefined otherwise.
 */
export function useUnfinishedDoodle(): DailyPrompt | undefined {
  const { dailyPrompt } = useDailyPrompt();
  // Only worth asking once today's prompt is known; a new day asks again
  const { data } = useGetUnfinishedPrompt(!!dailyPrompt);
  if (!data || !dailyPrompt) return undefined;
  if (data.day.slice(0, 10) === dailyPrompt.day.slice(0, 10)) return undefined;
  return hasDraft(data.day) ? data : undefined;
}
