import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ReviewTipsButton,
  ReviewTipsList,
  shouldOfferTips,
} from '../ReviewTips';
import type { ReviewTips } from '../ReviewTips';
import type { AIReview } from '@/api/Api';
import { fetchAPI } from '@/api/apiClient';

vi.mock('@/api/apiClient', () => ({ fetchAPI: vi.fn() }));
const enqueue = vi.fn();
vi.mock('@/animations/AnimationQueue', () => ({
  useAnimationQueue: () => ({ enqueue }),
}));

const judge = {
  id: 'j1',
  name: 'Sir Doodleton',
  bio: '',
  avatarUrl: '',
  decoration: '',
};

const tips = (overrides: Partial<ReviewTips> = {}): ReviewTips => ({
  prompt: 'complete',
  promptMissing: '',
  tips: {
    judge: ['Fill the square with the goalie.'],
    general: ['Erase a thin gap between the arms.'],
  },
  ...overrides,
});

const renderButton = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReviewTipsButton submissionId="s1" judge={judge} />
    </QueryClientProvider>,
  );

describe('ReviewTipsList', () => {
  it('groups tips by the judge and drawing in general', () => {
    render(<ReviewTipsList tips={tips()} judge={judge} />);
    expect(screen.getByText('for Sir Doodleton')).toBeTruthy();
    expect(screen.getByText('Fill the square with the goalie.')).toBeTruthy();
    expect(screen.getByText('drawing & the prompt')).toBeTruthy();
    expect(screen.getByText('Erase a thin gap between the arms.')).toBeTruthy();
    expect(
      screen.getByText('You showed every part of the prompt.'),
    ).toBeTruthy();
  });

  it('calls out the parts of the prompt you missed', () => {
    render(
      <ReviewTipsList
        tips={tips({ prompt: 'partial', promptMissing: 'the goal' })}
        judge={judge}
      />,
    );
    const note = screen.getByText(
      'You missed part of the prompt',
    ).parentElement;
    expect(note?.textContent).toBe('You missed part of the prompt: the goal');
  });
});

describe('ReviewTipsButton', () => {
  it('opens the tips in a modal', async () => {
    vi.mocked(fetchAPI).mockResolvedValue(new Response(JSON.stringify(tips())));
    renderButton();
    fireEvent.click(
      await screen.findByRole('button', { name: /How to improve my drawing/ }),
    );
    expect(enqueue).toHaveBeenCalledWith({
      id: 'review-tips-s1',
      kind: 'reviewTips',
      payload: { submissionId: 's1', judge },
    });
  });

  it('flags a missed prompt on the button', async () => {
    vi.mocked(fetchAPI).mockResolvedValue(
      new Response(JSON.stringify(tips({ prompt: 'missed' }))),
    );
    renderButton();
    const button = await screen.findByRole('button', {
      name: /How to improve my drawing/,
    });
    expect(button.textContent).toContain('you missed part of the prompt');
  });

  it('shows nothing for a doodle judged before tips', async () => {
    vi.mocked(fetchAPI).mockResolvedValue(new Response(null, { status: 404 }));
    renderButton();
    await vi.waitFor(() => expect(fetchAPI).toHaveBeenCalled());
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('shouldOfferTips', () => {
  beforeEach(() => localStorage.clear());

  const review = (overrides: Partial<AIReview> = {}): AIReview => ({
    submissionId: 's1',
    judge,
    status: 'done',
    score: 3.5,
    criteria: [],
    comment: 'Hm.',
    createdAt: '',
    ...overrides,
  });

  it('offers them once after a low score', () => {
    expect(shouldOfferTips(review())).toBe(true);
    expect(shouldOfferTips(review())).toBe(false);
  });

  it("doesn't offer them for a decent score", () => {
    expect(shouldOfferTips(review({ score: 4 }))).toBe(false);
  });

  it("doesn't offer them when a low score is good news (the Grinch)", () => {
    expect(
      shouldOfferTips(review({ judge: { ...judge, scoresBackwards: true } })),
    ).toBe(false);
  });
});
