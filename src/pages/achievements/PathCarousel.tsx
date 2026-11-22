import { useLayoutEffect, useRef, useState } from 'react';
import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { FC, ReactNode } from 'react';
import type { Achievement } from '@/api/Api';
import type { AchievementPath } from '@/achievements/paths';
import { cn } from '@/utils';

/** Each card leaves this much of the next one peeking in, so you can tell there's more */
export const pathStepClassName =
  'shrink-0 basis-[calc(100%-2.75rem)] snap-start';

const ArrowButton: FC<{
  direction: 'back' | 'forward';
  disabled: boolean;
  onClick: () => void;
}> = ({ direction, disabled, onClick }) => (
  <button
    type="button"
    aria-label={direction === 'back' ? 'previous step' : 'next step'}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'flex items-center justify-center size-7 shrink-0 bg-white border-2 border-ink rounded-full text-xs',
      disabled ? 'opacity-30' : 'shadow-pencil-sm press',
    )}
  >
    <FontAwesomeIcon
      icon={direction === 'back' ? faChevronLeft : faChevronRight}
    />
  </button>
);

/**
 * A path's steps side by side, scrolled to the first one not completed. The
 * ones before it are a swipe back, the ones after it a swipe on, and the dots
 * underneath say where you are: filled for completed, coral for the current
 * step, the long one for the card in view.
 */
const PathCarousel: FC<{
  path: AchievementPath;
  /** A card a link points at starts in view instead */
  linkedId?: string;
  renderStep: (achievement: Achievement) => ReactNode;
}> = ({ path, linkedId, renderStep }) => {
  const { steps } = path;
  const track = useRef<HTMLUListElement>(null);
  const linked = steps.findIndex((s) => s.id === linkedId);
  const start =
    linked !== -1 ? linked : Math.min(path.current, steps.length - 1);
  const [inView, setInView] = useState(start);

  const cardAt = (i: number) =>
    track.current?.children[i] as HTMLElement | undefined;

  const scrollTo = (i: number, behavior: ScrollBehavior = 'smooth') => {
    const el = track.current;
    const first = cardAt(0);
    const card = cardAt(i);
    if (!el || !first || !card) return;
    el.scrollTo({ left: card.offsetLeft - first.offsetLeft, behavior });
  };

  // Open on the current step (or the linked one) before the first paint
  useLayoutEffect(() => {
    scrollTo(start, 'instant');
    setInView(start);
    // Only on mount, and when a link points somewhere new
  }, [path.id, linked]);

  const onScroll = () => {
    const el = track.current;
    const first = cardAt(0);
    const second = cardAt(1);
    if (!el || !first || !second) return;
    const stride = second.offsetLeft - first.offsetLeft;
    const i = Math.round(el.scrollLeft / stride);
    setInView(Math.max(0, Math.min(steps.length - 1, i)));
  };

  return (
    <li className="flex flex-col gap-2 w-full">
      <ul
        ref={track}
        onScroll={onScroll}
        aria-label={`path of ${steps.length} achievements`}
        className="relative flex items-stretch gap-3 w-[calc(100%+3rem)] -mx-6 px-6 scroll-px-6 py-2 -my-2 overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {steps.map(renderStep)}
      </ul>
      <div className="flex items-center gap-2">
        <span className="font-accent font-bold leading-none text-pencil whitespace-nowrap">
          step {inView + 1} of {steps.length}
        </span>
        <div className="flex flex-1 items-center justify-center gap-1.5 min-w-0">
          {steps.map((step, i) => (
            <button
              key={step.id}
              type="button"
              aria-label={`show step ${i + 1}${step.achievedAt ? ', completed' : i === path.current ? ', current' : ''}`}
              aria-current={i === inView ? 'step' : undefined}
              onClick={() => scrollTo(i)}
              className="flex items-center justify-center h-5 -my-1"
            >
              <span
                className={cn(
                  'block h-2.5 border-2 border-ink rounded-full transition-[width] duration-200',
                  i === inView ? 'w-6' : 'w-2.5',
                  step.achievedAt
                    ? 'bg-ink'
                    : i === path.current
                      ? 'bg-coral'
                      : 'bg-white',
                )}
              />
            </button>
          ))}
        </div>
        <ArrowButton
          direction="back"
          disabled={inView === 0}
          onClick={() => scrollTo(inView - 1)}
        />
        <ArrowButton
          direction="forward"
          disabled={inView === steps.length - 1}
          onClick={() => scrollTo(inView + 1)}
        />
      </div>
    </li>
  );
};

export default PathCarousel;
