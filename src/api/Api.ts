import { Config } from '@/config/Config';
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

export interface UserPromptSubmission extends DailyPrompt {
  imageUrl: string;
  user: User;
}

export interface UserStats {
  totalDrawings: number;
  currentStreak: number;
}

export interface GetMeResponse {
  user: User;
  prompts: Array<UserPromptSubmission>;
  feed: Map<string, Array<UserPromptSubmission>>;
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
    mutationFn: async (friendID: string) => {
      const response = await fetchAPI('POST', '/add-friend', {
        body: JSON.stringify({ friendID }),
      });
      if (!response.ok) {
        throw new Error(`Error adding friend: ${response.statusText}`);
      }
      return response.json() as Promise<void>;
    },
  });
}
