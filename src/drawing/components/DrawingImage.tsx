import { useState, useRef, useEffect, type FC } from 'react';
import { cn } from '@/utils';

type Props = {
  imageUrl: string;
  className?: string;
};

export const DrawingImage: FC<Props> = ({ imageUrl, className = '' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedBefore = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px 0px', // Start loading when within 50px of viewport
      },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isInView ? imageUrl : ''}
      loading="lazy"
      crossOrigin="anonymous"
      onLoad={() => {
        setIsLoading(false);
        hasLoadedBefore.current = true;
      }}
      onError={(error) => {
        console.error('Error loading image:', error);
        setIsLoading(false);
      }}
      className={cn(
        'w-full transition-all duration-200 aspect-square h-full',
        isLoading && !hasLoadedBefore.current
          ? 'opacity-70 blur-lg scale-105'
          : 'opacity-100 blur-0 scale-100',
        className,
      )}
    />
  );
};
