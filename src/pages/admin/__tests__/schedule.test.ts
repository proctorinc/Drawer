import { describe, expect, it } from 'vitest';
import { dayAfter, nextOpenDay, openDays } from '../schedule';

describe('schedule', () => {
  const taken = new Set(['2026-11-20', '2026-11-21']);

  it('steps across months', () => {
    expect(dayAfter('2026-11-30')).toBe('2026-12-01');
  });

  it('skips taken days to find the next open one', () => {
    expect(nextOpenDay(taken, '2026-11-20')).toBe('2026-11-22');
    expect(nextOpenDay(taken, '2026-11-19')).toBe('2026-11-19');
  });

  it('lists only open days in the window', () => {
    expect(openDays(taken, '2026-11-19', 4)).toEqual([
      '2026-11-19',
      '2026-11-22',
    ]);
  });
});
