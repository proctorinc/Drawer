/**
 * Watches the signed-in user's XP, achievements, stickers and weekly quests,
 * and queues a celebration for anything gained since they last looked.
 *
 * What was last seen lives in localStorage per user, so a gain made on
 * another device still plays here once, and reloading never replays one.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAnimationQueue } from './AnimationQueue';
import { diffProgress, parseSnapshot } from './progressDiff';
import type { QueryClient } from '@tanstack/react-query';
import type { ProgressInput } from './progressDiff';
import { useGetAchievements } from '@/api/Api';
import { useGetTrophies } from '@/api/trophies';
import { useEventRecap } from '@/api/events';

/** How often to look for gains while the tab is visible */
const POLL_MS = 30_000;

export function progressStorageKey(userId: string) {
  return `drawer:progress:${userId}`;
}

/**
 * Refetches everything the watcher looks at. Call after anything that can
 * earn XP or progress: submitting a doodle, reacting, commenting.
 */
export function refreshProgress(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['trophies'] }),
    queryClient.invalidateQueries({ queryKey: ['achievements'] }),
    // Your own event recap holds the week's quests while an event is live
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        queryKey[0] === 'events' && queryKey[2] === 'recap',
    }),
  ]);
}

/** refreshProgress bound to the app's query client */
export function useRefreshProgress() {
  const queryClient = useQueryClient();
  return useCallback(() => refreshProgress(queryClient), [queryClient]);
}

export default function useProgressWatcher(userId: string) {
  const queryClient = useQueryClient();
  const { enqueue, enqueueTicker } = useAnimationQueue();

  const trophies = useGetTrophies();
  const achievements = useGetAchievements();
  const questsEvent = trophies.data?.questsEvent ?? null;
  const recap = useEventRecap(questsEvent?.slug);

  // Poll while visible; focus refetches come from the query defaults
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshProgress(queryClient);
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [queryClient]);

  // The queue functions may not be stable; always call the latest
  const queue = useRef({ enqueue, enqueueTicker });
  queue.current = { enqueue, enqueueTicker };

  let quests: ProgressInput['quests'];
  if (trophies.data) {
    if (!questsEvent) {
      quests = {
        weekStart: trophies.data.week.start,
        quests: trophies.data.quests,
      };
    } else if (recap.data?.quests) {
      quests = {
        weekStart: recap.data.quests.week.start,
        quests: recap.data.quests.quests,
      };
    }
  }

  const input: ProgressInput = {
    level: trophies.data?.level,
    achievements: achievements.data?.achievements,
    quests,
  };
  const latest = useRef(input);
  latest.current = input;

  useEffect(() => {
    const current = latest.current;
    if (!current.level && !current.achievements && !current.quests) return;

    const key = progressStorageKey(userId);
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(key);
    } catch {
      // Storage blocked: every load counts as the first, so nothing plays
    }
    const { stage, ticker, next } = diffProgress(
      parseSnapshot(stored),
      current,
    );
    // Save before queueing, so a remount mid-way can't fire the same gains twice
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      return;
    }
    for (const item of stage) queue.current.enqueue(item);
    for (const item of ticker) queue.current.enqueueTicker(item);
  }, [
    userId,
    trophies.dataUpdatedAt,
    achievements.dataUpdatedAt,
    recap.dataUpdatedAt,
  ]);
}
