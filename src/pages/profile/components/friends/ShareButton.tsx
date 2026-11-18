import { useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { faShareAlt } from '@fortawesome/free-solid-svg-icons';
import type { FC, ReactNode } from 'react';
import Button from '@/components/Button';
import { cn } from '@/utils';

type Props = {
  text: string;
  imageUrl?: string;
  urlPath?: string;
  children?: ReactNode;
  className?: string;
};

async function imageFile(imageUrl: string) {
  const blob = await fetch(imageUrl).then((response) => response.blob());
  return new File([blob], 'doodle.png', { type: blob.type });
}

/** Opens the phone's share sheet, or copies the link where there isn't one */
export const ShareButton: FC<Props> = ({
  text,
  imageUrl,
  urlPath,
  children,
  className,
}) => {
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}${urlPath ?? location.pathname}`;

    // Desktop browsers mostly lack a share sheet
    const canShare = 'share' in navigator;
    if (!canShare) {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const files = imageUrl ? [await imageFile(imageUrl)] : undefined;
    // Rejects when the sheet is dismissed, which is fine
    await navigator.share({ text, url, files }).catch(() => {});
  }

  return (
    <Button
      size="sm"
      className={cn('h-fit', className)}
      icon={faShareAlt}
      onClick={handleShare}
    >
      {copied ? 'link copied!' : children}
    </Button>
  );
};
