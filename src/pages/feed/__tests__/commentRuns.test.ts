import { describe, expect, it } from 'vitest';
import { commentRuns } from '../commentRuns';
import type { Comment, User } from '@/api/Api';

const comment = (id: string, userId: string) =>
  ({ id, user: { id: userId } as User }) as Comment;

describe('commentRuns', () => {
  it('joins back-to-back comments from one person into one run', () => {
    const runs = commentRuns([
      comment('1', 'ann'),
      comment('2', 'ann'),
      comment('3', 'bob'),
      comment('4', 'ann'),
    ]);
    expect(
      runs.map((run) => [run.user.id, run.comments.map((c) => c.id)]),
    ).toEqual([
      ['ann', ['1', '2']],
      ['bob', ['3']],
      ['ann', ['4']],
    ]);
  });

  it('has no runs without comments', () => {
    expect(commentRuns([])).toEqual([]);
  });
});
