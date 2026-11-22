import { useEffect } from 'react';
import { useBlocker } from '@tanstack/react-router';
import Button from '@/components/Button';

// How close to the screen's side a touch counts as the start of iOS Safari's
// swipe-back; nothing on the desk sits that close to the edge
const EDGE = 18;

/**
 * Stops a stray back swipe, back button or history gesture from leaving the
 * canvas mid-drawing: it asks first. Tapping a link on purpose still just goes.
 * Returns the "leave?" sheet to render.
 */
export function useLeaveGuard(active: boolean) {
  const blocker = useBlocker({
    shouldBlockFn: ({ action }) => action !== 'PUSH' && action !== 'REPLACE',
    disabled: !active,
    withResolver: true,
    enableBeforeUnload: false,
  });

  useEffect(() => {
    if (!active) return;
    // Swallow touches that start right at the edge, so Safari doesn't begin
    // its swipe-back at all
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const x = event.touches[0].clientX;
      if (x < EDGE || x > window.innerWidth - EDGE) event.preventDefault();
    };
    // ...and Chrome's overscroll swipe between pages
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorX;
    root.style.overscrollBehaviorX = 'none';
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => {
      root.style.overscrollBehaviorX = previous;
      document.removeEventListener('touchstart', onTouchStart);
    };
  }, [active]);

  if (blocker.status !== 'blocked') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-guard-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-[max(16px,env(safe-area-inset-bottom))]"
    >
      <div
        className="absolute inset-0 bg-ink/40 animate-in fade-in duration-200"
        onClick={blocker.reset}
      />
      <div className="relative flex flex-col gap-4 w-full max-w-sm p-5 bg-paper border-2 border-ink rounded-sketch animate-in slide-in-from-bottom-8 fade-in duration-300 ease-[var(--ease-spring)]">
        <div className="flex flex-col gap-1">
          <h2
            id="leave-guard-title"
            className="font-accent font-bold text-2xl leading-tight"
          >
            leave your doodle?
          </h2>
          <p className="text-pencil">
            it's saved, it'll be right here when you come back.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button autoFocus onClick={blocker.reset}>
            keep drawing
          </Button>
          <Button variant="base" size="sm" onClick={blocker.proceed}>
            leave
          </Button>
        </div>
      </div>
    </div>
  );
}
