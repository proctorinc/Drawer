import { describe, expect, it } from 'vitest';
import { bookDoodles } from '../components/DayCarousel';
import type { UserPromptSubmission } from '@/api/Api';

const doodle = (id: string, day: string) =>
  ({ id, day }) as UserPromptSubmission;

describe('bookDoodles', () => {
  it('flips through the whole book oldest first, like the calendar', () => {
    const prompts = [
      doodle('today', '2026-11-24'),
      doodle('first', '2026-11-02T00:00:00Z'),
      doodle('middle', '2026-11-10'),
    ];
    expect(bookDoodles(prompts, prompts[2]).map((d) => d.id)).toEqual([
      'first',
      'middle',
      'today',
    ]);
  });

  it('keeps the opened doodle while the book is still loading', () => {
    const opened = doodle('opened', '2026-11-10');
    expect(bookDoodles([], opened)).toEqual([opened]);
  });
});
