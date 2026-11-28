import { useEffect, useLayoutEffect, useRef } from 'react';
import { flick, isSettled, stepPupil } from './googly';
import { eyesOf, loadStickerFonts, paintSticker } from './paint';
import { useStickers } from './StickerContext';
import { stickerHeight } from './stickers';
import type { FC, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Pupil } from './googly';
import type { PlacedSticker } from './stickers';
import { Config } from '@/config/Config';
import { cn } from '@/utils';

// Pixels per drawing unit: crisp even zoomed in on a dense screen
const PIXELS = 4;
// A press that moves less than this (in CSS px) is a tap, not a drag
const TAP_SLOP = 4;
// How hard moving the sticker throws the pupils around, and the most it can
const THROW = 0.6;
const MAX_THROW = 500;

const percentOf = (units: number, of: number) => `${(units / of) * 100}%`;

/**
 * Keeps the googly eyes' pupils moving while there's anything to move: the
 * sticker being dragged about, a shake, or the fall when it's first stuck on.
 */
function useGooglyEyes(
  placed: PlacedSticker,
  pupils: RefObject<Array<Pupil>>,
  jiggles: number,
  paint: () => void,
) {
  const enabled = placed.kind === 'googly-eyes';
  const where = useRef({ x: placed.x, y: placed.y });
  where.current = { x: placed.x, y: placed.y };
  const radius = eyesOf(placed.width, stickerHeight(placed)).radius;
  const radiusRef = useRef(radius);
  radiusRef.current = radius;
  const frame = useRef(0);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const wake = useRef(() => {});
  wake.current = () => {
    if (frame.current) return;
    let last: number | null = null;
    let lastWhere = where.current;
    let velocity = { x: 0, y: 0 };
    const tick = (now: number) => {
      // Long gaps (a hidden tab) count as one frame, not a launch
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 1 / 30);
      last = now;
      // The sticker's speed, smoothed: pointer moves don't land on every frame
      const moved = {
        x: (where.current.x - lastWhere.x) / dt,
        y: (where.current.y - lastWhere.y) / dt,
      };
      lastWhere = where.current;
      const next = {
        x: velocity.x + (moved.x - velocity.x) * 0.5,
        y: velocity.y + (moved.y - velocity.y) * 0.5,
      };
      // Its speeding up, in eye radii, pushes the pupils the other way
      const clampThrow = (a: number) =>
        Math.max(-MAX_THROW, Math.min(MAX_THROW, a));
      const ax = clampThrow(
        (((next.x - velocity.x) / dt) * THROW) / radiusRef.current,
      );
      const ay = clampThrow(
        (((next.y - velocity.y) / dt) * THROW) / radiusRef.current,
      );
      velocity = next;
      pupils.current = pupils.current.map((pupil) =>
        stepPupil(pupil, dt, ax, ay),
      );
      paintRef.current();
      const still = Math.hypot(velocity.x, velocity.y) < 1;
      if (still && pupils.current.every(isSettled)) {
        frame.current = 0;
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      // Free to start again if it's mounted again (as StrictMode does)
      frame.current = 0;
    },
    [],
  );

  // Moving wakes them; so does sticking them on
  useEffect(() => {
    if (enabled) wake.current();
  }, [enabled, placed.x, placed.y]);

  useEffect(() => {
    if (!enabled || jiggles === 0) return;
    pupils.current = pupils.current.map((pupil) => flick(pupil));
    wake.current();
  }, [enabled, jiggles, pupils]);
}

/** The sticker itself, painted just as it'll be pinned */
const StickerPicture: FC<{ placed: PlacedSticker }> = ({ placed }) => {
  const { pupils, jiggles } = useStickers();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = stickerHeight(placed);

  const paint = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // Paint it at the corner, not where it sits on the page
    ctx.setTransform(
      PIXELS,
      0,
      0,
      PIXELS,
      -placed.x * PIXELS,
      -placed.y * PIXELS,
    );
    paintSticker(ctx, placed, { pupils: pupils.current, placeholder: '...' });
  };
  const paintRef = useRef(paint);
  paintRef.current = paint;

  useLayoutEffect(paint);
  // Again once the bubble's font is in
  useEffect(() => {
    loadStickerFonts().then(() => paintRef.current());
  }, []);

  useGooglyEyes(placed, pupils, jiggles, paint);

  return (
    <canvas
      ref={canvasRef}
      width={Math.ceil(placed.width * PIXELS)}
      height={Math.ceil(height * PIXELS)}
      className="block size-full"
    />
  );
};

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  /** Drawing units per CSS px, however far the canvas is zoomed */
  unitsPerPx: number;
  from: PlacedSticker;
  /** Pulling the corner, not moving the whole sticker */
  resizing: boolean;
  wasSelected: boolean;
  moved: boolean;
};

/**
 * The sticker laid over the drawing: drag it anywhere, pull its corner to
 * resize it, tap it to edit it. Goes in the canvas's overlay, so it zooms
 * with the drawing.
 */
export const StickerLayer: FC = () => {
  const { placed, selected, select, deselect, update, jiggle } = useStickers();
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  if (!placed) return null;
  const height = stickerHeight(placed);
  const W = Config.CANVAS_WIDTH;
  const H = Config.CANVAS_HEIGHT;

  const start =
    (resizing: boolean) => (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary || drag.current) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      const layer = layerRef.current;
      if (!layer) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Already gone; its release still ends the drag
      }
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        unitsPerPx: W / layer.getBoundingClientRect().width,
        from: placed,
        resizing,
        wasSelected: selected,
        moved: false,
      };
      select();
    };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d?.pointerId !== event.pointerId) return;
    // The corner sits inside the sticker: one drag, handled once
    event.stopPropagation();
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    if (d.resizing) {
      // The corner follows the finger, along whichever way it went further
      const grow = Math.max(dx, dy / (height / placed.width));
      update({ width: d.from.width + grow * d.unitsPerPx });
    } else {
      update({
        x: d.from.x + dx * d.unitsPerPx,
        y: d.from.y + dy * d.unitsPerPx,
      });
    }
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    drag.current = null;
    // Tapping the googly eyes once they're picked up gives them a shake
    if (!d.moved && d.wasSelected && placed.kind === 'googly-eyes') jiggle();
  };

  const handlers = (resizing: boolean) => ({
    onPointerDown: start(resizing),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  });

  return (
    <div ref={layerRef} className="absolute inset-0 pointer-events-none">
      {/* While it's being edited, a tap anywhere else puts it down rather than drawing */}
      {selected && (
        <div
          className="absolute inset-0 pointer-events-auto"
          onPointerDown={(event) => {
            event.stopPropagation();
            deselect();
          }}
        />
      )}
      <div
        role="button"
        aria-label={placed.kind === 'bubble' ? 'Word bubble' : 'Googly eyes'}
        className={cn(
          'absolute pointer-events-auto touch-none select-none',
          selected ? 'cursor-move' : 'cursor-pointer',
        )}
        style={{
          left: percentOf(placed.x, W),
          top: percentOf(placed.y, H),
          width: percentOf(placed.width, W),
          height: percentOf(height, H),
        }}
        {...handlers(false)}
      >
        <StickerPicture placed={placed} />
        {selected && (
          <>
            <span
              aria-hidden="true"
              className="absolute -inset-1 border-2 border-dashed border-ink/60 rounded-md pointer-events-none"
            />
            <span
              aria-label="Resize"
              className="absolute -right-2 -bottom-2 size-5 bg-white border-2 border-ink rounded-full shadow-pencil-sm cursor-nwse-resize"
              {...handlers(true)}
            />
          </>
        )}
      </div>
    </div>
  );
};
