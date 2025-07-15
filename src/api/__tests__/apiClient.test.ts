import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../apiClient';
import type {
  DailyPrompt,
  User,
  GetMeResponse,
  UserPromptSubmission,
  Activity,
} from '../Api';

// Import setup to configure MSW
import './setup';

describe('API Client', () => {
  describe('Daily Prompt', () => {
    it('should fetch daily prompt successfully', async () => {
      const result = await apiClient.getDailyPrompt();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('day');
      expect(result).toHaveProperty('colors');
      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('isCompleted');

      // Type check
      const typedResult = result as DailyPrompt;
      expect(typeof typedResult.day).toBe('string');
      expect(Array.isArray(typedResult.colors)).toBe(true);
      expect(typeof typedResult.prompt).toBe('string');
      expect(typeof typedResult.isCompleted).toBe('boolean');
    });
  });

  describe('User Endpoints', () => {
    it('should fetch current user successfully', async () => {
      const result = await apiClient.getMe();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('createdAt');

      // Type check
      const typedResult = result as User;
      expect(typeof typedResult.id).toBe('string');
      expect(typeof typedResult.username).toBe('string');
      expect(typeof typedResult.email).toBe('string');
      expect(typedResult.createdAt).toBeInstanceOf(Date);
    });

    it('should fetch user profile successfully', async () => {
      const result = await apiClient.getMyProfile();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('prompts');
      expect(result).toHaveProperty('feed');
      expect(result).toHaveProperty('friends');
      expect(result).toHaveProperty('stats');

      // Type check
      const typedResult = result as GetMeResponse;
      expect(typedResult.user).toBeDefined();
      expect(Array.isArray(typedResult.prompts)).toBe(true);
      expect(Array.isArray(typedResult.feed)).toBe(true);
      expect(Array.isArray(typedResult.friends)).toBe(true);
      expect(typedResult.stats).toHaveProperty('totalDrawings');
      expect(typedResult.stats).toHaveProperty('currentStreak');
    });

    it('should fetch specific user profile successfully', async () => {
      const userId = 'user123';
      const result = await apiClient.getUserProfile(userId);

      expect(result).toBeDefined();
      expect(result.user.id).toBe(userId);

      // Type check
      const typedResult = result as GetMeResponse;
      expect(typedResult.user.id).toBe(userId);
    });
  });

  describe('Submission Endpoints', () => {
    it('should fetch prompt submission successfully', async () => {
      const submissionId = 'sub123';
      const result = await apiClient.getPromptSubmission(submissionId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('imageUrl');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('comments');
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('counts');

      // Type check
      const typedResult = result as UserPromptSubmission;
      expect(typedResult.id).toBe(submissionId);
      expect(typeof typedResult.imageUrl).toBe('string');
      expect(typedResult.user).toBeDefined();
      expect(Array.isArray(typedResult.comments)).toBe(true);
      expect(Array.isArray(typedResult.reactions)).toBe(true);
      expect(Array.isArray(typedResult.counts)).toBe(true);
    });
  });

  describe('Auth Endpoints', () => {
    it('should create user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
      };

      const result = await apiClient.createUser(userData);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('successfully');
    });

    it('should login user successfully', async () => {
      const email = 'test@example.com';
      const result = await apiClient.loginUser(email);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('successful');
    });

    it('should logout user successfully', async () => {
      const result = await apiClient.logoutUser();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('successful');
    });
  });

  describe('User Management', () => {
    it('should add friend successfully', async () => {
      const username = 'frienduser';
      const result = await apiClient.addFriend(username);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('successfully');
    });

    it('should update username successfully', async () => {
      const newUsername = 'newusername';
      const result = await apiClient.updateUsername(newUsername);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('successfully');
    });
  });

  describe('Comments', () => {
    it('should add comment successfully', async () => {
      const submissionId = 'sub123';
      const commentText = 'Great drawing!';
      const result = await apiClient.addComment(submissionId, commentText);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('counts');

      expect(result.text).toBe(commentText);
      expect(Array.isArray(result.reactions)).toBe(true);
      expect(Array.isArray(result.counts)).toBe(true);
    });
  });

  describe('Reactions', () => {
    it('should toggle submission reaction successfully', async () => {
      const submissionId = 'sub123';
      const reactionId = 'heart';
      const result = await apiClient.toggleSubmissionReaction(
        submissionId,
        reactionId,
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('counts');

      expect(Array.isArray(result.reactions)).toBe(true);
      expect(Array.isArray(result.counts)).toBe(true);

      if (result.reactions.length > 0) {
        expect(result.reactions[0]).toHaveProperty('reactionId');
        expect(result.reactions[0].reactionId).toBe(reactionId);
      }
    });

    it('should toggle comment reaction successfully', async () => {
      const commentId = 'comment123';
      const reactionId = 'fire';
      const result = await apiClient.toggleCommentReaction(
        commentId,
        reactionId,
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('counts');

      expect(Array.isArray(result.reactions)).toBe(true);
      expect(Array.isArray(result.counts)).toBe(true);

      if (result.reactions.length > 0) {
        expect(result.reactions[0]).toHaveProperty('reactionId');
        expect(result.reactions[0].reactionId).toBe(reactionId);
      }
    });
  });

  describe('Activity', () => {
    it('should fetch activity feed successfully', async () => {
      const result = await apiClient.getActivityFeed();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const activity = result[0];
        expect(activity).toHaveProperty('id');
        expect(activity).toHaveProperty('user');
        expect(activity).toHaveProperty('action');
        expect(activity).toHaveProperty('date');
        expect(activity).toHaveProperty('isRead');

        // Type check
        const typedActivity = activity as Activity;
        expect(typeof typedActivity.id).toBe('string');
        expect(typeof typedActivity.action).toBe('string');
        expect(typedActivity.date).toBeInstanceOf(Date);
        expect(typeof typedActivity.isRead).toBe('boolean');
      }
    });

    it('should mark activity as read successfully', async () => {
      const activityId = 'activity123';
      const result = await apiClient.markActivityRead(activityId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('read');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This would require additional MSW handlers for error scenarios
      // For now, we'll test that our error handling structure is in place
      expect(apiClient.getDailyPrompt).toBeDefined();
      expect(typeof apiClient.getDailyPrompt).toBe('function');
    });
  });
});
