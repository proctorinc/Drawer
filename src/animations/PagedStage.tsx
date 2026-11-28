import '@/animations/completed/completed.css';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FC, ReactNode } from 'react';
import { useStageHost } from '@/animations/StageHost';
import Button from '@/components/Button';
import { ArrowLeftIcon } from '@/components/icons';
import { cn } from '@/utils';
import { cardIn, pageFlip } from '@/sound/sfx';

export type StagePage = {
  id: string;
  art: ReactNode;
  title: ReactNode;
  body: ReactNode;
  /** An extra button above next / got it */
  action?: { label: string; onClick: () => void };
};

type Props = {
  /** Small caps over the pages, like "what's new" */
  eyebrow: string;
  pages: Array<StagePage>;
  /** Set while the stage animates out */
  leaving: boolean;
  /** Animate out and finish */
  onClose: () => void;
};

/**
 * A full-screen card of pages, with dots to show how many there are: swipe,
 * arrow keys or the buttons page through. Shared by announcements and the
 * drawing tips.
 */
export const PagedStage: FC<Props> = ({ eyebrow, pages, leaving, onClose }) => {
  const { host, preview } = useStageHost();
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)] as
    | StagePage
    | undefined;
  const last = index >= pages.length - 1;

  // A whoosh as it opens, and a page turn each time the page changes
  const heardIndex = useRef<number | null>(null);
  useEffect(() => {
    const before = heardIndex.current;
    heardIndex.current = index;
    if (before === null) cardIn();
    else if (index !== before) pageFlip(index > before ? 1 : -1);
  }, [index]);

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
            {eyebrow}
          </span>
          <button
            type="button"
            onClick={onClose}
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
            {page.art}
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
            {page.body}
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
            {page.action && (
              <Button
                disableLoad
                variant={last ? 'primary' : 'base'}
                onClick={page.action.onClick}
              >
                {page.action.label}
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
                variant={page.action && last ? 'base' : 'primary'}
                className="flex-1"
                onClick={() => (last ? onClose() : setIndex(index + 1))}
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
