import { Config } from '@/config/Config';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { useMutation, useQuery } from '@tanstack/react-query';

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
  submission: {
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
}

async function fetchAPI(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  return await fetch(`${Config.API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    method,
    ...options,
  });
}

// Query keys
export const queryKeys = {
  daily: ['daily'] as const,
  userProfile: ['userProfile'] as const,
  user: (id: string) => ['user', id] as const,
  promptSubmission: (id: string) => ['promptSubmission', id] as const,
  activityFeed: ['activityFeed'] as const,
};

// Queries
export function useGetDailyPrompt() {
  return useQuery({
    queryKey: queryKeys.daily,
    queryFn: async () => {
      const response = await fetchAPI('GET', '/daily');
      if (!response.ok) {
        throw new Error(`Error fetching daily prompt: ${response.statusText}`);
      }
      return response.json() as Promise<DailyPrompt>;
    },
    retry: () => {
      return false;
    },
  });
}

export function useGetUserProfile() {
  return useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: async () => {
      const response = await fetchAPI('GET', '/me');
      if (!response.ok) {
        throw new Error(`Error fetching user profile: ${response.statusText}`);
      }
      return response.json() as Promise<GetMeResponse>;
    },
    retry: () => {
      return false;
    },
  });
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: async () => {
      const response = await fetchAPI('GET', `/user/${userId}`);
      if (!response.ok) {
        throw new Error(`Error fetching user: ${response.statusText}`);
      }
      return response.json() as Promise<User>;
    },
    enabled: !!userId,
  });
}

export function usePromptSubmission(submissionId: string) {
  return useQuery({
    queryKey: queryKeys.promptSubmission(submissionId),
    queryFn: async () => {
      const response = await fetchAPI('GET', `/submission/${submissionId}`);
      if (!response.ok) {
        throw new Error(`Error fetching submission: ${response.statusText}`);
      }
      return response.json() as Promise<UserPromptSubmission>;
    },
    enabled: !!submissionId,
  });
}

// Mutations
export function useSubmitDailyPrompt() {
  return useMutation({
    mutationFn: async (canvasData: string) => {
      // Convert canvas data to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const data = JSON.parse(canvasData);
      const imageData = new ImageData(
        new Uint8ClampedArray(data.data),
        data.width,
        data.height,
      );
      canvas.width = data.width;
      canvas.height = data.height;
      ctx.putImageData(imageData, 0, 0);

      // Convert to PNG
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/png');
      });

      // Create form data
      const formData = new FormData();
      formData.append('image', blob, 'drawing.png');

      const response = await fetchAPI('POST', '/daily', {
        body: formData,
        // Remove Content-Type header to let browser set it with boundary
      });

      if (!response.ok) {
        throw new Error(
          `Error submitting daily prompt: ${response.statusText}`,
        );
      }
      return response.json() as Promise<{ message: string; imageUrl: string }>;
    },
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async ({
      username,
      email,
    }: {
      username: string;
      email: string;
    }) => {
      const response = await fetchAPI('POST', '/register', {
        body: JSON.stringify({ username, email }),
      });
      if (!response.ok) {
        throw new Error(`Error creating user: ${response.statusText}`);
      }
      return response.json() as Promise<{ message: string }>;
    },
  });
}

export function useLoginUser() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await fetchAPI('POST', '/login', {
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error(`Error logging in: ${response.statusText}`);
      }
      return response.json() as Promise<{ message: string }>;
    },
  });
}

export function useLogoutUser() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetchAPI('POST', '/logout');
      if (!response.ok) {
        throw new Error(`Error logging out: ${response.statusText}`);
      }
      return response.json() as Promise<{ message: string }>;
    },
  });
}

export function useAddFriend() {
  return useMutation({
    mutationFn: async (username: string) => {
      const response = await fetchAPI('POST', '/add-friend', {
        body: JSON.stringify({ username }),
      });
      if (!response.ok) {
        throw new Error(`Error adding friend: ${response.statusText}`);
      }
      return response.json() as Promise<void>;
    },
  });
}

export function useUpdateUsername() {
  return useMutation({
    mutationFn: async (username: string) => {
      const response = await fetchAPI('PUT', '/update-username', {
        body: JSON.stringify({ username }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update username');
      }
      return response.json() as Promise<{ message: string }>;
    },
  });
}

export function useAddComment() {
  return useMutation({
    mutationFn: async ({
      submissionId,
      text,
    }: {
      submissionId: string;
      text: string;
    }) => {
      const response = await fetchAPI(
        'POST',
        `/submission/${submissionId}/comment`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add comment');
      }
      return response.json();
    },
  });
}

export function useToggleSubmissionReaction() {
  return useMutation({
    mutationFn: async ({
      submissionId,
      reactionId,
    }: {
      submissionId: string;
      reactionId: ReactionId;
    }) => {
      const response = await fetchAPI(
        'POST',
        `/submission/${submissionId}/reaction`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reactionId }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to toggle reaction');
      }
      return response.json() as Promise<ReactionResponse>;
    },
  });
}

export function useToggleCommentReaction() {
  return useMutation({
    mutationFn: async ({
      commentId,
      reactionId,
    }: {
      commentId: string;
      reactionId: ReactionId;
    }) => {
      const response = await fetchAPI(
        'POST',
        `/comment/${commentId}/reaction`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reactionId }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to toggle reaction');
      }
      return response.json() as Promise<ReactionResponse>;
    },
  });
}

// Activity Feed Hooks
export function useActivityFeed() {
  return useQuery<Activity[]>({
    queryKey: queryKeys.activityFeed,
    queryFn: async () => {
      const response = await fetchAPI('GET', '/activity');
      if (!response.ok) {
        throw new Error(`Error fetching activity feed: ${response.statusText}`);
      }
      const data = await response.json();
      // Convert date strings to Date objects
      return (data.activities as Activity[]).map((a) => ({
        ...a,
        date: new Date(a.date),
        comment: a.comment
          ? { ...a.comment, createdAt: new Date(a.comment.createdAt) }
          : undefined,
        reaction: a.reaction
          ? { ...a.reaction, createdAt: new Date(a.reaction.createdAt) }
          : undefined,
      }));
    },
  });
}

export function useMarkActivityRead() {
  return useMutation({
    mutationFn: async (activityId: string) => {
      const response = await fetchAPI('POST', '/activity', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to mark activity as read');
      }
      return response.json();
    },
  });
}
