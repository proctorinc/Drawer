import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './apiClient';

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
}

export interface ReactionCount {
  reactionId: ReactionId;
  count: number;
}

export interface ReactionResponse {
  reactions: Reaction[];
  counts: ReactionCount[];
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
  reactions: Reaction[];
  counts: ReactionCount[];
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
  comments: Comment[];
  reactions: Reaction[];
  counts: ReactionCount[];
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
}

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

// Mutations
export function useSubmitDailyPrompt() {
  return useMutation({
    mutationFn: apiClient.submitDailyPrompt,
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

export function useAddFriend() {
  return useMutation({
    mutationFn: apiClient.addFriend,
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
export function useActivityFeed() {
  return useQuery<Activity[]>({
    queryKey: queryKeys.activityFeed,
    queryFn: apiClient.getActivityFeed,
  });
}

export function useMarkActivityRead() {
  return useMutation({
    mutationFn: apiClient.markActivityRead,
  });
}
