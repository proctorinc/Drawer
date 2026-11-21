import { describe, expect, it } from 'vitest';
import { pickTips } from '../tips';

const base = {
  canTurnOnNotifications: false,
  unlockedDecorations: [],
  wearing: '',
  faceUnlocked: false,
  hasDrawnFace: false,
  friendCount: 5,
  seen: [],
} as const;

const ids = (input: Partial<Parameters<typeof pickTips>[0]>) =>
  pickTips({ ...base, ...input }).map((tip) => tip.id);

describe('pickTips', () => {
  it('suggests nothing to someone who has done it all', () => {
    expect(ids({})).toEqual([]);
  });

  it('suggests notifications only when they can be turned on', () => {
    expect(ids({ canTurnOnNotifications: true })).toEqual(['notifications']);
  });

  it('nudges you to draw your face only once it is unlocked and undrawn', () => {
    expect(ids({ faceUnlocked: true })).toEqual(['face']);
    expect(ids({ faceUnlocked: true, hasDrawnFace: true })).toEqual([]);
    expect(ids({ faceUnlocked: false })).toEqual([]);
  });

  it('suggests flair once, only while you have some and wear none', () => {
    expect(
      pickTips({
        ...base,
        unlockedDecorations: ['FIRST_SNOW', 'CHRISTMAS_LIGHTS'],
      }),
    ).toEqual([{ kind: 'flair', id: 'flair', decoration: 'FIRST_SNOW' }]);
    expect(
      ids({ unlockedDecorations: ['FIRST_SNOW'], wearing: 'FIRST_SNOW' }),
    ).toEqual([]);
    expect(ids({ unlockedDecorations: [] })).toEqual([]);
  });

  it('suggests friends only when you have a couple', () => {
    expect(ids({ friendCount: 0 })).toEqual([]);
    expect(ids({ friendCount: 2 })).toEqual(['friends']);
  });

  it('never brings back a tip you closed or tapped', () => {
    expect(
      ids({
        canTurnOnNotifications: true,
        faceUnlocked: true,
        seen: ['notifications'],
      }),
    ).toEqual(['face']);
  });

  it('keeps the three most useful', () => {
    expect(
      ids({
        canTurnOnNotifications: true,
        unlockedDecorations: ['FIRST_SNOW'],
        faceUnlocked: true,
        friendCount: 1,
      }),
    ).toEqual(['notifications', 'flair', 'face']);
  });
});
