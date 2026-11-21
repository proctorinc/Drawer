import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnnouncementsStage from '../AnnouncementsStage';
import type { Announcement } from '../api';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../api', () => ({
  useMarkAnnouncementsSeen: () => ({ mutate: vi.fn() }),
}));
vi.mock('../AnnouncementArt', () => ({ default: () => null }));
vi.mock('@/animations/StageHost', () => ({
  useStageHost: () => ({ host: document.body, preview: true }),
}));

const page = (id: string, title: string): Announcement => ({
  id,
  title,
  body: '',
  art: 'none',
  imageUrl: '',
  ctaLabel: '',
  ctaUrl: '',
  position: 0,
  active: true,
  startsAt: '',
  expiresAt: '',
});

function swipe(el: Element, dx: number, dy = 0) {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 300 }] });
  fireEvent.touchEnd(el, {
    changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }],
  });
}

describe('AnnouncementsStage swiping', () => {
  it('swipes left to the next page and right back', () => {
    render(
      <AnnouncementsStage
        payload={{
          announcements: [page('a', 'first'), page('b', 'second')],
        }}
        onDone={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(screen.getByText('first')).toBeTruthy();

    swipe(dialog, -120);
    expect(screen.getByText('second')).toBeTruthy();

    // Past the last page stays put
    swipe(dialog, -120);
    expect(screen.getByText('second')).toBeTruthy();

    swipe(dialog, 120);
    expect(screen.getByText('first')).toBeTruthy();
  });

  it('ignores short or mostly vertical swipes', () => {
    render(
      <AnnouncementsStage
        payload={{
          announcements: [page('a', 'first'), page('b', 'second')],
        }}
        onDone={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    swipe(dialog, -30);
    swipe(dialog, -80, 200);
    expect(screen.getByText('first')).toBeTruthy();
  });
});
