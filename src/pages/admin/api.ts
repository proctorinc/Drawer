import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AICriterionScore,
  AIReview,
  Achievement,
  DailyPrompt,
  User,
} from '@/api/Api';
import type { Level, Quest } from '@/api/trophies';
import type { Announcement } from '@/announcements/api';
import { queryKeys } from '@/api/Api';
import { fetchAPI } from '@/api/apiClient';
import { announcementKeys } from '@/announcements/api';

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
  /** The AI judge picked for the day, or null for the event's or default judge */
  judgeId: string | null;
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
  xpRules: Array<{ action: string; xp: number; maxXp?: number }>;
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
  /** The AI judge for the day, or null for the event's or default judge */
  judgeId?: string | null;
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

/** Hands a day's doodles to one AI judge, or back to auto with null */
export function useSetPromptJudge() {
  const onSuccess = useRefreshAfter();
  return useMutation({
    mutationFn: async ({
      day,
      judgeId,
    }: {
      day: string;
      judgeId: string | null;
    }) =>
      ensureOk(
        await fetchAPI(
          'PUT',
          `/admin/prompts/${day}/judge`,
          json({ judgeId: judgeId ?? '' }),
        ),
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

// --- AI judges ---

/** The AI judges' setup. The OpenAI key itself never comes back, only a hint */
export interface AISettings {
  enabled: boolean;
  model: string;
  defaultModel: string;
  hasApiKey: boolean;
  /** The key's last few characters, e.g. "…a1b2" */
  apiKeyHint: string;
  /** The key comes from the server's OPENAI_API_KEY, not this screen */
  keyFromEnv: boolean;
}

export interface AISettingsUpdate {
  enabled?: boolean;
  model?: string;
  /** A new key; leave it out to keep the current one */
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface AICriterion {
  /** Empty for a criterion that hasn't been saved yet */
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface AIPersonality {
  id: string;
  slug: string;
  name: string;
  /** A sentence or two players read in the judge's drawer */
  bio: string;
  systemPrompt: string;
  avatarUrl: string;
  decoration: string;
  isDefault: boolean;
  eventId: string | null;
  enabled: boolean;
  criteria: Array<AICriterion>;
  createdAt?: string;
}

/** A judge's answer, straight back from a preview or a re-run */
export interface AIVerdict {
  /** Out of 10, to at most one decimal place */
  score: number;
  criteria: Array<AICriterionScore>;
  comment: string;
  model: string;
  /** What the judge thought the drawing showed, before reading it as the prompt */
  seen: string;
  /** How hard the artist clearly tried */
  effort: 'real' | 'low' | 'none';
  /** Share taken off the score for little or no effort (hidden from players), already applied */
  effortPenalty: number;
  /** How well it follows the day's prompt */
  prompt: 'nailed' | 'complete' | 'partial' | 'missed';
  /** The parts of the prompt the judge found missing, or '' */
  promptMissing: string;
  /** Added to every criterion (or the score) for following the prompt, already applied */
  promptBonus: number;
  /** The rare swing added to every score because the judge loved or hated it */
  swing: AISwing;
}

/** A random swing, rolled in code before the judge sees the doodle. The judge is only told
 * it loves or hates it; points are added to every score (negative when hated) */
export interface AISwing {
  /** '' for no swing (most reviews), 'boost', or the much rarer 'super' */
  kind: '' | 'boost' | 'super';
  points: number;
}

/** How a run's scores were adjusted in code after the judge answered; empty for older runs */
export interface AIRunMetadata {
  seen?: string;
  effort?: 'real' | 'low' | 'none';
  /** Share taken off the overall score */
  effortPenalty?: number;
  prompt?: 'nailed' | 'complete' | 'partial' | 'missed';
  promptMissing?: string;
  /** Added to every score */
  promptBonus?: number;
  swing?: 'boost' | 'super';
  /** Added to every score; negative when the judge hated it */
  swingPoints?: number;
}

/** "super boost +3.4", "boost −1.2" */
export const describeSwing = (kind: 'boost' | 'super', points: number) =>
  `${kind === 'super' ? 'super boost' : 'boost'} ${points > 0 ? '+' : '−'}${Math.abs(points)}`;

export interface AdminAIReview extends Omit<AIReview, 'status'> {
  status: 'pending' | 'done' | 'failed';
  model: string;
  error: string;
  prompt: string;
  day: string;
  imageUrl: string;
  artist: User;
}

export function useAISettings() {
  return useQuery({
    queryKey: ['admin', 'ai', 'settings'],
    queryFn: async (): Promise<AISettings> => {
      const response = await fetchAPI('GET', '/admin/ai/settings');
      await ensureOk(response);
      return response.json();
    },
  });
}

export const useAIPersonalities = () =>
  useAdminList<Array<AIPersonality>>('ai/personalities', 'personalities');
export const useAIReviews = () =>
  useAdminList<Array<AdminAIReview>>('ai/reviews', 'reviews');

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function useUpdateAISettings() {
  const onSuccess = useRefreshAfter();
  return useMutation({
    mutationFn: async (update: AISettingsUpdate) => {
      const response = await fetchAPI(
        'PUT',
        '/admin/ai/settings',
        json(update),
      );
      await ensureOk(response);
      return (await response.json()) as AISettings;
    },
    onSuccess,
  });
}

/** Creates the judge when it has no id yet, else updates it */
export function useSaveAIPersonality() {
  const onSuccess = useRefreshAfter();
  return useMutation({
    mutationFn: async (personality: AIPersonality) => {
      const response = personality.id
        ? await fetchAPI(
            'PUT',
            `/admin/ai/personalities/${personality.id}`,
            json(personality),
          )
        : await fetchAPI('POST', '/admin/ai/personalities', json(personality));
      await ensureOk(response);
      return (await response.json()) as AIPersonality;
    },
    onSuccess,
  });
}

export function useDeleteAIPersonality() {
  const onSuccess = useRefreshAfter();
  return useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await fetchAPI('DELETE', `/admin/ai/personalities/${id}`)),
    onSuccess,
  });
}

/** One judge's answer in the testing ground */
export interface AITestResult {
  personalityId: string;
  name: string;
  /** Null when it failed */
  verdict: AIVerdict | null;
  error: string;
  durationMs: number;
}

export interface AITestRun {
  batchId: string;
  prompt: string;
  results: Array<AITestResult>;
}

/** A past doodle, or a custom prompt and drawing (a data:image/png URL) */
export type AITestSource =
  | { submissionId: string }
  | { prompt: string; imageData: string };

/**
 * The testing ground: judges (unsaved edits and all) review the same doodle side
 * by side. Logged as tests; nothing is saved to a doodle or shown to players.
 */
export function useTestAI() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: AITestSource & { personalities: Array<AIPersonality> },
    ) => {
      const response = await fetchAPI('POST', '/admin/ai/test', json(body));
      await ensureOk(response);
      return (await response.json()) as AITestRun;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai', 'runs'] }),
  });
}

export type AIRunKind = 'submission' | 'rerun' | 'test';

/** One call to a judge, from the AI log */
export interface AIRun {
  id: string;
  kind: AIRunKind;
  /** Shared by judges run together in the testing ground */
  batchId: string;
  personalityId: string;
  judgeName: string;
  judgeAvatarUrl: string;
  judgeDecoration: string;
  /** The personality prompt as it ran */
  systemPrompt: string;
  submissionId: string | null;
  prompt: string;
  imageUrl: string;
  /** The artist for a real doodle, else the admin who ran it */
  user: User | null;
  status: 'done' | 'failed';
  score: number | null;
  criteria: Array<AICriterionScore>;
  comment: string;
  model: string;
  error: string;
  durationMs: number;
  metadata: AIRunMetadata;
  createdAt: string;
}

/** Counts of every run ever, not just the ones listed */
export interface AIRunStats {
  total: number;
  submissions: number;
  reruns: number;
  tests: number;
  failed: number;
  today: number;
  avgDurationMs: number;
}

export function useAIRuns() {
  return useQuery({
    queryKey: ['admin', 'ai', 'runs'],
    queryFn: async (): Promise<{ runs: Array<AIRun>; stats: AIRunStats }> => {
      const response = await fetchAPI('GET', '/admin/ai/runs');
      await ensureOk(response);
      return response.json();
    },
  });
}

/** Re-judges a doodle and replaces the review players see */
export function useRerunAIReview() {
  const onSuccess = useRefreshAfter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      submissionId: string;
      personalityId?: string;
    }) => {
      const response = await fetchAPI(
        'POST',
        `/admin/ai/reviews/${body.submissionId}/rerun`,
        json({ personalityId: body.personalityId ?? '' }),
      );
      await ensureOk(response);
      return (await response.json()) as AIVerdict;
    },
    onSuccess: (_, { submissionId }) => {
      onSuccess();
      // The doodle's page, the wall and the bell, if this admin is looking
      queryClient.invalidateQueries({
        queryKey: queryKeys.promptSubmission(submissionId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.daily });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed });
    },
  });
}

/** An announcement as admins see it, with how many players have seen it */
export interface AdminAnnouncement extends Announcement {
  seenBy: number;
}

/** What the editor sends; no id creates one */
export type AnnouncementDraft = Omit<Announcement, 'id'> & { id?: string };

export const useAdminAnnouncements = () =>
  useAdminList<Array<AdminAnnouncement>>('announcements', 'announcements');

/** Refreshes the admin lists and your own live announcements after a change */
function useRefreshAnnouncements() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    queryClient.invalidateQueries({ queryKey: announcementKeys.live });
  };
}

/** Creates the announcement when it has no id yet, else updates it */
export function useSaveAnnouncement() {
  const onSuccess = useRefreshAnnouncements();
  return useMutation({
    mutationFn: async ({ id, ...announcement }: AnnouncementDraft) => {
      const response = id
        ? await fetchAPI(
            'PUT',
            `/admin/announcements/${id}`,
            json(announcement),
          )
        : await fetchAPI('POST', '/admin/announcements', json(announcement));
      await ensureOk(response);
      return (await response.json()) as Announcement;
    },
    onSuccess,
  });
}

export function useDeleteAnnouncement() {
  const onSuccess = useRefreshAnnouncements();
  return useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await fetchAPI('DELETE', `/admin/announcements/${id}`)),
    onSuccess,
  });
}

/** Forgets who has seen it, so it pops up for everyone again */
export function useResetAnnouncementViews() {
  const onSuccess = useRefreshAnnouncements();
  return useMutation({
    mutationFn: async (id: string) =>
      ensureOk(await fetchAPI('DELETE', `/admin/announcements/${id}/views`)),
    onSuccess,
  });
}
