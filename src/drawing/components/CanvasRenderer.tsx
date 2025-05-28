import { useEffect, useRef } from 'react';
import { Config } from '@/config/Config';

interface CanvasRendererProps {
  canvasData: string;
  className?: string;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  canvasData,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        try {
          const data = JSON.parse(canvasData);
          const imageData = new ImageData(
            new Uint8ClampedArray(data.data),
            data.width,
            data.height,
          );
          ctx.putImageData(imageData, 0, 0);
        } catch (error) {
          console.error('Error rendering canvas:', error);
        }
      }
    }
  }, [canvasData]);

  return (
    <canvas
      ref={canvasRef}
      width={Config.CANVAS_WIDTH}
      height={Config.CANVAS_HEIGHT}
      className={className}
    />
  );
};
