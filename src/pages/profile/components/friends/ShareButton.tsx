import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/Button';
import { useLocation } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import { cn } from '@/utils';

type Props = {
  text: string;
  urlPath?: string;
  children?: ReactNode;
  className?: string;
};

export const ShareButton: FC<Props> = ({
  text,
  urlPath,
  children,
  className,
}) => {
  const location = useLocation();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        text,
        url: `${window.location.origin}${urlPath ?? location.pathname}`,
      });
    } else {
      navigator.clipboard.writeText(
        `${text} ${window.location.origin}${urlPath ?? location.pathname}`,
      );
    }
  };

  return (
    <Button
      size="sm"
      className={cn('h-fit', className)}
      icon={faShareAlt}
      onClick={handleShare}
    >
      {children}
    </Button>
  );
};
