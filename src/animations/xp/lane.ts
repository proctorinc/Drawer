import { useState, useSyncExternalStore } from 'react';

/**
 * Where the XP popdown's bottom edge currently sits (px from the top of the
 * viewport), so ticker pings can slide in under it instead of overlapping.
 * 0 when no popdown is showing.
 */
let popdownBottom = 0;
const listeners = new Set<() => void>();

export function setPopdownBottom(px: number): void {
  if (px === popdownBottom) return;
  popdownBottom = px;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePopdownBottom(): number {
  return useSyncExternalStore(
    subscribe,
    () => popdownBottom,
    () => 0,
  );
}

/**
 * Whether the user asked for less motion, read once when the animation
 * mounts so a mid-play change doesn't restart it
 */
export function useReducedMotion(): boolean {
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  return reduced;
}
