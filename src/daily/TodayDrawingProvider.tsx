import { useEffect } from 'react';
import { useDailyPrompt } from './DailyPromptContext';
import type { FC, ReactNode } from 'react';
import { DrawingProvider } from '@/drawing/DrawingContext';

const PREFIX = 'DRAWING_SUBMISSION_';

/**
 * The drawing for today's prompt. Each day keeps its own unfinished drawing,
 * so a doodle you never pinned doesn't turn up on tomorrow's page.
 */
export const TodayDrawingProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { dailyPrompt } = useDailyPrompt();
  const day = dailyPrompt?.day;
  const storageKey = `${PREFIX}${day ?? 'pending'}`;

  // Earlier days' drafts can't be submitted any more
  useEffect(() => {
    if (!day) return;
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(PREFIX) && key !== storageKey)
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage blocked: nothing to tidy
    }
  }, [day, storageKey]);

  // A new key is a new day: start the drawing over rather than carry it across
  return (
    <DrawingProvider key={storageKey} localStorageKey={storageKey}>
      {children}
    </DrawingProvider>
  );
};
