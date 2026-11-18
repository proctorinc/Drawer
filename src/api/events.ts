import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from './apiClient';
import type { User, UserPromptSubmission } from './Api';

export type EventTheme = 'christmas';

export interface EventProgress {
  /** YYYY-MM-DD days the signed-in user drew during the event, ascending */
  doodledDays: Array<string>;
  count: number;
}

export interface ActiveEvent {
  slug: string;
  name: string;
  theme: EventTheme | (string & {});
  startsAt: string;
  /** The moment the event stops (exclusive), not its last day */
  endsAt: string;
  /** 1 on the first day */
  dayNumber: number;
  /** Length of the countdown, e.g. 29 days to Christmas; null if none */
  countdownDays: number | null;
  /** 0 on the countdown's last day and after it */
  daysUntilCountdownEnd: number | null;
  progress: EventProgress;
  /** Extra reaction ids allowed while the event is live */
  reactions: Array<string>;
}

export interface EventLeaderboardEntry {
  user: User;
  doodles: number;
  reactionsReceived: number;
}

export interface EventRecap {
  /** Whose recap this is */
  user: User;
  event: ActiveEvent;
  submissions: Array<UserPromptSubmission>;
  stats: { doodles: number; reactionsReceived: number; longestStreak: number };
}

export const eventKeys = {
  active: ['events', 'active'] as const,
  leaderboard: (slug: string) => ['events', slug, 'leaderboard'] as const,
  recap: (slug: string, userId?: string) =>
    ['events', slug, 'recap', userId ?? 'me'] as const,
};

async function getJSON<T>(endpoint: string): Promise<T> {
  const response = await fetchAPI('GET', endpoint);
  if (!response.ok) {
    throw new Error(`Failed to load ${endpoint}`);
  }
  return response.json();
}

export function useActiveEvent(enabled = true) {
  return useQuery({
    enabled,
    queryKey: eventKeys.active,
    queryFn: () =>
      getJSON<{ event: ActiveEvent | null }>('/events/active').then(
        (body) => body.event,
      ),
    // An event only changes at a day boundary; the countdown refetches then
    staleTime: 5 * 60_000,
  });
}

export function useEventLeaderboard(slug?: string) {
  return useQuery({
    queryKey: eventKeys.leaderboard(slug ?? ''),
    queryFn: () =>
      getJSON<{ entries: Array<EventLeaderboardEntry> }>(
        `/events/${slug}/leaderboard`,
      ).then((body) => body.entries),
    enabled: !!slug,
  });
}

/** Your recap, or another user's when userId is given */
export function useEventRecap(slug?: string, userId?: string) {
  return useQuery({
    queryKey: eventKeys.recap(slug ?? '', userId),
    queryFn: () =>
      getJSON<EventRecap>(
        `/events/${slug}/recap${userId ? `?user=${encodeURIComponent(userId)}` : ''}`,
      ),
    enabled: !!slug,
  });
}
