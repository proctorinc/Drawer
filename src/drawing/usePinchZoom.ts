import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** How far two fingers can blow the canvas up */
export const MAX_ZOOM = 3;
// Let go this close to 1x and it springs back to fitting exactly
const SNAP_BACK = 1.08;

type View = { scale: number; x: number; y: number };
type Pinch = {
  ids: [number, number];
  distance: number;
  /** The drawing-surface point (unzoomed, in CSS px) under the fingers' middle */
  anchor: { x: number; y: number };
  scale: number;
};

export type PinchZoomHandle = {
  /** Back to fitting the frame; instantly (say, before measuring the canvas) or with a spring */
  reset: (animate?: boolean) => void;
};

/**
 * Two fingers zoom and pan whatever sits in the frame, one finger is left to
 * draw. The content is transformed directly, so a pinch never re-renders.
 *
 * Fingers are heard anywhere in `areaRef` (the frame itself if not given), so
 * a pinch beside the canvas still zooms the canvas rather than the page.
 */
export function usePinchZoom(areaRef?: RefObject<HTMLElement | null>) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const view = useRef<View>({ scale: 1, x: 0, y: 0 });
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<Pinch | null>(null);
  const [zoomed, setZoomed] = useState(false);

  /** Where the frame's inside starts on screen (inside its border) */
  const origin = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return { left: 0, top: 0, width: 0, height: 0 };
    const rect = frame.getBoundingClientRect();
    return {
      left: rect.left + frame.clientLeft,
      top: rect.top + frame.clientTop,
      width: frame.clientWidth,
      height: frame.clientHeight,
    };
  }, []);

  const apply = useCallback((next: View, animate: boolean) => {
    view.current = next;
    // Whatever the frame holds (the canvas) is what zooms
    const content = frameRef.current?.firstElementChild as HTMLElement | null;
    if (content) {
      content.style.transformOrigin = '0 0';
      content.style.transition = animate
        ? 'transform 350ms var(--ease-spring)'
        : 'none';
      content.style.transform =
        next.scale === 1
          ? ''
          : `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
    }
    setZoomed(next.scale > 1);
  }, []);

  const reset = useCallback(
    (animate = true) => {
      pinch.current = null;
      apply({ scale: 1, x: 0, y: 0 }, animate);
    },
    [apply],
  );

  // A new frame size (a rotated phone, a layout change) starts from fitting again
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      if (view.current.scale !== 1) reset(false);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [reset]);

  const startPinch = useCallback(() => {
    const [a, b] = [...touches.current.entries()];
    const box = origin();
    const { scale, x, y } = view.current;
    const midX = (a[1].x + b[1].x) / 2 - box.left;
    const midY = (a[1].y + b[1].y) / 2 - box.top;
    pinch.current = {
      ids: [a[0], b[0]],
      distance: Math.max(1, Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y)),
      anchor: { x: (midX - x) / scale, y: (midY - y) / scale },
      scale,
    };
  }, [origin]);

  const movePinch = useCallback(() => {
    const current = pinch.current;
    if (!current) return;
    const a = touches.current.get(current.ids[0]);
    const b = touches.current.get(current.ids[1]);
    if (!a || !b) return;
    const box = origin();
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const scale = Math.min(
      MAX_ZOOM,
      Math.max(1, (current.scale * distance) / current.distance),
    );
    const midX = (a.x + b.x) / 2 - box.left;
    const midY = (a.y + b.y) / 2 - box.top;
    // Keep the point that started under the fingers under them, but never
    // pull the canvas's edge inside the frame
    const x = Math.min(
      0,
      Math.max(box.width - box.width * scale, midX - current.anchor.x * scale),
    );
    const y = Math.min(
      0,
      Math.max(
        box.height - box.height * scale,
        midY - current.anchor.y * scale,
      ),
    );
    apply({ scale, x, y }, false);
  }, [apply, origin]);

  const release = useCallback(
    (event: PointerEvent) => {
      if (!touches.current.delete(event.pointerId)) return;
      const current = pinch.current;
      if (!current || current.ids.includes(event.pointerId) === false) return;
      pinch.current = null;
      if (view.current.scale < SNAP_BACK) reset(true);
      // A third finger still down with one of the pair carries on the pinch
      else if (touches.current.size >= 2) startPinch();
    },
    [reset, startPinch],
  );

  useEffect(() => {
    const area = areaRef?.current ?? frameRef.current;
    if (!area) return;

    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      // The first finger down means no others are: forget any whose lift
      // never arrived (iOS can drop it when the system takes a touch), or
      // that ghost plus every one-finger stroke would pinch
      if (event.isPrimary) {
        touches.current.clear();
        pinch.current = null;
      }
      touches.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (touches.current.size === 2) {
        // Keep hearing this finger wherever it slides
        try {
          area.setPointerCapture(event.pointerId);
        } catch {
          // Already gone; its release still arrives
        }
        startPinch();
      }
    };
    const move = (event: PointerEvent) => {
      const touch = touches.current.get(event.pointerId);
      if (!touch) return;
      touch.x = event.clientX;
      touch.y = event.clientY;
      if (pinch.current) movePinch();
    };
    // iOS Safari zooms the whole page on its own gesture events, even with
    // touch-action: none, so the area swallows them
    const stopPageZoom = (event: Event) => event.preventDefault();

    area.addEventListener('pointerdown', down);
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerup', release);
    area.addEventListener('pointercancel', release);
    area.addEventListener('gesturestart', stopPageZoom);
    area.addEventListener('gesturechange', stopPageZoom);
    return () => {
      area.removeEventListener('pointerdown', down);
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerup', release);
      area.removeEventListener('pointercancel', release);
      area.removeEventListener('gesturestart', stopPageZoom);
      area.removeEventListener('gesturechange', stopPageZoom);
    };
  }, [areaRef, movePinch, release, startPinch]);

  return { frameRef, zoomed, reset };
}
