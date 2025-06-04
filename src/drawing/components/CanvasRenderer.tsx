import { useEffect, useRef } from 'react';
import { Config } from '@/config/Config';
import { cn } from '@/utils';

interface CanvasRendererProps {
  imageUrl: string;
  className?: string;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  imageUrl,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // Create an image element
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Enable CORS for the image

        img.onload = () => {
          // Set canvas dimensions to match the image
          canvasRef.current!.width = Config.CANVAS_WIDTH;
          canvasRef.current!.height = Config.CANVAS_HEIGHT;

          // Draw the image on the canvas
          ctx.drawImage(img, 0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
        };

        img.onerror = (error) => {
          console.error('Error loading image:', error);
        };

        // Set the image source to load it
        img.src = imageUrl;
      }
    }
  }, [imageUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={Config.CANVAS_WIDTH}
      height={Config.CANVAS_HEIGHT}
      className={cn('w-full', className)}
    />
  );
};
