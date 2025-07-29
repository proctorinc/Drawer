import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Path } from './shapes/Path';
import { getEventPoint } from './shapes/Point';
import type { SerializedPath } from './shapes/Path';
import { Config } from '@/config/Config';

type DrawingContextType = {
  selectedColor: string | null;
  setSelectedColor: (color: string) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  clearCanvas: () => void;
  undo: () => void;
  selectEraser: () => void;
  canUndo: boolean;
  getCanvasData: () => string;
};

const DrawingContext = createContext<DrawingContextType | undefined>(undefined);

export const DrawingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [lastScale, setLastScale] = useState<number>(1);
  const [initialCanvasX, setInitialCanvasX] = useState<number>(0);
  const [initialCanvasY, setInitialCanvasY] = useState<number>(0);
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const initialDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);
  const [paths, setPaths] = useState<Array<Path>>(loadPaths());
  const currentPathRef = useRef<Path | null>(null);

  const canUndo = paths.length > 0;
  const isEraseMode = selectedColor === null;

  const clearCanvas = useCallback(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); // Clear canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation
        paths.forEach((path) => path.draw(ctx)); // Redraw all paths
      }
    }
  }, [paths]);

  const undo = useCallback(() => {
    if (paths.length > 0) {
      updatePaths(paths.slice(0, -1));
      redraw();
    }
  }, [paths]);

  const redraw = useCallback(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); // Clear canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation
        paths.forEach((path) => path.draw(ctx)); // Redraw all paths
      }
    }
  }, [paths, lastScale]);

  const getDistance = (event: TouchEvent) => {
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2),
    );
  };

  const handleMouseDown = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (event instanceof TouchEvent) {
        if (event.touches.length > 1) {
          setIsDrawing(false);
          setIsPinching(true);
          initialDistance.current = getDistance(event);
          initialScale.current = lastScale;
          return;
        }
      }

      if (event instanceof TouchEvent) {
        if (event.touches.length !== 1) {
          setIsDrawing(false);
          return;
        }
      }

      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      setIsDrawing(true);
      const startPoint = getEventPoint(event, canvas);

      const path = new Path(
        [startPoint],
        isEraseMode ? 'rgba(0,0,0,1)' : selectedColor || Config.ERASER_COLOR,
        Config.CURSOR_SIZE,
        isEraseMode,
      );
      currentPathRef.current = path;

      ctx.strokeStyle = path.color || 'rgba(0,0,0,1)';
      ctx.lineWidth = path.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
    },
    [selectedColor],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (event instanceof TouchEvent && isPinching) {
        event.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!canvas || !ctx) return;

        const currentDistance = getDistance(event);

        if (initialDistance.current === 0) return;

        let scaleFactor = currentDistance / initialDistance.current;
        scaleFactor = initialScale.current * scaleFactor;

        // Limit the scale factor to prevent zooming in too much or too little
        scaleFactor = Math.max(0.5, Math.min(scaleFactor, 2));

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(scaleFactor, scaleFactor);

        setLastScale(scaleFactor);
        redraw();
        return;
      }

      if (event instanceof TouchEvent) {
        if (event.touches.length !== 1) {
          setIsDrawing(false);
          return;
        }
      }

      if (!isDrawing) return;
      event.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const currentPath = currentPathRef.current;

      if (!canvas || !ctx || !currentPath) return;

      const point = getEventPoint(event, canvas);

      currentPath.points.push(point);

      currentPath.draw(ctx);
    },
    [isDrawing, isPinching],
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (event instanceof TouchEvent && isPinching) {
        setIsPinching(false);
        initialDistance.current = 0;
        initialScale.current = 1;
        return;
      }

      if (event instanceof TouchEvent) {
        if (event.changedTouches.length !== 1) {
          setIsDrawing(false);
          return;
        }
      }

      if (!isDrawing) return;

      event.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const path = currentPathRef.current;

      if (!canvas || !ctx || !path) return;

      setIsDrawing(false);

      // Finalize the current path drawing (e.g., close path, final stroke)
      ctx.closePath();

      if (path.points.length > 1) {
        setPaths((prevPaths) => [...prevPaths, path]);
      } else if (path.points.length === 1) {
        setPaths((prevPaths) => [...prevPaths, path]);
      }

      currentPathRef.current = null;
    },
    [isDrawing, setPaths, isPinching],
  );

  const handleMouseLeave = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (isDrawing) {
        handleMouseUp(event);
      }
    },
    [isDrawing, handleMouseUp],
  );

  const selectEraser = useCallback(() => {
    setSelectedColor(null);
  }, []);

  const updatePaths = (newPaths: Array<Path>) => {
    setPaths(newPaths);
    savePaths(newPaths);
  };

  function savePaths(newPaths: Array<Path>) {
    const serializedPaths = newPaths.map((path) => path.serialize());
    const stateJson = JSON.stringify(serializedPaths);
    localStorage.setItem(Config.LOCAL_STORAGE_KEY, stateJson);
  }

  function loadPaths() {
    const jsonState = localStorage.getItem('drawingPaths');

    if (jsonState) {
      const serializedPaths: Array<SerializedPath> = JSON.parse(jsonState);
      return serializedPaths.map((path) => Path.deserialize(path));
    }

    return [];
  }

  function getCanvasData() {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(
          0,
          0,
          Config.CANVAS_WIDTH,
          Config.CANVAS_HEIGHT,
        );
        const canvasData = JSON.stringify({
          width: Config.CANVAS_WIDTH,
          height: Config.CANVAS_HEIGHT,
          data: Array.from(imageData.data),
        });
        return canvasData;
      } else {
        throw Error('Failed to get canvas context');
      }
    } else {
      throw Error('Failed to get canvas reference');
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = Config.CANVAS_WIDTH;
      canvas.height = Config.CANVAS_HEIGHT;
      // mouse events
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);

      // touch events
      canvas.addEventListener('touchstart', handleMouseDown);
      canvas.addEventListener('touchmove', handleMouseMove);
      canvas.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);

        canvas.removeEventListener('touchstart', handleMouseDown);
        canvas.removeEventListener('touchmove', handleMouseMove);
        canvas.removeEventListener('touchend', handleMouseUp);
      }
    };
  }, [
    canvasRef.current,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    redraw,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    savePaths(paths);
    paths.forEach((path) => path.draw(ctx));
  }, [paths, savePaths]);

  return (
    <DrawingContext.Provider
      value={{
        selectedColor,
        setSelectedColor,
        canvasRef,
        clearCanvas,
        undo,
        selectEraser,
        canUndo,
        getCanvasData,
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
