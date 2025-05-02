import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Path, type SerializedPath } from './shapes/Path';
import { Config } from '@/config/Config';
import { getEventPoint } from './shapes/Point';

type DrawingContextType = {
    selectedColor: string | null;
    setSelectedColor: (color: string) => void;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    clearCanvas: () => void;
    undo: () => void;
    downloadCanvas: () => Promise<Blob | null>;
    selectEraser: () => void;
    canUndo: boolean;
};

const DrawingContext = createContext<DrawingContextType | undefined>(undefined);

export const DrawingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [paths, setPaths] = useState<Path[]>(loadPaths());
    const currentPathRef = useRef<Path | null>(null);

    const canUndo = paths.length > 0;
    const isEraseMode = selectedColor === null;

    const clearCanvas = useCallback(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                updatePaths([]);
            }
        }
    }, []);

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
                paths.forEach(path => path.draw(ctx)); // Redraw all paths
            }
        }
    }, [paths]);

    const downloadCanvas = useCallback(async () => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const imageBlob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                }, 'image/png');
            });
            // await submitDailyPrompt(imageBlob);
            clearCanvas();

            return imageBlob;
        }
        return null
    }, []);

    const handleMouseDown = useCallback((event: MouseEvent | TouchEvent) => {
        event.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const startPoint = getEventPoint(event, canvas);

        const path = new Path(
            [startPoint],
            selectedColor || 'white',
            Config.CURSOR_SIZE,
        );
        currentPathRef.current = path;

        ctx.strokeStyle = path.color || 'rgba(0,0,0,1)';
        ctx.lineWidth = path.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (isEraseMode) {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
    }, [selectedColor]);

    const handleMouseMove = useCallback((event: MouseEvent | TouchEvent) => {
        if (!isDrawing) return;

        event.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const currentPath = currentPathRef.current;

        if (!canvas || !ctx || !currentPath) return;

        const point = getEventPoint(event, canvas);

        currentPath.points.push(point);

        currentPath.draw(ctx);

    }, [isDrawing]);

    const handleMouseUp = useCallback((event: MouseEvent | TouchEvent) => {
        if (!isDrawing) return; // Only finalize if was drawing

        event.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const path = currentPathRef.current;

        if (!canvas || !ctx || !path) return;

        setIsDrawing(false);

        // Finalize the current path drawing (e.g., close path, final stroke)
        ctx.closePath();

        // Reset composite operation if it was changed for eraser
        if (ctx.globalCompositeOperation !== 'source-over') {
             ctx.globalCompositeOperation = 'source-over';
        }

        if (path.points.length > 1) {
            setPaths(prevPaths => [...prevPaths, path]);
        } else if (path.points.length === 1) {
              setPaths(prevPaths => [...prevPaths, path]);
        }

        currentPathRef.current = null;
    }, [isDrawing, setPaths]);

    const handleMouseLeave = useCallback((event: MouseEvent | TouchEvent) => {
        if (isDrawing) {
            handleMouseUp(event);
        }
    }, [isDrawing, handleMouseUp]);

    const selectEraser = useCallback(() => {
        setSelectedColor(null);
    }, []);

    const updatePaths = (paths: Path[]) => {
        console.log('Updating paths', paths);
        setPaths(paths);
        savePaths(paths);
    }

    function savePaths(paths: Path[]) {
        console.log('Saving paths!!!');
        const serializedPaths = paths.map(path => path.serialize());
        const stateJson = JSON.stringify(serializedPaths);
        localStorage.setItem(Config.LOCAL_STORAGE_KEY, stateJson);
    }

    function loadPaths() {
        const jsonState = localStorage.getItem('drawingPaths');
        
        if (jsonState) {
            const serializedPaths: SerializedPath[] = JSON.parse(jsonState);
            return serializedPaths.map(path => Path.deserialize(path));
        }

        return []
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
    }, [canvasRef.current, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, redraw]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        savePaths(paths);
        paths.forEach(path => path.draw(ctx));
    }, [paths, savePaths]);

    return (
        <DrawingContext.Provider value={{ selectedColor, setSelectedColor, canvasRef, clearCanvas, undo, downloadCanvas, selectEraser, canUndo }}>
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
