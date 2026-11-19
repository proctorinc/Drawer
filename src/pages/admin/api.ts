import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Achievement, DailyPrompt, User } from '@/api/Api';
import type { Level, Quest } from '@/api/trophies';
import { queryKeys } from '@/api/Api';
import { fetchAPI } from '@/api/apiClient';

export interface AdminUser extends User {
  email: string;
  isAdmin: boolean;
  drawings: number;
  friends: number;
  achievements: number;
  /** YYYY-MM-DD, or null if they've never drawn */
  lastDrawnDay: string | null;
  pushSubscribed: boolean;
}

export interface AdminPrompt extends Omit<DailyPrompt, 'isCompleted'> {
  submissions: number;
}

export interface AdminSubmission {
  id: string;
  day: string;
  prompt: string;
  colors: Array<string>;
  user: User;
  imageUrl: string;
  createdAt: string;
  reactions: number;
  comments: number;
}

export interface AdminAchievement extends Achievement {
  earnedBy: number;
}

export interface AdminReward {
  id: string;
  name: string;
  description: string;
  achievementId: string | null;
  /** People who earned the achievement that unlocks it */
  unlockedBy: number;
  /** People wearing it now, for decorations */
  wornBy: number;
}

export interface ReactionUsage {
  reactionId: string;
  submissions: number;
  comments: number;
}

/** A level and how many players are on it now */
export interface LevelStats extends Level {
  players: number;
}

/** A weekly quest and how far everyone has got with it this week */
export interface QuestStats extends Quest {
  started: number;
  completed: number;
}

/** The XP, level and quest rules, and where every player stands */
export interface Progression {
  xpRules: Array<{ action: string; xp: number }>;
  players: number;
  levels: Array<LevelStats>;
  quests: Array<QuestStats>;
  /** This week, Monday to Sunday, YYYY-MM-DD */
  week: { start: string; end: string };
}

export type LogKind =
  | 'signup'
  | 'drawing'
  | 'comment'
  | 'reaction'
  | 'friend_request'
  | 'friend_accepted'
  | 'poke'
  | 'achievement'
  | 'suggestion';

export interface LogEntry {
  kind: LogKind;
  /** ISO timestamp */
  at: string;
  actor: User | null;
  /** Whoever it was aimed at */
  target: User | null;
  /** The prompt, comment text, reaction id, achievement name, … */
  detail: string;
  submissionId: string | null;
}

export interface AdminEvent {
  id: string;
  slug: string;
  name: string;
  theme: string;
  startsAt: string;
  /** Exclusive */
  endsAt: string;
  countdownDays: number | null;
  reactions: Array<string>;
  /** The YYYY-MM-DD prompt days it covers, inclusive */
  firstDay: string;
  lastDay: string;
}

/** The event whose days include this YYYY-MM-DD day, if any */
export const eventOnDay = (events: Array<AdminEvent>, day: string) =>
  events.find((e) => e.firstDay <= day && day <= e.lastDay);

export interface EventStanding {
  user: User;
  doodles: number;
  countdownDoodles: number;
  reactionsReceived: number;
}

/** How an event went for everyone */
export interface EventStats {
  /** Everyone who drew during it, most doodles first */
  standings: Array<EventStanding>;
  /** Reactions left while it ran */
  reactions: Array<ReactionUsage>;
  comments: number;
  /** 0 when it has no countdown */
  countdownDays: number;
}

/** Loads GET /admin/{path} and unwraps its {key: list} body */
function useAdminList<T>(path: string, key: string) {
  return useQuery({
    queryKey: ['admin', path],
    queryFn: async (): Promise<T> => {
      const response = await fetchAPI('GET', `/admin/${path}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
      }
      return (await response.json())[key];
    },
  });
}

export const useAdminUsers = () =>
  useAdminList<Array<AdminUser>>('users', 'users');
export const useAdminPrompts = () =>
  useAdminList<Array<AdminPrompt>>('prompts', 'prompts');
export const useAdminSubmissions = () =>
  useAdminList<Array<AdminSubmission>>('submissions', 'submissions');
export const useAdminAchievements = () =>
  useAdminList<Array<AdminAchievement>>('achievements', 'achievements');
export const useAdminRewards = () =>
  useAdminList<Array<AdminReward>>('rewards', 'rewards');
export const useReactionUsage = () =>
  useAdminList<Array<ReactionUsage>>('reactions', 'usage');
export const useAdminEvents = () =>
  useAdminList<Array<AdminEvent>>('events', 'events');
export const useActivityLog = () =>
  useAdminList<Array<LogEntry>>('activity', 'entries');

export function useEventStats(eventId: string) {
  return useQuery({
    queryKey: ['admin', 'events', eventId, 'stats'],
    queryFn: async (): Promise<EventStats> => {
      const response = await fetchAPI('GET', `/admin/events/${eventId}/stats`);
      if (!response.ok) {
        throw new Error('Failed to load event stats');
      }
      return response.json();
    },
  });
}

export function useProgression() {
  return useQuery({
    queryKey: ['admin', 'progression'],
    queryFn: async (): Promise<Progression> => {
      const response = await fetchAPI('GET', '/admin/progression');
      if (!response.ok) {
        throw new Error('Failed to load progression');
      }
      return response.json();
    },
  });
}

/** Throws the server's error message when a response isn't ok */
async function ensureOk(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? response.statusText);
  }
}

/** Refreshes the suggestion list and every admin list after a change */
function useRefreshAfter() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.promptSuggestions });
  };
}

export interface AcceptSuggestion {
  id: string;
  day: string;
  prompt: string;
  colors: Array<string>;
}

/** Schedules a suggestion on a day with no prompt, credited to its suggester */
export function useAcceptSuggestion() {
  const onSuccess = useRefreshAfter();
  return useMutation({
    mutationFn: async ({ id, ...body }: AcceptSuggestion) =>
      ensureOk(
        await fetchAPI('POST', `/admin/prompt-suggestions/${id}/accept`, {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      ),
    onSuccess,
  });
}

export function useDismissSuggestion() {
  const onSuccess = useRefreshAfter();
  return useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await fetchAPI('DELETE', `/admin/prompt-suggestions/${id}`)),
    onSuccess,
  });
}
