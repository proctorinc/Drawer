import type { FC } from 'react';
import { cn } from '@/utils';

// Same pencil hatching as the trophies page's ProgressBar
const HATCH =
  'repeating-linear-gradient(-45deg, transparent 0 5px, rgb(43 42 51 / 0.14) 5px 7px)';

type Props = {
  /** 0–1 */
  frac: number;
  /** A CSS color or gradient for the filled part */
  fill: string;
  className?: string;
};

/**
 * The hand-drawn hatched bar from the trophies page, but driven frame by
 * frame (no mount animation of its own) so callers can sweep and reset it.
 */
export const LevelBar: FC<Props> = ({ frac, fill, className }) => {
  const percent = Math.min(100, Math.max(0, frac * 100));
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block w-full h-3.5 bg-white border-2 border-ink rounded-sketch-alt overflow-hidden',
        className,
      )}
    >
      <span
        className={cn(
          'block h-full border-ink',
          percent > 0 && percent < 100 && 'border-r-2',
        )}
        style={{ width: `${percent}%`, background: `${HATCH}, ${fill}` }}
      />
    </span>
  );
};
