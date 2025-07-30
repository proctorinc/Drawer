import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

export interface DailyPrompt {
  day: string;
  colors: Array<string>;
  prompt: string;
  isCompleted: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  avatarType: 'basic' | 'custom';
  avatarUrl: string;
}

export interface ReactionCount {
  reactionId: ReactionId;
  count: number;
}

export interface ReactionResponse {
  reactions: Array<Reaction>;
  counts: Array<ReactionCount>;
}

export type ActivityAction = 'comment' | 'reaction';

export interface Activity {
  id: string;
  user: User;
  action: ActivityAction;
  date: Date;
  isRead: boolean;
  comment?: Comment;
  reaction?: Reaction;
  submission?: {
    id: string;
    prompt: string;
    imageUrl: string;
  };
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  createdAt: Date;
  reactions: Array<Reaction>;
  counts: Array<ReactionCount>;
}

export type ReactionId = 'heart' | 'cry-laugh' | 'face-meh' | 'fire';
export interface Reaction {
  id: number;
  reactionId: ReactionId;
  user: User;
  icon: IconDefinition;
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
  invitation: InvitationStatus;
}

export type Achievement = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  achievedAt: Date | null;
  achievementField: string;
  achievementValue: number;
  progress: number;
  reward: AchievementReward | null;
};

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
  userProfile: (id: string) => ['userProfile', id] as const,
  user: (id: string) => ['user', id] as const,
  promptSubmission: (id: string) => ['promptSubmission', id] as const,
  activityFeed: ['activityFeed'] as const,
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

export function useGetMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: apiClient.getMe,
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
  });
}

export function usePromptSubmission(submissionId: string) {
  return useQuery({
    queryKey: queryKeys.promptSubmission(submissionId),
    queryFn: () => apiClient.getPromptSubmission(submissionId),
    retry: () => {
      return false;
    },
    enabled: !!submissionId,
  });
}

export function useGetUserByUsername(username: string) {
  return useQuery({
    queryKey: ['userByUsername', username],
    queryFn: () => apiClient.getUserByUsername(username),
    enabled: !!username,
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

export function useLoginUser() {
  return useMutation({
    mutationFn: apiClient.loginUser,
  });
}

export function useLogoutUser() {
  return useMutation({
    mutationFn: apiClient.logoutUser,
  });
}

export function useInviteFriend() {
  return useMutation({
    mutationFn: apiClient.inviteFriend,
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
    queryKey: ['invitations'],
    queryFn: apiClient.getInvitations,
  });
}

type AchievementRewardID = 'CUSTOM_PROFILE_PIC';

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

export function useSubscribePush() {
  return useMutation({
    mutationFn: apiClient.subscribePush,
  });
}

export function useUnsubscribePush() {
  return useMutation({
    mutationFn: apiClient.unsubscribePush,
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
      // Invalidate admin dashboard to refresh future prompts
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}
