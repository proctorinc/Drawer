import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/Button';
import { useLocation } from '@tanstack/react-router';
import type { FC, ReactNode } from 'react';

type Props = {
  text: string;
  urlPath?: string;
  children?: ReactNode;
};

export const ShareButton: FC<Props> = ({ text, urlPath, children }) => {
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
    <Button size="sm" icon={faShareAlt} onClick={handleShare}>
      {children}
    </Button>
  );
};
