import '@/animations/completed/completed.css';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import AnnouncementArt from './AnnouncementArt';
import { useMarkAnnouncementsSeen } from './api';
import type { StageComponent } from '@/animations/types';
import type { Announcement } from './api';
import { useStageHost } from '@/animations/StageHost';
import { useStageExit } from '@/animations/completed/useStageExit';
import Button from '@/components/Button';
import { ArrowLeftIcon } from '@/components/icons';
import { cn } from '@/utils';

/** The button's link: an in-app path navigates, anything else opens in a new tab */
function useFollow(onLeave: () => void, preview: boolean) {
  const navigate = useNavigate();
  return (a: Announcement) => {
    if (preview) return onLeave();
    if (a.ctaUrl.startsWith('/')) {
      void navigate({ to: a.ctaUrl });
    } else {
      window.open(a.ctaUrl, '_blank', 'noopener');
    }
    onLeave();
  };
}

/**
 * What's new, filling the screen: one page per announcement, with dots to show
 * how many there are. Opening it counts as reading every page, so they don't
 * pop up on their own again (the preview and replays from the bell aside).
 */
export const AnnouncementsStage: StageComponent<'announcements'> = ({
  payload,
  onDone,
}) => {
  const { host, preview } = useStageHost();
  const isPreview = preview || !!payload.preview;
  const { leaving, exit, finish } = useStageExit(onDone);
  const follow = useFollow(finish, isPreview);
  const titleId = useId();
  const pages = payload.announcements;
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)] as
    | Announcement
    | undefined;
  const last = index >= pages.length - 1;

  // Mark them seen as soon as they're up, so a reload mid-read doesn't pop them again
  const markSeen = useMarkAnnouncementsSeen();
  const marked = useRef(false);
  useEffect(() => {
    if (isPreview || marked.current || !payload.markSeen?.length) return;
    marked.current = true;
    markSeen.mutate(payload.markSeen);
  }, [isPreview, markSeen, payload.markSeen]);

  // Nothing to show: step aside
  useEffect(() => {
    if (!page) finish();
  }, [page, finish]);

  const goNext = () => setIndex((i) => Math.min(i + 1, pages.length - 1));
  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  // Arrow keys page through (Escape closes, from useStageExit)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight')
        setIndex((i) => Math.min(i + 1, pages.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length]);

  // Swipe left for the next page, right for the one before. Only a mostly
  // sideways swipe counts, so scrolling a long page doesn't flip it.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current =
      e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goNext();
    else goBack();
  };

  // Lock the page behind
  useEffect(() => {
    if (preview) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [preview]);

  // Focus the main button on each page
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mainRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [index]);

  if (!page) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onTouchStart={pages.length > 1 ? onTouchStart : undefined}
      onTouchEnd={pages.length > 1 ? onTouchEnd : undefined}
    >
      <div
        className="completed-dim fixed inset-0 paper"
        data-leaving={leaving || undefined}
        aria-hidden="true"
      />

      <div
        className="completed-card relative flex flex-col flex-1 w-full max-w-md mx-auto px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        data-leaving={leaving || undefined}
      >
        <header className="flex items-center justify-between h-10">
          <span className="text-sm uppercase tracking-widest text-pencil">
            what's new
          </span>
          <button
            type="button"
            onClick={exit}
            aria-label="Close"
            className="grid place-items-center size-10 text-3xl leading-none text-pencil hover:text-ink cursor-pointer"
          >
            ×
          </button>
        </header>

        {/* Keyed so each page plays its entrance */}
        <div
          key={page.id}
          className="flex flex-col items-center justify-center flex-1 gap-6 py-6 text-center"
        >
          <span className="completed-rise grid place-items-center min-h-52">
            <AnnouncementArt announcement={page} />
          </span>
          <div
            className="completed-rise flex flex-col gap-3"
            style={{ animationDelay: '0.12s' }}
          >
            <h2
              id={titleId}
              className="font-accent font-bold text-4xl leading-none"
            >
              <span className="highlight">{page.title}</span>
            </h2>
            {page.body
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph, i) => (
                <p
                  key={i}
                  className="text-lg leading-snug text-pencil whitespace-pre-line"
                >
                  {paragraph}
                </p>
              ))}
          </div>
        </div>

        <footer className="flex flex-col items-center gap-4">
          {pages.length > 1 && (
            <div className="flex items-center gap-2" aria-hidden="true">
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-3 rounded-full border-2 border-ink transition-all cursor-pointer',
                    i === index ? 'w-7 bg-ink' : 'w-3 bg-white',
                  )}
                />
              ))}
            </div>
          )}
          <div
            ref={mainRef}
            className="flex flex-col gap-2 w-full max-w-[18rem]"
          >
            {page.ctaUrl && (
              <Button
                disableLoad
                variant={last ? 'primary' : 'base'}
                onClick={() => follow(page)}
              >
                {page.ctaLabel}
              </Button>
            )}
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  aria-label="Back"
                  onClick={goBack}
                  className="press grid place-items-center flex-none size-12 bg-white border-2 border-ink rounded-sketch-alt cursor-pointer"
                >
                  <ArrowLeftIcon size={22} />
                </button>
              )}
              <Button
                disableLoad
                variant={page.ctaUrl && last ? 'base' : 'primary'}
                className="flex-1"
                onClick={() => (last ? exit() : setIndex(index + 1))}
              >
                {last ? 'got it' : 'next'}
              </Button>
            </div>
          </div>
          {pages.length > 1 && (
            <span className="text-sm text-pencil">
              {index + 1} of {pages.length}
            </span>
          )}
        </footer>
      </div>
    </div>,
    host,
  );
};

export default AnnouncementsStage;
