import { describe, expect, it } from 'vitest';
import { dayDoodles } from '../components/DayCarousel';
import type { UserPromptSubmission } from '@/api/Api';

const doodle = (id: string, day: string) =>
  ({ id, day }) as UserPromptSubmission;

describe('dayDoodles', () => {
  const feed = [
    doodle('mine', '2026-11-18'),
    doodle('friend', '2026-11-18T00:00:00Z'),
    doodle('yesterday', '2026-11-17'),
  ];

  it("flips through your circle's doodles from that day, in feed order", () => {
    expect(dayDoodles(feed, feed[1]).map((d) => d.id)).toEqual([
      'mine',
      'friend',
    ]);
  });

  it("puts a doodle from outside your circle first, then your circle's", () => {
    const stranger = doodle('stranger', '2026-11-18');
    expect(dayDoodles(feed, stranger).map((d) => d.id)).toEqual([
      'stranger',
      'mine',
      'friend',
    ]);
  });
});
