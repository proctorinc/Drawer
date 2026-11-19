import type { FC } from 'react';
import { cn } from '@/utils';

const HATCH =
  'repeating-linear-gradient(-45deg, transparent 0 5px, rgb(43 42 51 / 0.14) 5px 7px)';

type Props = {
  value: number;
  max: number;
  label: string;
  /** Background class for the filled part */
  fill?: string;
  /** A CSS color or gradient for the filled part; wins over `fill` */
  fillBackground?: string;
  className?: string;
};

/** A hand-drawn bar that fills with pencil-hatched color */
const ProgressBar: FC<Props> = ({
  value,
  max,
  label,
  fill = 'bg-butter',
  fillBackground,
  className,
}) => {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.min(value, max)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        'h-4 w-full bg-white border-2 border-ink rounded-sketch-alt overflow-hidden',
        className,
      )}
    >
      {percent > 0 && (
        <div
          className={cn(
            'h-full border-r-2 border-ink animate-in slide-in-from-left-full duration-700 ease-[var(--ease-spring)]',
            percent === 100 && 'border-r-0',
            !fillBackground && fill,
          )}
          style={{
            width: `${percent}%`,
            // The last layer of a background may be a plain color
            ...(fillBackground
              ? { background: `${HATCH}, ${fillBackground}` }
              : { backgroundImage: HATCH }),
          }}
        />
      )}
    </div>
  );
};

export default ProgressBar;
