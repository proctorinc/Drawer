import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the out animations in completed.css run */
const EXIT_MS = 220;

/**
 * Plays an exit, then calls onDone exactly once no matter how many ways the
 * item is dismissed (button, backdrop, Escape, timer, navigation).
 */
export function useStageExit(onDone: () => void) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Animate out, then finish */
  const exit = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    timer.current = setTimeout(() => onDoneRef.current(), EXIT_MS);
  }, []);

  /** Finish right away, for when we're navigating elsewhere */
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onDoneRef.current();
  }, []);

  // Escape dismisses, like tapping away
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit]);

  return { leaving, exit, finish };
}
