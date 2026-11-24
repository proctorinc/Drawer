import { useEffect, useRef } from 'react';
import { useDailyPrompt } from './DailyPromptContext';
import { clearOldDrafts, draftKey } from './drafts';
import type { FC, ReactNode } from 'react';
import { useStartDailyDrawing } from '@/api/Api';
import { DrawingProvider, useDrawing } from '@/drawing/DrawingContext';

/**
 * Tells the server the first time there's ink on today's doodle, so it can be
 * finished tomorrow if the prompt rolls over first. Once per day per device;
 * a failed try goes again on the next stroke.
 */
const StartMarker: FC<{ day: string }> = ({ day }) => {
  const { hasInk } = useDrawing();
  const { mutate, isPending } = useStartDailyDrawing();
  const marked = useRef(false);

  useEffect(() => {
    if (!hasInk || marked.current || isPending) return;
    marked.current = true;
    mutate(undefined, {
      onError: () => {
        marked.current = false;
      },
    });
  }, [hasInk, isPending, mutate]);

  // A new day is a new doodle to mark
  useEffect(() => {
    marked.current = false;
  }, [day]);

  return null;
};

/**
 * The drawing for today's prompt. Each day keeps its own unfinished drawing,
 * so a doodle you never pinned doesn't turn up on tomorrow's page; yesterday's
 * waits on its own page (/draw/finish) until it's pinned or too old.
 */
export const TodayDrawingProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { dailyPrompt } = useDailyPrompt();
  const day = dailyPrompt?.day;
  const storageKey = draftKey(day);

  useEffect(() => {
    if (day) clearOldDrafts(day);
  }, [day]);

  // A new key is a new day: start the drawing over rather than carry it across
  return (
    <DrawingProvider key={storageKey} localStorageKey={storageKey}>
      {day && !dailyPrompt.isCompleted && <StartMarker day={day} />}
      {children}
    </DrawingProvider>
  );
};
