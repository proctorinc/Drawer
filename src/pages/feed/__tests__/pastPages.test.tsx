import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PastPages } from '../components/DayPages';
import type { ReactNode } from 'react';
import type { FeedPage, UserPromptSubmission } from '@/api/Api';

vi.mock('../components/Polaroid', () => ({ default: () => <div /> }));
vi.mock('@/events/useChristmas', () => ({ useChristmas: () => null }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { day: string };
  }) => <a href={`/draw/redo/${params.day}`}>{children}</a>,
}));
vi.mock('@/daily/DailyPromptContext', () => ({
  useDailyPrompt: () => ({ dailyPrompt: { day: '2026-11-20' } }),
}));

const doodle = (day: string) =>
  ({
    id: `doodle-${day}`,
    day,
    prompt: 'a cat',
    colors: [],
    user: { id: 'friend' },
  }) as UserPromptSubmission;

/** What the feed query has loaded so far */
let feed: {
  pages: Array<FeedPage>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};
const fetchNextPage = vi.fn();
vi.mock('@/api/Api', () => ({
  useFeed: () => ({
    data: { pages: feed.pages },
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage,
  }),
  // You missed nov 18 and can still redo it
  useGetRedos: () => ({ data: { prompts: [{ day: '2026-11-18' }] } }),
}));

/** Stands in for the browser: each observer reports whether the sentinel is on screen */
let sentinelOnScreen = false;
let observers: Array<IntersectionObserverCallback> = [];
class FakeIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {
    observers.push(callback);
  }
  observe() {
    this.callback(
      [{ isIntersecting: sentinelOnScreen } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {
    observers = observers.filter((cb) => cb !== this.callback);
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

/** Each day's page is headed by its prompt */
const daysShown = () => screen.queryAllByRole('heading', { level: 1 }).length;

describe('PastPages', () => {
  beforeEach(() => {
    sentinelOnScreen = false;
    observers = [];
    fetchNextPage.mockClear();
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    feed = {
      pages: [
        {
          submissions: [
            doodle('2026-11-20'),
            doodle('2026-11-19'),
            doodle('2026-11-18'),
          ],
          nextBefore: '2026-11-18',
        },
      ],
      hasNextPage: true,
      isFetchingNextPage: false,
    };
  });

  it('shows the loaded days before today', () => {
    render(<PastPages />);
    expect(daysShown()).toBe(2);
    expect(screen.getByText('thu, nov 19')).toBeTruthy();
    expect(screen.getByText('wed, nov 18')).toBeTruthy();
  });

  it('offers a redo on just the days you can redo', () => {
    render(<PastPages />);
    const links = screen.getAllByRole('link', { name: /redo it/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/draw/redo/2026-11-18',
    ]);
  });

  it('loads the next page as you scroll down to the end, with no button', () => {
    render(<PastPages />);
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();

    scrollSentinelIntoView();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('waits for a page to arrive before asking for another', () => {
    feed.isFetchingNextPage = true;
    render(<PastPages />);
    scrollSentinelIntoView();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('keeps loading while the end of the feed is still on screen', () => {
    sentinelOnScreen = true;
    render(<PastPages />);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('stops watching once the last page is in', () => {
    feed.hasNextPage = false;
    render(<PastPages />);
    expect(observers).toHaveLength(0);
    expect(daysShown()).toBe(2);
  });
});
