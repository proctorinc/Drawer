import { useEffect, useRef } from 'react';
import type { Cue } from './engine';

/**
 * Starts a timed cue when a component mounts and fades it out if the
 * component goes first (tapped away, skipped), so no sound outlives its
 * animation. (StrictMode's practice unmount in development cuts the first
 * one short and starts it again.)
 */
export function useCueWhileShown(start: () => Cue | null) {
  const startRef = useRef(start);
  const cueRef = useRef<Cue | null>(null);
  useEffect(() => {
    // Under StrictMode the first cleanup has already faded it: start afresh
    if (!cueRef.current || cueRef.current.isStopped) {
      cueRef.current = startRef.current();
    }
    return () => cueRef.current?.stop(0.25);
  }, []);
}
