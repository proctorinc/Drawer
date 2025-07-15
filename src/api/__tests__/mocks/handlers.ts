import { http, HttpResponse } from 'msw';
import { Config } from '@/config/Config';

const baseUrl = Config.API_BASE_URL;

// Mock data
const mockDailyPrompt = {
  day: '2024-01-15',
  colors: ['#2C3E50', '#34495E', '#7F8C8D'],
  prompt: 'A sunset over mountains',
  isCompleted: false,
};

const mockUser = {
  id: 'user1',
  username: 'TestUser',
  email: 'test@example.com',
  createdAt: new Date('2024-01-01').toISOString(),
};

const mockUserProfile = {
  user: mockUser,
  prompts: [],
  feed: [],
  friends: [],
  stats: {
    totalDrawings: 5,
    currentStreak: 3,
  },
};

const mockSubmission = {
  id: 'sub1',
  day: '2024-01-15',
  colors: ['#2C3E50', '#34495E', '#7F8C8D'],
  prompt: 'A sunset over mountains',
  isCompleted: true,
  imageUrl: 'https://example.com/image.png',
  user: mockUser,
  comments: [],
  reactions: [],
  counts: [],
};

const mockActivity = {
  id: 'activity1',
  user: mockUser,
  action: 'comment' as const,
  date: new Date().toISOString(),
  isRead: false,
  comment: {
    id: 'comment1',
    user: mockUser,
    text: 'Great drawing!',
    createdAt: new Date().toISOString(),
    reactions: [],
    counts: [],
  },
  submission: {
    id: 'sub1',
    prompt: 'A sunset over mountains',
    imageUrl: 'https://example.com/image.png',
  },
};

export const handlers = [
  // Daily prompt
  http.get(`${baseUrl}/submission/daily`, () => {
    return HttpResponse.json(mockDailyPrompt);
  }),

  // User endpoints
  http.get(`${baseUrl}/user/me`, () => {
    return HttpResponse.json(mockUser);
  }),

  http.get(`${baseUrl}/user/me/profile`, () => {
    return HttpResponse.json(mockUserProfile);
  }),

  http.get(`${baseUrl}/user/:userId/profile`, ({ params }) => {
    return HttpResponse.json({
      ...mockUserProfile,
      user: { ...mockUser, id: params.userId as string },
    });
  }),

  // Submission endpoints
  http.get(`${baseUrl}/submission/:submissionId`, ({ params }) => {
    return HttpResponse.json({
      ...mockSubmission,
      id: params.submissionId as string,
    });
  }),

  // Auth endpoints
  http.post(`${baseUrl}/register`, async ({ request }) => {
    const body = (await request.json()) as {
      username?: string;
      email?: string;
    };
    if (!body?.username || !body?.email) {
      return HttpResponse.json(
        { error: 'Username and email are required' },
        { status: 400 },
      );
    }
    return HttpResponse.json({ message: 'User created successfully' });
  }),

  http.post(`${baseUrl}/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    if (!body?.email) {
      return HttpResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    return HttpResponse.json({ message: 'Login successful' });
  }),

  http.post(`${baseUrl}/logout`, () => {
    return HttpResponse.json({ message: 'Logout successful' });
  }),

  // User management
  http.post(`${baseUrl}/add-friend`, async ({ request }) => {
    const body = (await request.json()) as { username?: string };
    if (!body?.username) {
      return HttpResponse.json(
        { error: 'Username is required' },
        { status: 400 },
      );
    }
    return HttpResponse.json({ message: 'Friend added successfully' });
  }),

  http.put(`${baseUrl}/user/me/username`, async ({ request }) => {
    const body = (await request.json()) as { username?: string };
    if (!body?.username) {
      return HttpResponse.json(
        { error: 'Username is required' },
        { status: 400 },
      );
    }
    return HttpResponse.json({ message: 'Username updated successfully' });
  }),

  // Submissions
  http.post(`${baseUrl}/submission/daily`, async ({ request }) => {
    const formData = await request.formData();
    const image = formData.get('image');

    if (!image) {
      return HttpResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    return HttpResponse.json({
      message: 'Submission successful',
      imageUrl: 'https://example.com/uploaded-image.png',
    });
  }),

  // Comments
  http.post(
    `${baseUrl}/submission/:submissionId/comment`,
    async ({ request, params }) => {
      const body = (await request.json()) as { text?: string };
      if (!body?.text) {
        return HttpResponse.json(
          { error: 'Comment text is required' },
          { status: 400 },
        );
      }

      return HttpResponse.json({
        id: 'comment1',
        user: mockUser,
        text: body.text,
        createdAt: new Date().toISOString(),
        reactions: [],
        counts: [],
      });
    },
  ),

  // Reactions
  http.post(
    `${baseUrl}/submission/:submissionId/reaction`,
    async ({ request, params }) => {
      const body = (await request.json()) as { reactionId?: string };
      if (!body?.reactionId) {
        return HttpResponse.json(
          { error: 'Reaction ID is required' },
          { status: 400 },
        );
      }

      return HttpResponse.json({
        reactions: [
          {
            id: 1,
            reactionId: body.reactionId,
            user: mockUser,
            createdAt: new Date().toISOString(),
          },
        ],
        counts: [
          {
            reactionId: body.reactionId,
            count: 1,
          },
        ],
      });
    },
  ),

  http.post(
    `${baseUrl}/comment/:commentId/reaction`,
    async ({ request, params }) => {
      const body = (await request.json()) as { reactionId?: string };
      if (!body?.reactionId) {
        return HttpResponse.json(
          { error: 'Reaction ID is required' },
          { status: 400 },
        );
      }

      return HttpResponse.json({
        reactions: [
          {
            id: 1,
            reactionId: body.reactionId,
            user: mockUser,
            createdAt: new Date().toISOString(),
          },
        ],
        counts: [
          {
            reactionId: body.reactionId,
            count: 1,
          },
        ],
      });
    },
  ),

  // Activity
  http.get(`${baseUrl}/activity`, () => {
    return HttpResponse.json({
      activities: [mockActivity],
    });
  }),

  http.post(`${baseUrl}/activity`, async ({ request }) => {
    const body = (await request.json()) as { activityId?: string };
    if (!body?.activityId) {
      return HttpResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 },
      );
    }

    return HttpResponse.json({ message: 'Activity marked as read' });
  }),
];
