import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PastPages } from '../components/DayPages';
import type { UserPromptSubmission } from '@/api/Api';

vi.mock('../components/Polaroid', () => ({ default: () => <div /> }));
vi.mock('@/events/useChristmas', () => ({ useChristmas: () => null }));
vi.mock('@/daily/DailyPromptContext', () => ({
  useDailyPrompt: () => ({ dailyPrompt: null }),
}));

const feed = Array.from(
  { length: 7 },
  (_, i) =>
    ({
      id: `doodle-${i}`,
      day: `2026-11-${String(20 - i).padStart(2, '0')}`,
      prompt: 'a cat',
      colors: [],
      user: { id: 'friend' },
    }) as UserPromptSubmission,
);
vi.mock('@/pages/profile/context/MyProfileContext', () => ({
  useMyProfilePage: () => ({ profile: { feed } }),
}));

/** Stands in for the browser: each observer reports whether the sentinel is on screen */
let sentinelOnScreen = false;
let observers: Array<IntersectionObserverCallback> = [];
class FakeIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {
    observers.push(callback);
  }
  observe() {
    this.report();
  }
  disconnect() {
    observers = observers.filter((cb) => cb !== this.callback);
  }
  report() {
    this.callback(
      [{ isIntersecting: sentinelOnScreen } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const scrollSentinelIntoView = () =>
  act(() => {
    for (const callback of [...observers]) {
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    }
  });

const pagesShown = () => screen.queryAllByRole('heading', { level: 1 }).length;

describe('PastPages', () => {
  beforeEach(() => {
    sentinelOnScreen = false;
    observers = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  it('opens more days as you scroll down to the end, with no button', () => {
    render(<PastPages />);
    expect(pagesShown()).toBe(0);
    expect(screen.queryByRole('button')).toBeNull();

    scrollSentinelIntoView();
    expect(pagesShown()).toBe(3);

    scrollSentinelIntoView();
    expect(pagesShown()).toBe(6);
  });

  it('stops watching once every day is open', () => {
    render(<PastPages />);
    scrollSentinelIntoView();
    scrollSentinelIntoView();
    scrollSentinelIntoView();

    expect(pagesShown()).toBe(7);
    expect(observers).toHaveLength(0);
  });

  it('keeps flipping while the end of the feed is still on screen', () => {
    sentinelOnScreen = true;
    render(<PastPages />);
    expect(pagesShown()).toBe(7);
  });
});
