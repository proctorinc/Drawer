import { describe, expect, it } from 'vitest';
import { collapsedLayout, expandedLayout, rollCall } from '../rollCall';
import type { FriendSubmissionStatus, User } from '@/api/Api';

const status = (id: string, hasSubmittedToday: boolean) =>
  ({ user: { id } as User, hasSubmittedToday }) as FriendSubmissionStatus;
const me = { id: 'me' } as User;

describe('rollCall', () => {
  it('puts you first among whoever drew', () => {
    const { drawn, stillDrawing, friendCount } = rollCall(
      [status('ann', true), status('me', true), status('bob', false)],
      me,
      true,
    );
    expect(drawn.map((f) => f.user.id)).toEqual(['me', 'ann']);
    expect(stillDrawing.map((f) => f.user.id)).toEqual(['bob']);
    expect(friendCount).toBe(2);
  });

  it('adds you when the feed leaves you out', () => {
    const { drawn } = rollCall([status('ann', true)], me, true);
    expect(drawn.map((f) => f.user.id)).toEqual(['me', 'ann']);
  });
});

describe('collapsedLayout', () => {
  it('spaces a few people out without overlapping', () => {
    const { spots } = collapsedLayout(2, 1, 300, 36);
    expect(spots).toEqual([
      { x: 0, y: 0 },
      { x: 42, y: 0 },
      { x: 264, y: 0 },
    ]);
  });

  it('overlaps a crowd so everyone fits', () => {
    const { spots } = collapsedLayout(8, 8, 300, 36);
    expect(spots.every(Boolean)).toBe(true);
    const lastDrawn = spots[7]!.x + 36;
    const lastStill = spots[15]!.x;
    expect(lastDrawn).toBeLessThanOrEqual(lastStill);
  });

  it('leaves people off once the overlap gets too tight', () => {
    const { spots } = collapsedLayout(30, 10, 300, 36);
    const shownDrawn = spots.slice(0, 30).filter(Boolean).length;
    const shownStill = spots.slice(30).filter(Boolean).length;
    expect(shownDrawn + shownStill).toBeLessThan(40);
    // Still roughly three to one, and you (first) stay on
    expect(shownDrawn).toBeGreaterThan(shownStill * 2);
    expect(shownStill).toBeGreaterThan(0);
    expect(spots[0]).not.toBeNull();
  });
});

describe('expandedLayout', () => {
  it('puts the still-drawing rows below the drawn ones', () => {
    const { spots } = expandedLayout(3, 2, 300, 36);
    expect(spots[3]!.y).toBeGreaterThan(spots[2]!.y);
    expect(spots[0]!.x).toBe(0);
  });
});
