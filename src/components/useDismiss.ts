import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from '@tanstack/react-router';
import type { RefObject } from 'react';

/** Closes an open popover when you press anywhere outside `ref` or move to another page */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const latest = useRef({ open, onDismiss });
  useLayoutEffect(() => {
    latest.current = { open, onDismiss };
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        latest.current.onDismiss();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, ref]);

  useEffect(() => {
    if (latest.current.open) latest.current.onDismiss();
  }, [pathname]);
}
