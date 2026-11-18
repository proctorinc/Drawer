import { describe, expect, it } from 'vitest';
import { rollCall } from '../rollCall';
import type { FriendSubmissionStatus, User } from '@/api/Api';

const status = (id: string, hasSubmittedToday: boolean) =>
  ({ user: { id } as User, hasSubmittedToday }) as FriendSubmissionStatus;

describe('rollCall', () => {
  it('leaves you out and splits friends by whether they drew', () => {
    const { drawn, stillDrawing } = rollCall(
      [status('me', true), status('ann', true), status('bob', false)],
      'me',
    );
    expect(drawn.map((f) => f.user.id)).toEqual(['ann']);
    expect(stillDrawing.map((f) => f.user.id)).toEqual(['bob']);
  });
});
