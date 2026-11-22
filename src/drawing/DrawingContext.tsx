import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Path } from './shapes/Path';
import { getEventPoint } from './shapes/Point';
import { strokeFeedback } from './feedback';
import type { FC, PointerEvent as ReactPointerEvent } from 'react';
import type { SerializedPath } from './shapes/Path';
import { usePencilSoundSync } from '@/api/appSettings';
import { Config } from '@/config/Config';

/** What the <canvas> element needs to be drawn on */
type CanvasBindings = {
  ref: (canvas: HTMLCanvasElement | null) => void;
  width: number;
  height: number;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

type DrawingContextType = {
  /** null while the eraser is in hand */
  selectedColor: string | null;
  setSelectedColor: (color: string) => void;
  selectEraser: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasBindings: CanvasBindings;
  clearCanvas: () => void;
  undo: () => void;
  canUndo: boolean;
  /** Something's actually showing, not just strokes that were all erased */
  hasInk: boolean;
  getPng: (backgroundColor?: string) => Promise<Blob>;
};

const DrawingContext = createContext<DrawingContextType | undefined>(undefined);

// The canvas keeps this many pixels per drawing unit, so strokes stay crisp
// on dense screens and in the uploaded picture
const SCALE = Config.CANVAS_SCALE;
const PIXEL_WIDTH = Config.CANVAS_WIDTH * SCALE;
const PIXEL_HEIGHT = Config.CANVAS_HEIGHT * SCALE;
// A second finger this early in a stroke means a gesture, not a drawing
const GESTURE_GRACE_POINTS = 8;
// A tap that wobbles less than this (in drawing units) is a dot, not a line
const DOT_WOBBLE = 2.5;

function loadPaths(key: string): Array<Path> {
  try {
    const json = localStorage.getItem(key);
    if (!json) return [];
    const serialized: Array<SerializedPath> = JSON.parse(json);
    return serialized.map((path) => Path.deserialize(path));
  } catch {
    return [];
  }
}

function savePaths(key: string, paths: Array<Path>) {
  try {
    if (paths.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(
        key,
        JSON.stringify(paths.map((path) => path.serialize())),
      );
    }
  } catch {
    // Out of space or blocked: the drawing still works, it just won't survive a reload
  }
}

function makeLayer() {
  const layer = document.createElement('canvas');
  layer.width = PIXEL_WIDTH;
  layer.height = PIXEL_HEIGHT;
  return layer;
}

/** Whether any pixel is left showing, for drawings where the eraser has been used */
function layerHasInk(layer: HTMLCanvasElement) {
  const ctx = layer.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true;
  const { data } = ctx.getImageData(0, 0, layer.width, layer.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
}

type DrawingProviderProps = {
  localStorageKey: string;
  children: React.ReactNode;
};

export const DrawingProvider: FC<DrawingProviderProps> = ({
  children,
  localStorageKey,
}) => {
  usePencilSoundSync();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [paths, setPaths] = useState<Array<Path>>(() =>
    loadPaths(localStorageKey),
  );
  const [hasInk, setHasInk] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Every finished stroke, flattened, so a stroke in progress only has to
  // draw itself over one picture
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const currentRef = useRef<{
    path: Path;
    pointerId: number;
    pointerType: string;
  } | null>(null);
  const frameRef = useRef(0);
  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;

  const paint = useCallback(() => {
    frameRef.current = 0;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, PIXEL_WIDTH, PIXEL_HEIGHT);
    if (committedRef.current) ctx.drawImage(committedRef.current, 0, 0);
    const current = currentRef.current;
    if (current) {
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      current.path.draw(ctx);
    }
  }, []);

  // At most one paint per frame, however fast the pointer reports
  const schedulePaint = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Rebuild the finished strokes whenever they change (a stroke lands, undo,
  // clear) or the canvas appears
  useLayoutEffect(() => {
    const layer = makeLayer();
    const ctx = layer.getContext('2d');
    if (ctx) {
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      paths.forEach((path) => path.draw(ctx));
    }
    committedRef.current = layer;
    // Only the eraser can make strokes add up to nothing
    setHasInk(
      paths.some((path) => path.isEraser)
        ? layerHasInk(layer)
        : paths.length > 0,
    );
    paint();
  }, [paths, canvas, paint]);

  useEffect(() => {
    savePaths(localStorageKey, paths);
  }, [localStorageKey, paths]);

  const commitStroke = useCallback(() => {
    const current = currentRef.current;
    if (!current) return;
    currentRef.current = null;
    const { path } = current;
    // A finger never lands perfectly still; if it barely moved, it was a
    // tap, so keep it as one clean dot (a near-zero line can draw nothing)
    const [first] = path.points;
    const isDot = path.points.every(
      (point) => Math.hypot(point.x - first.x, point.y - first.y) < DOT_WOBBLE,
    );
    if (isDot) path.points = [first];
    strokeFeedback.end(isDot ? 'dot' : 'line');
    setPaths((prev) => [...prev, path]);
  }, []);

  const dropStroke = useCallback(() => {
    currentRef.current = null;
    strokeFeedback.end('cancel');
    schedulePaint();
  }, [schedulePaint]);

  const canvasBindings = useMemo<CanvasBindings>(
    () => ({
      ref: (element) => {
        canvasRef.current = element;
        setCanvas(element);
      },
      width: PIXEL_WIDTH,
      height: PIXEL_HEIGHT,
      onPointerDown: (event) => {
        const current = currentRef.current;
        if (!event.isPrimary) {
          // A second finger means a pinch, so the finger already down stops
          // drawing. If its stroke had barely started it was the first half
          // of the pinch and leaves no mark; a real line it drew is kept.
          // (A palm landing beside a pencil doesn't count.)
          if (
            current &&
            current.pointerType === 'touch' &&
            event.pointerType === 'touch'
          ) {
            if (current.path.points.length < GESTURE_GRACE_POINTS) {
              dropStroke();
            } else {
              commitStroke();
            }
          }
          return;
        }
        // Already drawing (say, a palm landing while the pencil's down)
        if (current) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        // Keep getting this pointer's moves and release even off the canvas
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // The pointer's already gone; its release will still end the stroke
        }
        const color = selectedColorRef.current;
        currentRef.current = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          path: new Path(
            [getEventPoint(event, event.currentTarget)],
            color ?? '#000',
            Config.CURSOR_SIZE,
            color === null,
          ),
        };
        strokeFeedback.start(
          event.clientX,
          event.clientY,
          event.timeStamp,
          color,
          event.pointerType,
        );
        schedulePaint();
      },
      onPointerMove: (event) => {
        const current = currentRef.current;
        if (!current || current.pointerId !== event.pointerId) return;
        // Fast strokes report several positions per event; keep them all
        // (not every browser has getCoalescedEvents yet)
        const native = event.nativeEvent as Omit<
          PointerEvent,
          'getCoalescedEvents'
        > & { getCoalescedEvents?: () => Array<PointerEvent> };
        const samples = native.getCoalescedEvents?.() ?? [];
        const events = samples.length > 0 ? samples : [native];
        const { points } = current.path;
        for (const sample of events) {
          const point = getEventPoint(sample, event.currentTarget);
          const last = points[points.length - 1];
          // Repeats add nothing to the line, and can make a tap draw nothing
          if (last.x === point.x && last.y === point.y) continue;
          points.push(point);
        }
        strokeFeedback.move(native.clientX, native.clientY, native.timeStamp);
        schedulePaint();
      },
      onPointerUp: (event) => {
        if (currentRef.current?.pointerId === event.pointerId) commitStroke();
      },
      // The browser took the pointer (a system gesture, the pencil lifting
      // out of range): keep what was drawn
      onPointerCancel: (event) => {
        if (currentRef.current?.pointerId === event.pointerId) commitStroke();
      },
      onLostPointerCapture: (event) => {
        if (currentRef.current?.pointerId === event.pointerId) commitStroke();
      },
    }),
    [commitStroke, dropStroke, schedulePaint],
  );

  const clearCanvas = useCallback(() => {
    if (currentRef.current) strokeFeedback.end('cancel');
    currentRef.current = null;
    setPaths([]);
  }, []);

  const undo = useCallback(() => {
    setPaths((prev) => prev.slice(0, -1));
  }, []);

  const selectEraser = useCallback(() => setSelectedColor(null), []);

  const getPng = useCallback(
    async (backgroundColor?: string): Promise<Blob> => {
      const layer = makeLayer();
      const ctx = layer.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, PIXEL_WIDTH, PIXEL_HEIGHT);
      }
      if (committedRef.current) ctx.drawImage(committedRef.current, 0, 0);
      return new Promise<Blob>((resolve, reject) => {
        layer.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('Could not export PNG')),
          'image/png',
        );
      });
    },
    [],
  );

  return (
    <DrawingContext.Provider
      value={{
        selectedColor,
        setSelectedColor,
        selectEraser,
        canvasRef,
        canvasBindings,
        clearCanvas,
        undo,
        canUndo: paths.length > 0,
        hasInk,
        getPng,
      }}
    >
      {children}
    </DrawingContext.Provider>
  );
};

export const useDrawing = (): DrawingContextType => {
  const context = useContext(DrawingContext);

  if (!context) {
    throw new Error('useDrawing must be used within a DrawingProvider');
  }

  return context;
};
