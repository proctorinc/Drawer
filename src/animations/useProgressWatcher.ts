/**
 * Watches the signed-in user's XP, achievements, stickers and weekly quests,
 * and queues a celebration for anything gained since they last looked.
 *
 * Earning an achievement or sticker plays once per account: the server says
 * which haven't been celebrated yet, and we tell it once one has played (or
 * been dismissed). XP, rank and progress pings go by what this device last
 * saw, kept in localStorage per user, so reloading never replays one.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAnimationQueue } from './AnimationQueue';
import { diffProgress, parseSnapshot } from './progressDiff';
import type { QueryClient } from '@tanstack/react-query';
import type { ProgressInput } from './progressDiff';
import type { StageItem, StagePayloads } from './types';
import { useGetAchievements } from '@/api/Api';
import { useGetTrophies } from '@/api/trophies';
import { useEventRecap } from '@/api/events';
import { apiClient } from '@/api/apiClient';

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

/**
 * Call after switching accounts (impersonating, or going back). Progress the
 * cache still holds belongs to the account you just left; if the watcher
 * read it as this account's, everything one has and the other doesn't would
 * look newly earned. Drops it before refetching everything else.
 */
export async function switchAccount(queryClient: QueryClient) {
  await Promise.all([
    queryClient.resetQueries({
      predicate: ({ queryKey }) =>
        queryKey[0] === 'trophies' ||
        queryKey[0] === 'achievements' ||
        (queryKey[0] === 'events' && queryKey[2] === 'recap'),
    }),
    queryClient.invalidateQueries(),
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

  // Achievements queued here, or played and acknowledged but not refetched
  // since, so a poll in between doesn't queue them again
  const pending = useRef(new Set<string>());

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
      { pending: pending.current },
    );
    // Save before queueing, so a remount mid-way can't fire the same gains twice
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      return;
    }
    for (const item of stage) {
      const done = queue.current.enqueue(item);
      const id = celebratedAchievementId(item);
      if (!id) continue;
      pending.current.add(id);
      void done.then(async (outcome) => {
        // It never got on stage; try again on the next refresh
        if (outcome === 'skipped') {
          pending.current.delete(id);
          return;
        }
        try {
          await apiClient.markAchievementsCelebrated([id]);
        } catch (error) {
          // Stays pending, so it won't replay this session; the server still
          // has it uncelebrated, so it plays once more next time
          console.warn('Could not mark achievement celebrated', id, error);
        }
      });
    }
    for (const item of ticker) queue.current.enqueueTicker(item);
  }, [
    userId,
    trophies.dataUpdatedAt,
    achievements.dataUpdatedAt,
    recap.dataUpdatedAt,
  ]);
}

/** The achievement or sticker a stage item celebrates earning, if any */
function celebratedAchievementId(item: StageItem): string | undefined {
  if (item.kind !== 'completed') return undefined;
  const payload = item.payload as StagePayloads['completed'];
  return payload.kind === 'quest' ? undefined : payload.achievement.id;
}
