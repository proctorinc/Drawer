import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactionBar } from '../ReactionBar';
import type { Reaction, User, UserPromptSubmission } from '@/api/Api';

vi.mock('@/api/apiClient', () => ({ fetchAPI: vi.fn() }));
vi.mock('@/api/Api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useToggleSubmissionReaction: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/auth/hooks/useUser', () => ({ default: () => ({ id: 'me' }) }));
vi.mock(
  '@/pages/profile/components/profile-icons/UserProfileIcon',
  () => ({
    UserProfileIcon: ({ user }: { user: User }) => (
      <i data-testid="face">{user.id}</i>
    ),
  }),
);
vi.mock('../ReactionDrawer', () => ({ ReactionDrawer: () => null }));

const user = (id: string) => ({ id, username: id }) as User;
const reaction = (id: string, by: string, at: string): Reaction =>
  ({
    id,
    reactionId: 'love',
    user: user(by),
    createdAt: at,
  }) as unknown as Reaction;

function renderBar(owner: string, reactions: Array<Reaction>) {
  const submission = {
    id: 's1',
    user: user(owner),
    reactions,
    counts: [],
  } as unknown as UserPromptSubmission;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ReactionBar submission={submission} />
    </QueryClientProvider>,
  );
}

describe('ReactionBar', () => {
  it('puts your reactions first, then everyone else oldest first, each with a face', () => {
    renderBar('alice', [
      reaction('r1', 'bob', '2026-11-20T01:00:00Z'),
      reaction('r2', 'me', '2026-11-20T03:00:00Z'),
      reaction('r3', 'carol', '2026-11-20T02:00:00Z'),
    ]);
    expect(screen.getAllByTestId('face').map((f) => f.textContent)).toEqual([
      'me',
      'bob',
      'carol',
    ]);
    // Only yours can be taken back, and there's a plus to add more
    expect(screen.getAllByRole('button').map((b) => b.ariaLabel)).toEqual([
      'Take back your Love it',
      'Add a reaction',
    ]);
  });

  it("shows just a plus with no reactions on someone else's doodle", () => {
    const { container } = renderBar('alice', []);
    expect(screen.getByRole('button', { name: 'Add a reaction' })).toBeTruthy();
    expect(container.textContent).toBe('');
  });

  it('shows nothing with no reactions on your own doodle', () => {
    const { container } = renderBar('me', []);
    expect(container.innerHTML).toBe('');
  });
});
