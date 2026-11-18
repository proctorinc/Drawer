import { describe, expect, it } from 'vitest';
import { rollCall, rollCallTagline } from '../rollCall';
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

describe('rollCallTagline', () => {
  it.each([
    [3, 3, false, 'full house! everyone drew today'],
    [0, 2, true, "you're first! poke your friends to join in"],
    [0, 2, false, 'blank pages all round. go first and set the bar'],
    [2, 3, true, 'waiting on 1 slowpoke. give them a poke!'],
    [1, 3, true, 'waiting on 2 slowpokes. give them a poke!'],
    [2, 5, false, "2 already drew. don't let them have all the fun"],
  ])('%i of %i drew (you drew: %s)', (drawn, total, iDrew, expected) => {
    expect(rollCallTagline(drawn, total, iDrew)).toBe(expected);
  });
});
