import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AIDialogueProvider, useAIDialogue } from '../AIDialogue';
import type { FC } from 'react';
import type { AIReview, UserPromptSubmission } from '@/api/Api';
import type { AnimationQueueApi } from '@/animations/AnimationQueue';
import type { StageProps } from '@/animations/types';
import {
  AnimationQueueProvider,
  useAnimationQueue,
} from '@/animations/AnimationQueue';
import { apiClient } from '@/api/apiClient';

vi.mock('@/api/apiClient', () => ({
  fetchAPI: vi.fn(),
  apiClient: {
    getPromptSubmission: vi.fn(),
    markAIReviewHeard: vi.fn().mockResolvedValue(undefined),
  },
}));

// Stand-ins for the stage animations: each says what it is, and the pin can be
// finished from the test
let finishPin: () => void = () => {};
vi.mock('@/animations/registry', () => ({
  stageRegistry: {
    pin: ({ onDone }: StageProps<'pin'>) => {
      finishPin = onDone;
      return <p>pinning</p>;
    },
    review: () => <p>judge talking</p>,
    xp: () => <p>xp filling</p>,
  },
  TickerComponent: () => null,
  preloadStage: () => {},
}));

const review = (status: AIReview['status']): AIReview => ({
  submissionId: 's1',
  judge: { id: 'j1', name: 'Sir Doodleton', bio: '', avatarUrl: '' },
  status,
  score: status === 'done' ? 7 : null,
  criteria: [],
  comment: status === 'done' ? 'A fine city.' : '',
  createdAt: '2026-11-21T00:00:00Z',
});

const submission = (status: AIReview['status']) =>
  ({
    id: 's1',
    prompt: 'a prehistoric city',
    imageUrl: '/doodle.png',
    aiReview: review(status),
  }) as unknown as UserPromptSubmission;

const level = (xp: number) => ({
  level: 1,
  xp,
  levelStartXp: 0,
  nextLevelXp: 100,
});

let queue!: AnimationQueueApi;
let dialogue!: ReturnType<typeof useAIDialogue>;
const Grab: FC = () => {
  queue = useAnimationQueue();
  dialogue = useAIDialogue();
  return null;
};

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AIDialogueProvider', () => {
  it("keeps a just-drawn doodle's review ahead of its XP when the bell hears it first", async () => {
    const getSubmission = vi.mocked(apiClient.getPromptSubmission);
    getSubmission.mockResolvedValue(submission('pending'));
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AnimationQueueProvider devHandle={false}>
          <AIDialogueProvider>
            <Grab />
          </AIDialogueProvider>
        </AnimationQueueProvider>
      </QueryClientProvider>,
    );

    // Submit: the pin plays, the judge's turn is held, then the XP queues
    act(() => {
      void queue.enqueue({
        id: 'pin',
        kind: 'pin',
        payload: { imageUrl: '', from: { x: 0, y: 0, width: 0, height: 0 } },
      });
      dialogue.watchReview('s1');
      void queue.enqueue({
        id: 'xp',
        kind: 'xp',
        payload: { from: level(0), to: level(50), gained: 50 },
      });
    });
    await flush();
    expect(await screen.findByText('pinning')).toBeTruthy();

    // The wall's activity feed comes back with the finished review before the
    // watcher's next poll, and the bell auto-plays it
    act(() => dialogue.showReview(review('done')));
    // Then the watcher sees it's done too
    getSubmission.mockResolvedValue(submission('done'));
    await act(() => queryClient.invalidateQueries());
    await flush();

    act(() => finishPin());
    expect(await screen.findByText('judge talking')).toBeTruthy();
    expect(screen.queryByText('xp filling')).toBeNull();
  });
});
