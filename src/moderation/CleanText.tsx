import { useMemo } from 'react';
import { findProfanity } from './profanity';
import type { CSSProperties, FC } from 'react';

// Flat rainbow stripes with hard edges, light enough for ink text to read on every band
const RAINBOW: CSSProperties = {
  backgroundImage:
    'linear-gradient(90deg, #ff9a8f 0 16.66%, #ffbe6b 0 33.33%, #ffe27a 0 50%, #9be3a0 0 66.66%, #8ec5ff 0 83.33%, #c9a8ff 0)',
};

/**
 * Renders user text with each swear word swapped for a silly word of the same kind, in a little
 * rainbow tag so it's clear the original was cleaned up.
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
            style={RAINBOW}
            className="inline-block px-1.5 mx-0.5 font-silly text-[0.85em] leading-snug tracking-wide text-ink rounded-[3px] -rotate-2 select-none whitespace-nowrap"
          >
            {segment.swap}
          </span>
        ) : (
          segment.text
        ),
      )}
    </span>
  );
};
