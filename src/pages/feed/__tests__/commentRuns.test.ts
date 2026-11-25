import { describe, expect, it } from 'vitest';
import { commentThread } from '../commentRuns';
import type { AIReply, Comment, User } from '@/api/Api';

const comment = (id: string, userId: string, minute = 0) =>
  ({
    id,
    user: { id: userId } as User,
    createdAt: new Date(Date.UTC(2026, 10, 25, 10, minute)),
  }) as Comment;

const reply = (id: string, minute: number) =>
  ({
    id,
    createdAt: new Date(Date.UTC(2026, 10, 25, 10, minute)).toISOString(),
  }) as AIReply;

/** Each entry as [who, ids], the judge as 'judge' */
const shape = (thread: ReturnType<typeof commentThread>) =>
  thread.map((entry) =>
    'reply' in entry
      ? ['judge', [entry.reply.id]]
      : [entry.user.id, entry.comments.map((c) => c.id)],
  );

describe('commentThread', () => {
  it('joins back-to-back comments from one person into one run', () => {
    const thread = commentThread([
      comment('1', 'ann'),
      comment('2', 'ann'),
      comment('3', 'bob'),
      comment('4', 'ann'),
    ]);
    expect(shape(thread)).toEqual([
      ['ann', ['1', '2']],
      ['bob', ['3']],
      ['ann', ['4']],
    ]);
  });

  it("puts the judge's replies where they were said, splitting a run", () => {
    const thread = commentThread(
      [comment('1', 'ann', 1), comment('2', 'ann', 3), comment('3', 'bob', 5)],
      [reply('r1', 2), reply('r2', 6)],
    );
    expect(shape(thread)).toEqual([
      ['ann', ['1']],
      ['judge', ['r1']],
      ['ann', ['2']],
      ['bob', ['3']],
      ['judge', ['r2']],
    ]);
  });

  it('is empty with nothing said', () => {
    expect(commentThread([])).toEqual([]);
  });
});
