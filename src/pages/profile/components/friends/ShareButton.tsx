import { useEffect, useState } from 'react';
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

/**
 * Fetches the image ahead of time. Safari only opens the share sheet straight
 * from a tap, so there's no time to download it once the button is pressed.
 */
function useImageFile(imageUrl?: string) {
  const [file, setFile] = useState<File>();

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    fetch(imageUrl)
      .then((response) => response.blob())
      .then((blob) => {
        if (!cancelled) {
          setFile(new File([blob], 'doodle.png', { type: blob.type }));
        }
      })
      // Without the image we still share the link
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return file;
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
  const imageFile = useImageFile(imageUrl);
  const [note, setNote] = useState<string | null>(null);

  function flash(message: string) {
    setNote(message);
    setTimeout(() => setNote(null), 2000);
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      flash('link copied!');
    } catch {
      // No clipboard either, e.g. plain http or permission denied
      flash("couldn't share");
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}${urlPath ?? location.pathname}`;

    // Desktop browsers mostly lack a share sheet
    if (!('share' in navigator)) {
      await copyLink(url);
      return;
    }

    const files =
      imageFile &&
      'canShare' in navigator &&
      navigator.canShare({ files: [imageFile] })
        ? [imageFile]
        : undefined;
    try {
      await navigator.share({ text, url, files });
    } catch (error) {
      // Dismissing the sheet is fine; anything else falls back to copying
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copyLink(url);
    }
  }

  return (
    <Button
      size="sm"
      className={cn('h-fit', className)}
      icon={faShareAlt}
      disableLoad
      onClick={handleShare}
    >
      {note ?? children}
    </Button>
  );
};
