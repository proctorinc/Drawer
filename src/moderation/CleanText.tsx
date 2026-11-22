import { useMemo } from 'react';
import { findProfanity } from './profanity';
import type { FC } from 'react';

/**
 * Renders user text with each swear word swapped for a little "redacted" tag in a silly font.
 */
export const CleanText: FC<{ text: string | null | undefined }> = ({
  text,
}) => {
  const segments = useMemo(() => findProfanity(text ?? ''), [text]);

  // One wrapping span so a flex parent sees a single item, not a column per word run
  return (
    <span>
      {segments.map((segment, i) =>
        segment.profane ? (
          <span
            key={i}
            className="inline-block px-1.5 mx-0.5 font-silly text-[0.85em] leading-snug tracking-wide text-paper bg-ink rounded-[3px] -rotate-2 select-none whitespace-nowrap"
          >
            redacted
          </span>
        ) : (
          segment.text
        ),
      )}
    </span>
  );
};
