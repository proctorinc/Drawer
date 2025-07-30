import type {
  AchievementsAndRewardsResponse,
  ActivityFeedResponse,
  Comment,
  DailyActionStat,
  DailyPrompt,
  GetMeResponse,
  InvitationResponse,
  ReactionResponse,
  User,
  UserPromptSubmission,
} from './Api';
import { Config } from '@/config/Config';

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
    const response = await fetchAPI('GET', '/user/profile');
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

  getUserByUsername: async (username: string): Promise<User> => {
    const response = await fetchAPI(
      'GET',
      `/user/username/${encodeURIComponent(username)}`,
    );
    if (!response.ok) {
      throw new Error(`User not found`);
    }
    return response.json();
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
  inviteFriend: async (userId: string): Promise<{ message: string }> => {
    const response = await fetchAPI('POST', `/user/${userId}/invite`);
    if (!response.ok) {
      throw new Error(`Error inviting friend: ${response.statusText}`);
    }
    return response.json();
  },
  getInvitations: async (): Promise<InvitationResponse> => {
    const response = await fetchAPI('GET', '/user/invitations');
    if (!response.ok) {
      throw new Error(`Error fetching invitations: ${response.statusText}`);
    }
    return response.json();
  },
  acceptInvitation: async (userId: string): Promise<{ message: string }> => {
    const response = await fetchAPI(
      'POST',
      `/user/${userId}/accept-invitation`,
    );
    if (!response.ok) {
      throw new Error(`Error accepting invitation: ${response.statusText}`);
    }
    return response.json();
  },
  denyInvitation: async (userId: string): Promise<{ message: string }> => {
    const response = await fetchAPI('POST', `/user/${userId}/deny-invitation`);
    if (!response.ok) {
      throw new Error(`Error denying invitation: ${response.statusText}`);
    }
    return response.json();
  },

  updateUsername: async (username: string): Promise<{ message: string }> => {
    const response = await fetchAPI('PUT', '/user/username', {
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
    drawingImage: Blob,
  ): Promise<UserPromptSubmission> => {
    // Create form data
    const formData = new FormData();
    formData.append('image', drawingImage, 'drawing.png');

    const response = await fetchAPI('POST', '/submission/daily', {
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error submitting daily prompt: ${response.text}`);
    }
    return response.json();
  },

  uploadCustomAvatar: async (
    profileImage: Blob,
  ): Promise<{ message: string }> => {
    // Create form data
    const formData = new FormData();
    formData.append('image', profileImage, 'profile-pic.png');

    const response = await fetchAPI('POST', '/user/profile-pic', {
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error uploading new profile picture: ${response.text}`);
    }
    return response.json();
  },

  toggleAvatarType: async (): Promise<{ message: string }> => {
    const response = await fetchAPI('PUT', '/user/profile-pic/toggle');

    if (!response.ok) {
      throw new Error(`Error toggling avatar type: ${response.text}`);
    }
    return response.json();
  },

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
  getActivityFeed: async (): Promise<ActivityFeedResponse> => {
    const response = await fetchAPI('GET', '/activity');
    if (!response.ok) {
      throw new Error('Failed to fetch activity feed');
    }

    return response.json();
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
      throw new Error(`Error swapping favorite order: ${response.statusText}`);
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

  getUserAchievements: async (): Promise<AchievementsAndRewardsResponse> => {
    const response = await fetchAPI('GET', `/user/achievements`);
    if (!response.ok) {
      throw new Error('Failed to fetch user achievements');
    }
    const json = await response.json();
    const test = {
      ...json,
      rewards: new Map(Object.entries(json.rewards)),
    };

    return test;
  },

  // Admin endpoints
  getAdminDashboard: async (
    searchQuery?: string,
  ): Promise<{
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
    stats: {
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
      recentUsers: Array<{
        ID: string;
        Username: string;
        Email: string;
        CreatedAt: string;
      }>;
    };
  }> => {
    const url = searchQuery
      ? `/admin/dashboard?search=${encodeURIComponent(searchQuery)}`
      : '/admin/dashboard';
    const response = await fetchAPI('GET', url);
    if (!response.ok) {
      throw new Error(`Error fetching admin dashboard: ${response.statusText}`);
    }
    return response.json();
  },

  impersonateUser: async (
    userId: string,
  ): Promise<{
    message: string;
    impersonatedUser: {
      id: string;
      username: string;
      email: string;
    };
  }> => {
    const response = await fetchAPI('POST', '/admin/impersonate', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      throw new Error(`Error impersonating user: ${response.statusText}`);
    }
    return response.json();
  },

  createPrompt: async (data: {
    day: string;
    prompt: string;
    colors: Array<string>;
  }): Promise<{ message: string; day: string }> => {
    const response = await fetchAPI('POST', '/admin/prompt', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Error creating prompt: ${response.statusText}`);
    }
    return response.json();
  },

  getAdminActionStats: async (
    start: string,
    end: string,
  ): Promise<Array<DailyActionStat>> => {
    const response = await fetchAPI(
      'GET',
      `/admin/action-stats?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    if (!response.ok) {
      throw new Error(
        `Error fetching admin action stats: ${response.statusText}`,
      );
    }
    return response.json();
  },
};
