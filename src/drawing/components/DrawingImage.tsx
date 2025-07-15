import { useState, useRef, useEffect, type FC } from 'react';
import { cn } from '@/utils';
import { Config } from '@/config/Config';

type Props = {
  imageUrl: string;
  className?: string;
  onClick?: () => void;
};

export const DrawingImage: FC<Props> = ({
  imageUrl,
  className = '',
  onClick,
}) => {
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

  function getSrc() {
    if (isInView) {
      return imageUrl;
    } else if (Config.ENV === 'development') {
      return 'https://proctorinc-drawer-s3.s3.us-east-2.amazonaws.com/ea0de815bd830a2159827840cdb53919/8ca84223c7494d6b5a853cfb0a373019.png';
    }
    return '';
  }

  return (
    <img
      ref={imgRef}
      src={getSrc()}
      loading="lazy"
      crossOrigin="anonymous"
      onClick={onClick}
      onLoad={() => {
        setIsLoading(false);
        hasLoadedBefore.current = true;
      }}
      onError={(error) => {
        console.error('Error loading image:', error);
        setIsLoading(false);
      }}
      className={cn(
        'w-full transition-all duration-200 aspect-square h-full rounded-lg',
        isLoading && !hasLoadedBefore.current
          ? 'opacity-70 blur-sm'
          : 'opacity-100 blur-0',
        className,
      )}
    />
  );
};
