import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDraft,
  clearOldDrafts,
  dayBefore,
  draftKey,
  hasDraft,
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
});
