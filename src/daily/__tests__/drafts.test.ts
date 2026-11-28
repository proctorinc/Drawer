import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDraft,
  clearOldDrafts,
  clearRedoDraft,
  dayBefore,
  draftKey,
  hasDraft,
  redoDraftKey,
  stickerDraftKey,
} from '../drafts';

describe('drafts', () => {
  beforeEach(() => localStorage.clear());

  it('finds the day before, across months and years', () => {
    expect(dayBefore('2026-11-23')).toBe('2026-11-22');
    expect(dayBefore('2026-12-01')).toBe('2026-11-30');
    expect(dayBefore('2027-01-01T00:00:00Z')).toBe('2026-12-31');
    expect(dayBefore('2028-03-01')).toBe('2028-02-29');
  });

  it("keeps today's and yesterday's drafts and drops the rest", () => {
    for (const day of ['2026-11-21', '2026-11-22', '2026-11-23']) {
      localStorage.setItem(draftKey(day), '[]');
    }
    localStorage.setItem(draftKey(undefined), '[]');
    localStorage.setItem('SOMETHING_ELSE', 'x');

    clearOldDrafts('2026-11-23');

    expect(hasDraft('2026-11-23')).toBe(true);
    expect(hasDraft('2026-11-22')).toBe(true);
    expect(hasDraft('2026-11-21')).toBe(false);
    expect(localStorage.getItem(draftKey(undefined))).toBeNull();
    expect(localStorage.getItem('SOMETHING_ELSE')).toBe('x');
  });

  it('forgets a pinned draft', () => {
    localStorage.setItem(draftKey('2026-11-22'), '[]');
    clearDraft('2026-11-22T00:00:00Z');
    expect(hasDraft('2026-11-22')).toBe(false);
  });

  it('keeps the stickers on drawings that can still be pinned', () => {
    for (const day of [
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ]) {
      localStorage.setItem(stickerDraftKey(day), '{}');
    }
    localStorage.setItem(redoDraftKey('2026-11-20'), '[]');

    clearOldDrafts('2026-11-23');

    const kept = (day: string) => localStorage.getItem(stickerDraftKey(day));
    expect(kept('2026-11-23')).not.toBeNull();
    expect(kept('2026-11-22')).not.toBeNull();
    // A redo in progress
    expect(kept('2026-11-20')).not.toBeNull();
    expect(kept('2026-11-21')).toBeNull();
  });

  it('forgets the sticker along with a pinned drawing', () => {
    localStorage.setItem(stickerDraftKey('2026-11-22'), '{}');
    localStorage.setItem(stickerDraftKey('2026-11-01'), '{}');
    clearDraft('2026-11-22');
    clearRedoDraft('2026-11-01');
    expect(localStorage.getItem(stickerDraftKey('2026-11-22'))).toBeNull();
    expect(localStorage.getItem(stickerDraftKey('2026-11-01'))).toBeNull();
  });
});
