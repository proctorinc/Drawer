import { useState } from 'react';
import { cn } from '@/utils';

interface CanvasRendererProps {
  imageUrl: string;
  className?: string;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  imageUrl,
  className = '',
}) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <img
      src={imageUrl}
      crossOrigin="anonymous"
      onLoad={() => setIsLoading(false)}
      onError={(error) => {
        console.error('Error loading image:', error);
        setIsLoading(false);
      }}
      className={cn(
        'w-full transition-all duration-300',
        isLoading
          ? 'opacity-70 blur-lg scale-105'
          : 'opacity-100 blur-0 scale-100',
        className,
      )}
    />
  );
};
