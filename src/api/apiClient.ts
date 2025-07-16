import { Config } from '@/config/Config';
import type {
  DailyPrompt,
  User,
  GetMeResponse,
  UserPromptSubmission,
  Comment,
  ReactionResponse,
  Activity,
} from './Api';

// Pure API client functions (no React Query dependencies)
export async function fetchAPI(
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

// API functions that can be tested independently
export const apiClient = {
  // Daily prompt
  getDailyPrompt: async (): Promise<DailyPrompt> => {
    const response = await fetchAPI('GET', '/submission/daily');
    if (!response.ok) {
      throw new Error(`Error fetching daily prompt: ${response.statusText}`);
    }
    return response.json();
  },

  // User endpoints
  getMe: async (): Promise<User> => {
    const response = await fetchAPI('GET', '/user/me');
    if (!response.ok) {
      throw new Error(`Error fetching user: ${response.statusText}`);
    }
    const data = await response.json();
    // Convert date string to Date object
    return {
      ...data,
      createdAt: new Date(data.createdAt),
    };
  },

  getMyProfile: async (): Promise<GetMeResponse> => {
    const response = await fetchAPI('GET', '/user/me/profile');
    if (!response.ok) {
      throw new Error(`Error fetching user profile: ${response.statusText}`);
    }
    const data = await response.json();
    // Convert date strings to Date objects
    return {
      ...data,
      user: {
        ...data.user,
        createdAt: new Date(data.user.createdAt),
      },
    };
  },

  getUserProfile: async (userId: string): Promise<GetMeResponse> => {
    const response = await fetchAPI('GET', `/user/${userId}/profile`);
    if (!response.ok) {
      throw new Error(`Error fetching user: ${response.statusText}`);
    }
    const data = await response.json();
    // Convert date strings to Date objects
    return {
      ...data,
      user: {
        ...data.user,
        createdAt: new Date(data.user.createdAt),
      },
    };
  },

  getPromptSubmission: async (
    submissionId: string,
  ): Promise<UserPromptSubmission> => {
    const response = await fetchAPI('GET', `/submission/${submissionId}`);
    if (!response.ok) {
      throw new Error(`Error fetching submission: ${response.statusText}`);
    }
    const data = await response.json();
    // Convert date strings to Date objects
    return {
      ...data,
      user: {
        ...data.user,
        createdAt: new Date(data.user.createdAt),
      },
      comments: data.comments.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
        user: {
          ...comment.user,
          createdAt: new Date(comment.user.createdAt),
        },
      })),
      reactions: data.reactions.map((reaction: any) => ({
        ...reaction,
        createdAt: new Date(reaction.createdAt),
        user: {
          ...reaction.user,
          createdAt: new Date(reaction.user.createdAt),
        },
      })),
    };
  },

  // Auth endpoints
  createUser: async (data: {
    username: string;
    email: string;
  }): Promise<{ message: string }> => {
    const response = await fetchAPI('POST', '/auth/register', {
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Error creating user: ${response.statusText}`);
    }
    return response.json();
  },

  loginUser: async (email: string): Promise<{ message: string }> => {
    const response = await fetchAPI('POST', '/auth/login', {
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      throw new Error(`Error logging in: ${response.statusText}`);
    }
    return response.json();
  },

  logoutUser: async (): Promise<{ message: string }> => {
    const response = await fetchAPI('POST', '/auth/logout');
    if (!response.ok) {
      throw new Error(`Error logging out: ${response.statusText}`);
    }
    return response.json();
  },

  // User management
  addFriend: async (username: string): Promise<{ message: string }> => {
    const response = await fetchAPI('POST', '/user/add-friend', {
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      throw new Error(`Error adding friend: ${response.statusText}`);
    }
    return response.json();
  },

  updateUsername: async (username: string): Promise<{ message: string }> => {
    const response = await fetchAPI('PUT', '/user/me/username', {
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update username');
    }
    return response.json();
  },

  // Submissions
  submitDailyPrompt: async (
    canvasData: string,
  ): Promise<UserPromptSubmission> => {
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

    const response = await fetchAPI('POST', '/submission/daily', {
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error submitting daily prompt: ${response.statusText}`);
    }
    return response.json();
  },

  // Comments
  addComment: async (submissionId: string, text: string): Promise<Comment> => {
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

  // Reactions
  toggleSubmissionReaction: async (
    submissionId: string,
    reactionId: string,
  ): Promise<ReactionResponse> => {
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
    return response.json();
  },

  toggleCommentReaction: async (
    submissionId: string,
    commentId: string,
    reactionId: string,
  ): Promise<ReactionResponse> => {
    const response = await fetchAPI(
      'POST',
      `/submission/${submissionId}/comment/${commentId}/reaction`,
      {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionId }),
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to toggle reaction');
    }
    return response.json();
  },

  // Activity
  getActivityFeed: async (): Promise<Activity[]> => {
    const response = await fetchAPI('GET', '/activity');
    if (!response.ok) {
      throw new Error(`Error fetching activity feed: ${response.statusText}`);
    }
    const data = await response.json();
    // Convert date strings to Date objects
    return (data.activities as any[]).map((a: any) => ({
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

  markActivityRead: async (
    activityId: string,
  ): Promise<{ message: string }> => {
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

  // Favorite Submission
  toggleFavoriteSubmission: async (
    submissionId: string,
  ): Promise<{ favorited: boolean }> => {
    const response = await fetchAPI(
      'POST',
      `/submission/${submissionId}/favorite`,
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to toggle favorite');
    }
    return response.json();
  },

  swapFavoriteOrder: async (
    id1: string,
    id2: string,
  ): Promise<{ success: boolean }> => {
    const response = await fetchAPI('POST', '/favorite/swap', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id1, id2 }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to swap favorites');
    }
    return response.json();
  },

  // Push notification subscriptions
  subscribePush: async (subscription: any): Promise<void> => {
    const response = await fetchAPI('POST', '/notifications/subscribe', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    if (!response.ok) {
      throw new Error('Failed to subscribe to push notifications');
    }
  },

  unsubscribePush: async (endpoint: string): Promise<void> => {
    const response = await fetchAPI('POST', '/notifications/unsubscribe', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    if (!response.ok) {
      throw new Error('Failed to unsubscribe from push notifications');
    }
  },
};
