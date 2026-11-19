import { describe, expect, it } from 'vitest';
import { pickTips } from '../tips';
import type { Achievement, User } from '@/api/Api';

const now = new Date('2026-11-18T12:00:00Z');

const base = {
  incomingInvites: [],
  achievements: [],
  unlockedDecorations: [],
  wearing: '',
  faceUnlocked: false,
  hasDrawnFace: false,
  event: null,
  friendCount: 5,
  seen: [],
  now,
} as const;

const sticker = (id: string, achievedAt: string | null) =>
  ({ id, achievedAt }) as unknown as Achievement;

const ids = (input: Partial<Parameters<typeof pickTips>[0]>) =>
  pickTips({ ...base, ...input }).map((tip) => tip.id);

describe('pickTips', () => {
  it('suggests nothing to someone who has done it all', () => {
    expect(ids({})).toEqual([]);
  });

  it('nudges you to draw your face only once it is unlocked and undrawn', () => {
    expect(ids({ faceUnlocked: true })).toEqual(['face']);
    expect(ids({ faceUnlocked: true, hasDrawnFace: true })).toEqual([]);
    expect(ids({ faceUnlocked: false })).toEqual([]);
  });

  it('shows decorations you own but are not wearing', () => {
    expect(
      ids({
        unlockedDecorations: ['FIRST_SNOW', 'CHRISTMAS_LIGHTS'],
        wearing: 'FIRST_SNOW',
      }),
    ).toEqual(['decoration:CHRISTMAS_LIGHTS']);
  });

  it('only celebrates stickers from the last few days', () => {
    expect(
      ids({
        achievements: [
          sticker('fresh', '2026-11-17T09:00:00Z'),
          sticker('old', '2026-11-01T09:00:00Z'),
          sticker('locked', null),
        ],
      }),
    ).toEqual(['sticker:fresh']);
  });

  it('hides tips you have seen, invites included', () => {
    const invites = [{ id: 'jim' }, { id: 'ann' }] as Array<User>;
    expect(
      ids({ incomingInvites: invites, faceUnlocked: true, seen: ['face'] }),
    ).toEqual(['invite:jim', 'invite:ann']);
    expect(
      ids({
        incomingInvites: invites,
        faceUnlocked: true,
        seen: ['invite:jim'],
      }),
    ).toEqual(['invite:ann', 'face']);
  });

  it('suggests friends only when you have a couple', () => {
    expect(ids({ friendCount: 0 })).toEqual([]);
    expect(ids({ friendCount: 2 })).toEqual(['friends']);
  });

  it('shows one tip of each kind, skipping ones you have seen', () => {
    expect(
      ids({
        unlockedDecorations: ['FIRST_SNOW', 'CHRISTMAS_LIGHTS'],
        achievements: [
          sticker('a', '2026-11-18T09:00:00Z'),
          sticker('b', '2026-11-18T08:00:00Z'),
        ],
        seen: ['sticker:a'],
      }),
    ).toEqual(['sticker:b', 'decoration:FIRST_SNOW']);
  });

  it('keeps the three most pressing', () => {
    expect(
      ids({
        incomingInvites: [{ id: 'jim' } as User],
        faceUnlocked: true,
        event: { slug: 'xmas', name: 'christmas' },
        friendCount: 1,
        achievements: [sticker('fresh', '2026-11-18T09:00:00Z')],
      }),
    ).toEqual(['invite:jim', 'sticker:fresh', 'face']);
  });
});
