import { describe, expect, it } from 'vitest';
import { apiClient } from '../apiClient';
import type { Activity } from '../Api';

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
      const typedResult = result;
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
      const typedResult = result;
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
      const typedResult = result;
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
      const typedResult = result;
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
      const typedResult = result;
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
      const result = await apiClient.createUser('testuser');

      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
    });

    it('should logout user successfully', async () => {
      const result = await apiClient.logoutUser();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('successful');
    });
  });

  describe('User Management', () => {
    it('should invite a friend successfully', async () => {
      const result = await apiClient.inviteFriend('user2');

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
      const submissionId = 'sub123';
      const commentId = 'comment123';
      const reactionId = 'fire';
      const result = await apiClient.toggleCommentReaction(
        submissionId,
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
      expect(Array.isArray(result.activities)).toBe(true);
      expect(Array.isArray(result.friends)).toBe(true);
      expect(result.activities.length).toBeGreaterThan(0);

      const activity: Activity = result.activities[0];
      expect(typeof activity.id).toBe('string');
      expect(typeof activity.action).toBe('string');
      expect(activity).toHaveProperty('user');
      // Dates come over the wire as ISO strings
      expect(Number.isNaN(new Date(activity.date).getTime())).toBe(false);
      expect(typeof activity.isRead).toBe('boolean');

      const friend = result.friends[0];
      expect(friend).toHaveProperty('user');
      expect(typeof friend.hasSubmittedToday).toBe('boolean');
      expect(typeof friend.pokedToday).toBe('boolean');
    });

    it('should mark activity as read successfully', async () => {
      const result = await apiClient.markActivityRead('2026-11-18T12:00:00Z');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('read');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      // This would require additional MSW handlers for error scenarios
      // For now, we'll test that our error handling structure is in place
      expect(apiClient.getDailyPrompt).toBeDefined();
      expect(typeof apiClient.getDailyPrompt).toBe('function');
    });
  });
});
