import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import type { Pencil } from '@/drawing/pencils';

export interface DailyPrompt {
  day: string;
  colors: Array<string>;
  /** The day's own pencils; left out for the usual three (see pencilsFor) */
  pencils?: Array<Pencil>;
  prompt: string;
  isCompleted: boolean;
  createdBy: User | null;
}

export interface PromptSuggestion {
  id: string;
  colors: Array<string>;
  prompt: string;
  isCompleted: boolean;
  createdBy: User;
}

export interface User {
  id: string;
  username: string;
  /** Only sent for your own account (and to admins) */
  email?: string;
  createdAt: Date;
  avatarType: 'basic' | 'custom';
  avatarUrl: string;
  /** The decoration worn on their avatar, or '' for none */
  decoration: DecorationId | '';
  /** Only sent for your own account */
  isAdmin?: boolean;
  /** Let into the beta zone (admins always are); only sent for your own account */
  hasBeta?: boolean;
  /** Username of the admin viewing as you; only set while impersonating */
  impersonatedBy?: string;
}

/** One of your drawn faces, kept in one of a few slots */
export interface CustomAvatar {
  slot: number;
  url: string;
}

/** How many drawn faces you can keep at once */
export const MAX_AVATAR_SLOTS = 3;

/** Decorations are rewards worn on the avatar, one at a time */
export type DecorationId =
  | 'FIRST_SNOW'
  | 'CHRISTMAS_LIGHTS'
  | 'GOLDEN_SANTA_HAT'
  | 'PENCIL_EAR'
  | 'BERET'
  | 'CRAYON_CROWN'
  | 'ORBIT'
  | 'SWEATBAND'
  | 'BLAZE'
  | 'PROPELLER_CAP'
  | 'SPEECH_BUBBLE'
  | 'FOAM_FINGER'
  | 'LIGHTBULB'
  | 'JESTER_HAT'
  | 'HEART_SWARM'
  | 'PLUNGER_HAT'
  | 'BAND_AIDS'
  | 'APPLE_HAT'
  | 'GILDED_FRAME'
  | 'HALO'
  | 'PALETTE'
  | 'LAUREL_WREATH'
  | 'BALLOONS'
  | 'QUILL'
  | 'GOLD_STARS'
  | 'PLATINUM_PENCIL'
  | 'RAIN_CLOUD'
  | 'CROWN'
  | 'MYTHIC_WINGS';

export interface ReactionCount {
  reactionId: ReactionId;
  count: number;
}

export interface ReactionResponse {
  reactions: Array<Reaction>;
  counts: Array<ReactionCount>;
}

export type ActivityAction =
  /** Comments on a drawing you made or commented on, grouped per drawing */
  | 'comment'
  /** Reactions to your drawing, grouped per drawing */
  | 'reaction'
  /** Reactions to your comment, grouped per comment */
  | 'comment_reaction'
  | 'poke'
  /** Each of yours is its own row; a friend's are one row per friend per day */
  | 'achievement'
  | 'level_up'
  | 'friend_request'
  | 'friend_accepted'
  /** An AI judge finished reviewing your doodle; `user` is you */
  | 'ai_review';

export interface Activity {
  id: string;
  /** Who did it; for a grouped row, whoever did so most recently */
  user: User;
  action: ActivityAction;
  /** When it happened; for a grouped row, its newest item */
  date: Date;
  isRead: boolean;
  /** Grouped rows only: everyone involved, newest first */
  users?: Array<User>;
  /** Grouped rows only: how many comments, reactions or achievements were folded in */
  count?: number;
  /** The newest comment in a thread, or the comment that was reacted to */
  comment?: Comment;
  /** Each kind of reaction in a reaction row */
  reactionIds?: Array<ReactionId>;
  /** The achievement earned; on a friend's day of achievements, their newest */
  achievement?: Achievement;
  /** A friend's day of achievements only: the newest three at most, newest first */
  achievements?: Array<Achievement>;
  level?: number;
  submission?: {
    id: string;
    prompt: string;
    imageUrl: string;
    artist: User;
  };
  /** On an ai_review row: the judge's review */
  aiReview?: AIReview;
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  createdAt: Date;
  reactions: Array<Reaction>;
  counts: Array<ReactionCount>;
}

/** One of the ids in server/internal/reactions/reactions.json */
export type ReactionId = string;
export interface Reaction {
  id: number;
  reactionId: ReactionId;
  user: User;
  createdAt: Date;
}

export interface UserPromptSubmission extends DailyPrompt {
  id: string;
  imageUrl: string;
  user: User;
  comments: Array<Comment>;
  reactions: Array<Reaction>;
  counts: Array<ReactionCount>;
  isFavorite?: boolean;
  createdAt: Date;
  /** The AI judge's score and comment; null until it has one */
  aiReview?: AIReview | null;
}

/** An AI judge as players see it: never a real user, so it has no profile */
export interface AIJudge {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
  /** An AI-only decoration id (see src/ai/decorations.tsx), or '' */
  decoration: string;
}

/** One thing a judge scored separately, as it was when it judged */
export interface AICriterionScore {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Out of 10, to at most one decimal place */
  score: number;
}

export interface AIReview {
  submissionId: string;
  judge: AIJudge;
  /** Pending while the judge is still squinting at it */
  status: 'pending' | 'done';
  /** Out of 10, to at most one decimal place; null until it's done */
  score: number | null;
  criteria: Array<AICriterionScore>;
  comment: string;
  createdAt: string;
  /** On activity rows: you've heard it (its dialogue played) */
  heard?: boolean;
}

export interface FavoriteSubmission {
  id: string;
  submission: UserPromptSubmission; // JSON key is 'submission'
  createdAt: Date;
  orderNum: number;
}

export interface UserStats {
  totalDrawings: number;
  currentStreak: number;
}

export interface GetMeResponse {
  user: User;
  prompts: Array<UserPromptSubmission>;
  feed: Array<UserPromptSubmission>;
  friends: Array<User>;
  stats: UserStats;
  favorites: Array<FavoriteSubmission>;
  /** Where you stand with them; null when neither of you has invited the other */
  invitation: InvitationStatus | null;
}

export type Achievement = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  achievedAt: Date | null;
  achievementField: string;
  /** What earning it is worth; 0 while it's a secret */
  xp: number;
  achievementValue: number;
  progress: number;
  /** Streaks: the longest run, sent only when it beats the current one */
  best?: number;
  reward: AchievementReward | null;
  /** Set for stickers that belong to a limited-time event */
  eventSlug: string | null;
  /** The achievements page tab it's on */
  category: AchievementCategory;
  /** A secret achievement: how to earn it stays hidden until it's earned */
  hidden: boolean;
  /**
   * Its details were withheld (a hidden achievement or event sticker not earned
   * yet): the name is "???" and the description, goal, progress and reward are blank
   */
  secret: boolean;
  /**
   * You've been shown this one being earned, on some device. Always false on
   * someone else's achievements; older servers leave it out.
   */
  celebrated?: boolean;
  /**
   * The path it's a step on (see src/achievements/paths.ts); its own id when
   * it stands alone. Older servers leave these out.
   */
  path?: string;
  /** Its place on its path, from 1 */
  pathStep?: number;
};

export type AchievementCategory =
  | 'drawing'
  | 'streaks'
  | 'friends'
  | 'judges'
  | 'levels'
  | 'events';

export type AchievementReward = {
  id: string;
  name: string;
  description: string;
};

export interface AdminDashboardStats {
  overall: {
    totalUsers: number;
    totalDrawings: number;
    totalReactions: number;
    totalComments: number;
  };
  today: {
    drawingsToday: number;
    reactionsToday: number;
    commentsToday: number;
  };
  recentUsers: Array<AdminDashboardRecentUser>;
}

export interface AdminDashboardRecentUser {
  ID: string;
  Username: string;
  Email: string;
  CreatedAt: string;
}

export interface AdminDashboardResponse {
  message: string;
  admin: {
    id: string;
    username: string;
    email: string;
  };
  users: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  futurePrompts: Array<{
    day: string;
    colors: Array<string>;
    prompt: string;
  }>;
  stats: AdminDashboardStats;
}

export type DailyActionStat = {
  date: string;
  drawings: number;
  reactions: number;
  comments: number;
};

// Query keys
export const queryKeys = {
  me: ['me'] as const,
  daily: ['daily'] as const,
  myProfile: ['myProfile'] as const,
  myAvatars: ['myAvatars'] as const,
  userProfile: (id: string) => ['userProfile', id] as const,
  user: (id: string) => ['user', id] as const,
  promptSubmission: (id: string) => ['promptSubmission', id] as const,
  activityFeed: ['activityFeed'] as const,
  promptSuggestions: ['promptSuggestions'] as const,
  invitations: ['invitations'] as const,
};

// Queries
export function useGetDailyPrompt() {
  return useQuery({
    queryKey: queryKeys.daily,
    queryFn: apiClient.getDailyPrompt,
    retry: () => {
      return false;
    },
  });
}

export function useGetMyAvatars(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myAvatars,
    queryFn: apiClient.getMyAvatars,
    select: (data) => data.avatars,
    enabled,
  });
}

export function useGetPromptSuggestions() {
  return useQuery({
    queryKey: queryKeys.promptSuggestions,
    queryFn: apiClient.getPromptSuggestions,
  });
}

export function useGetMe(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: apiClient.getMe,
    enabled,
    retry: () => {
      return false;
    },
  });
}

export function useGetMyProfile() {
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: apiClient.getMyProfile,
    retry: () => {
      return false;
    },
  });
}

export function useGetUserProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: () => apiClient.getUserProfile(userId),
    enabled: !!userId,
    // A bad link shouldn't keep you waiting through three retries
    retry: 1,
  });
}

/** `placeholder` (e.g. the feed's copy) shows while the full doodle loads */
export function usePromptSubmission(
  submissionId: string,
  placeholder?: UserPromptSubmission,
) {
  return useQuery({
    queryKey: queryKeys.promptSubmission(submissionId),
    queryFn: () => apiClient.getPromptSubmission(submissionId),
    placeholderData: placeholder,
    // Check back while the AI judge is writing. A doodle drawn while judging was
    // off has no review at all, so it never waits or shows any AI UI.
    refetchInterval: (query) =>
      query.state.data?.aiReview?.status === 'pending' ? 4000 : false,
    retry: () => {
      return false;
    },
    enabled: !!submissionId,
  });
}

// Mutations
export function useSubmitDailyPrompt() {
  return useMutation({
    mutationFn: apiClient.submitDailyPrompt,
  });
}

export function useUploadCustomAvatar() {
  return useMutation({
    mutationFn: apiClient.uploadCustomAvatar,
  });
}

export function useUpdateDecoration() {
  return useMutation({
    mutationFn: apiClient.updateDecoration,
  });
}

export function useWearAvatar() {
  return useMutation({
    mutationFn: apiClient.wearAvatar,
  });
}

export function useToggleAvatarType() {
  return useMutation({
    mutationFn: apiClient.toggleAvatarType,
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: apiClient.createUser,
  });
}

export function useLogoutUser() {
  return useMutation({
    mutationFn: apiClient.logoutUser,
  });
}

export function useStopImpersonating() {
  return useMutation({
    mutationFn: apiClient.stopImpersonating,
  });
}

export function useInviteFriend() {
  return useMutation({
    mutationFn: apiClient.inviteFriend,
  });
}

export function useSubmitPromptSuggestion() {
  return useMutation({
    mutationFn: apiClient.submitPromptSuggestion,
  });
}

// Types for invitations
export interface Invitation {
  inviter: User;
  invitee: User;
  createdAt: string;
}

export interface InvitationStatus {
  inviter: User;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export interface InvitationResponse {
  invitee: Array<Invitation>;
  invited: Array<Invitation>;
}

export function useGetInvitations() {
  return useQuery<InvitationResponse>({
    queryKey: queryKeys.invitations,
    queryFn: apiClient.getInvitations,
  });
}

type AchievementRewardID = 'CUSTOM_PROFILE_PIC' | DecorationId;

export type AchievementsAndRewardsResponse = {
  achievements: Array<Achievement>;
  rewards: Map<AchievementRewardID, AchievementReward>;
};

export function useGetAchievements() {
  return useQuery<AchievementsAndRewardsResponse>({
    queryKey: ['achievements'],
    queryFn: apiClient.getUserAchievements,
  });
}

/** Every achievement there is, secrets and all events included (but masked) */
export function useGetAchievementCatalog() {
  return useQuery<AchievementsAndRewardsResponse>({
    queryKey: ['achievements', 'all'],
    queryFn: apiClient.getAchievementCatalog,
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: apiClient.acceptInvitation,
  });
}

export function useDenyInvitation() {
  return useMutation({
    mutationFn: apiClient.denyInvitation,
  });
}

export function useUpdateUsername() {
  return useMutation({
    mutationFn: apiClient.updateUsername,
  });
}

export function useAddComment() {
  return useMutation({
    mutationFn: ({
      submissionId,
      text,
    }: {
      submissionId: string;
      text: string;
    }) => apiClient.addComment(submissionId, text),
  });
}

export function useDeleteComment() {
  return useMutation({
    mutationFn: ({
      submissionId,
      commentId,
    }: {
      submissionId: string;
      commentId: string;
    }) => apiClient.deleteComment(submissionId, commentId),
  });
}

export function useToggleSubmissionReaction() {
  return useMutation({
    mutationFn: ({
      submissionId,
      reactionId,
    }: {
      submissionId: string;
      reactionId: ReactionId;
    }) => apiClient.toggleSubmissionReaction(submissionId, reactionId),
  });
}

export function useToggleCommentReaction() {
  return useMutation({
    mutationFn: ({
      submissionId,
      commentId,
      reactionId,
    }: {
      submissionId: string;
      commentId: string;
      reactionId: ReactionId;
    }) => apiClient.toggleCommentReaction(submissionId, commentId, reactionId),
  });
}

export function useToggleSubmissionFavorite() {
  return useMutation({
    mutationFn: (submissionId: string) =>
      apiClient.toggleFavoriteSubmission(submissionId),
  });
}

export function useSwapFavoriteOrder() {
  return useMutation({
    mutationFn: ({ id1, id2 }: { id1: string; id2: string }) =>
      apiClient.swapFavoriteOrder(id1, id2),
  });
}

// Activity Feed Hooks
// Add a type for the friend submission status returned by the activity API
export interface FriendSubmissionStatus {
  user: User;
  hasSubmittedToday: boolean;
  /** You already poked them today */
  pokedToday: boolean;
}

// Update the useActivityFeed hook to reflect the new response structure
export interface ActivityFeedResponse {
  activities: Array<Activity>;
  friends: Array<FriendSubmissionStatus>;
}

export function useActivityFeed() {
  return useQuery<ActivityFeedResponse>({
    queryKey: queryKeys.activityFeed,
    queryFn: apiClient.getActivityFeed,
  });
}

export function useMarkActivityRead() {
  return useMutation({
    mutationFn: apiClient.markActivityRead,
  });
}

// Admin queries
export function useGetAdminDashboard(searchQuery?: string) {
  return useQuery({
    queryKey: ['admin', 'dashboard', searchQuery] as const,
    queryFn: () => apiClient.getAdminDashboard(searchQuery),
    retry: () => {
      return false;
    },
  });
}

// Admin mutations
export function useImpersonateUser() {
  return useMutation({
    mutationFn: apiClient.impersonateUser,
  });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.createPrompt,
    onSuccess: () => {
      // Refresh every admin list that shows prompts
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
