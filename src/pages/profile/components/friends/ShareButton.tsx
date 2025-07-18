import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/Button';
import { useLocation } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';
import { cn } from '@/utils';

type Props = {
  text: string;
  imageUrl?: string;
  urlPath?: string;
  children?: ReactNode;
  className?: string;
};

export const ShareButton: FC<Props> = ({
  text,
  imageUrl,
  urlPath,
  children,
  className,
}) => {
  const location = useLocation();

  const handleShareWithImage = async (fileUrl: string) => {
    if (navigator.share) {
      const response = await fetch(fileUrl);
      const blob = await response.blob();

      const imageFile = new File([blob], 'logo.png', { type: blob.type });

      navigator.share({
        text,
        url: `${window.location.origin}${urlPath ?? location.pathname}`,
        files: [imageFile],
      });
    }
  };

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
      onClick={() =>
        imageUrl ? handleShareWithImage(imageUrl) : handleShare()
      }
    >
      {children}
    </Button>
  );
};
