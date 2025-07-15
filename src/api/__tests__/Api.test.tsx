import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useGetDailyPrompt,
  useGetMe,
  useGetMyProfile,
  useGetUserProfile,
  usePromptSubmission,
  useCreateUser,
  useLoginUser,
  useLogoutUser,
  useAddFriend,
  useUpdateUsername,
  useAddComment,
  useToggleSubmissionReaction,
  useToggleCommentReaction,
  useActivityFeed,
  useMarkActivityRead,
} from '../Api';
import { apiClient } from '../apiClient';

// Mock the API client
vi.mock('../apiClient', () => ({
  apiClient: {
    getDailyPrompt: vi.fn(),
    getMe: vi.fn(),
    getMyProfile: vi.fn(),
    getUserProfile: vi.fn(),
    getPromptSubmission: vi.fn(),
    createUser: vi.fn(),
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
    addFriend: vi.fn(),
    updateUsername: vi.fn(),
    addComment: vi.fn(),
    toggleSubmissionReaction: vi.fn(),
    toggleCommentReaction: vi.fn(),
    getActivityFeed: vi.fn(),
    markActivityRead: vi.fn(),
  },
}));

// Wrapper component for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('React Query Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Hooks', () => {
    it('should use getDailyPrompt hook successfully', async () => {
      const mockData = {
        day: '2024-01-15',
        colors: ['#2C3E50', '#34495E', '#7F8C8D'],
        prompt: 'A sunset over mountains',
        isCompleted: false,
      };

      vi.mocked(apiClient.getDailyPrompt).mockResolvedValue(mockData);

      const { result } = renderHook(() => useGetDailyPrompt(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(apiClient.getDailyPrompt).toHaveBeenCalledTimes(1);
    });

    it('should use getMe hook successfully', async () => {
      const mockData = {
        id: 'user1',
        username: 'TestUser',
        email: 'test@example.com',
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(apiClient.getMe).mockResolvedValue(mockData);

      const { result } = renderHook(() => useGetMe(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(apiClient.getMe).toHaveBeenCalledTimes(1);
    });

    it('should use getUserProfile hook successfully', async () => {
      const userId = 'user123';
      const mockData = {
        user: {
          id: userId,
          username: 'TestUser',
          email: 'test@example.com',
          createdAt: new Date(),
        },
        prompts: [],
        feed: [],
        friends: [],
        stats: { totalDrawings: 5, currentStreak: 3 },
      };

      vi.mocked(apiClient.getUserProfile).mockResolvedValue(mockData);

      const { result } = renderHook(() => useGetUserProfile(userId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(apiClient.getUserProfile).toHaveBeenCalledWith(userId);
    });

    it('should use getPromptSubmission hook successfully', async () => {
      const submissionId = 'sub123';
      const mockData = {
        id: submissionId,
        day: '2024-01-15',
        colors: ['#2C3E50'],
        prompt: 'A sunset',
        isCompleted: true,
        imageUrl: 'https://example.com/image.png',
        user: {
          id: 'user1',
          username: 'TestUser',
          email: 'test@example.com',
          createdAt: new Date(),
        },
        comments: [],
        reactions: [],
        counts: [],
      };

      vi.mocked(apiClient.getPromptSubmission).mockResolvedValue(mockData);

      const { result } = renderHook(() => usePromptSubmission(submissionId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(apiClient.getPromptSubmission).toHaveBeenCalledWith(submissionId);
    });

    it('should use getActivityFeed hook successfully', async () => {
      const mockData = [
        {
          id: 'activity1',
          user: {
            id: 'user1',
            username: 'TestUser',
            email: 'test@example.com',
            createdAt: new Date(),
          },
          action: 'comment' as const,
          date: new Date(),
          isRead: false,
          comment: {
            id: 'comment1',
            user: {
              id: 'user1',
              username: 'TestUser',
              email: 'test@example.com',
              createdAt: new Date(),
            },
            text: 'Great drawing!',
            createdAt: new Date(),
            reactions: [],
            counts: [],
          },
          submission: {
            id: 'sub1',
            prompt: 'A sunset over mountains',
            imageUrl: 'https://example.com/image.png',
          },
        },
      ];

      vi.mocked(apiClient.getActivityFeed).mockResolvedValue(mockData);

      const { result } = renderHook(() => useActivityFeed(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(apiClient.getActivityFeed).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mutation Hooks', () => {
    it('should use createUser mutation successfully', async () => {
      const userData = { username: 'testuser', email: 'test@example.com' };
      const mockResponse = { message: 'User created successfully' };

      vi.mocked(apiClient.createUser).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCreateUser(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(userData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.createUser).toHaveBeenCalledWith(userData);
    });

    it('should use loginUser mutation successfully', async () => {
      const email = 'test@example.com';
      const mockResponse = { message: 'Login successful' };

      vi.mocked(apiClient.loginUser).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLoginUser(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(email);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.loginUser).toHaveBeenCalledWith(email);
    });

    it('should use addComment mutation successfully', async () => {
      const commentData = { submissionId: 'sub123', text: 'Great drawing!' };
      const mockResponse = {
        id: 'comment1',
        text: 'Great drawing!',
        user: {
          id: 'user1',
          username: 'TestUser',
          email: 'test@example.com',
          createdAt: new Date(),
        },
        createdAt: new Date(),
        reactions: [],
        counts: [],
      };

      vi.mocked(apiClient.addComment).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAddComment(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(commentData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.addComment).toHaveBeenCalledWith(
        commentData.submissionId,
        commentData.text,
      );
    });

    it('should use toggleSubmissionReaction mutation successfully', async () => {
      const reactionData = {
        submissionId: 'sub123',
        reactionId: 'heart' as const,
      };
      const mockResponse = {
        reactions: [
          {
            id: 1,
            reactionId: 'heart',
            user: {
              id: 'user1',
              username: 'TestUser',
              email: 'test@example.com',
              createdAt: new Date(),
            },
            createdAt: new Date(),
          },
        ],
        counts: [{ reactionId: 'heart', count: 1 }],
      };

      vi.mocked(apiClient.toggleSubmissionReaction).mockResolvedValue(
        mockResponse,
      );

      const { result } = renderHook(() => useToggleSubmissionReaction(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(reactionData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.toggleSubmissionReaction).toHaveBeenCalledWith(
        reactionData.submissionId,
        reactionData.reactionId,
      );
    });

    it('should use markActivityRead mutation successfully', async () => {
      const activityId = 'activity123';
      const mockResponse = { message: 'Activity marked as read' };

      vi.mocked(apiClient.markActivityRead).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useMarkActivityRead(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(activityId);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(apiClient.markActivityRead).toHaveBeenCalledWith(activityId);
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully', async () => {
      const error = new Error('Network error');
      vi.mocked(apiClient.getDailyPrompt).mockRejectedValue(error);

      const { result } = renderHook(() => useGetDailyPrompt(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(error);
    });

    it('should handle mutation errors gracefully', async () => {
      const error = new Error('Validation error');
      vi.mocked(apiClient.createUser).mockRejectedValue(error);

      const { result } = renderHook(() => useCreateUser(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ username: 'test', email: 'test@example.com' });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(error);
    });
  });
});
